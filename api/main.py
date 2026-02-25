"""
Customer Churn Prediction - FastAPI Backend
============================================
Step 9: POST /predict, GET /health, load model at startup, CORS for Next.js.

Run from project root: uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Project root (parent of api/)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
MODELS_DIR = os.path.join(PROJECT_ROOT, "models")

# Global state (loaded at startup)
app_state = {"model": None, "scaler": None, "feature_columns": None, "q33": None, "q66": None}


# ---------------------------------------------------------------------------
# Request/response schemas
# ---------------------------------------------------------------------------
class PredictRequest(BaseModel):
    tenure: int = Field(..., ge=0, description="Months with the company")
    monthly_charges: float = Field(..., ge=0, description="Monthly charges")
    contract: str = Field(..., description="Month-to-month | One year | Two year")
    internet_service: str = Field(..., description="DSL | Fiber optic | No")
    payment_method: str = Field(..., description="e.g. Electronic check, Mailed check")
    paperless_billing: str = Field("Yes", description="Yes | No")
    tech_support: str = Field("No", description="Yes | No")
    online_security: str = Field("No", description="Yes | No")
    # Optional with defaults so we can build full feature vector
    gender: str = Field("Male", description="Male | Female")
    senior_citizen: int = Field(0, ge=0, le=1)
    partner: str = Field("No", description="Yes | No")
    dependents: str = Field("No", description="Yes | No")
    phone_service: str = Field("Yes", description="Yes | No")
    online_backup: str = Field("No", description="Yes | No")
    device_protection: str = Field("No", description="Yes | No")
    streaming_tv: str = Field("No", description="Yes | No")
    streaming_movies: str = Field("No", description="Yes | No")
    multiple_lines: str = Field("No", description="No | Yes | No phone service")


class PredictResponse(BaseModel):
    churn_probability: float
    prediction: str  # "Likely to Churn" | "Not Likely"
    confidence: str  # "High" | "Medium" | "Low"


def _bucket_tenure(tenure: int) -> str:
    """Same bins as preprocessing: 0-12, 13-24, 25-48, 49-60, 60+."""
    if tenure < 13:
        return "0-12"
    if tenure < 25:
        return "13-24"
    if tenure < 49:
        return "25-48"
    if tenure < 61:
        return "49-60"
    return "60+"


def _bucket_monthly(monthly_charges: float, q33: float, q66: float) -> str:
    if monthly_charges <= q33:
        return "low"
    if monthly_charges <= q66:
        return "medium"
    return "high"


def build_feature_row(req: PredictRequest, q33: float, q66: float) -> dict:
    """
    Build a single row of features in the same encoding as training.
    Returns dict with keys matching feature_columns (order handled when building vector).
    """
    tenure_group = _bucket_tenure(req.tenure)
    monthly_bucket = _bucket_monthly(req.monthly_charges, q33, q66)
    total_charges = req.tenure * req.monthly_charges
    total_spend = req.tenure * req.monthly_charges

    row = {
        "gender": 1 if req.gender.strip().lower() == "male" else 0,
        "SeniorCitizen": req.senior_citizen,
        "Partner": 1 if req.partner.strip().lower() == "yes" else 0,
        "Dependents": 1 if req.dependents.strip().lower() == "yes" else 0,
        "tenure": req.tenure,
        "PhoneService": 1 if req.phone_service.strip().lower() == "yes" else 0,
        "OnlineSecurity": 1 if req.online_security.strip().lower() == "yes" else 0,
        "OnlineBackup": 1 if req.online_backup.strip().lower() == "yes" else 0,
        "DeviceProtection": 1 if req.device_protection.strip().lower() == "yes" else 0,
        "TechSupport": 1 if req.tech_support.strip().lower() == "yes" else 0,
        "StreamingTV": 1 if req.streaming_tv.strip().lower() == "yes" else 0,
        "StreamingMovies": 1 if req.streaming_movies.strip().lower() == "yes" else 0,
        "PaperlessBilling": 1 if req.paperless_billing.strip().lower() == "yes" else 0,
        "MonthlyCharges": req.monthly_charges,
        "TotalCharges": total_charges,
        "total_spend": total_spend,
    }
    # One-hot: Contract
    for c in ["Contract_Month-to-month", "Contract_One year", "Contract_Two year"]:
        row[c] = 0
    key = f"Contract_{req.contract.strip()}"
    if key in row:
        row[key] = 1
    # One-hot: InternetService
    for c in ["InternetService_DSL", "InternetService_Fiber optic", "InternetService_No"]:
        row[c] = 0
    key = f"InternetService_{req.internet_service.strip()}"
    if key in row:
        row[key] = 1
    # One-hot: PaymentMethod (normalize common variants)
    pm = req.payment_method.strip()
    for c in ["PaymentMethod_Bank transfer (automatic)", "PaymentMethod_Credit card (automatic)", "PaymentMethod_Electronic check", "PaymentMethod_Mailed check"]:
        row[c] = 0
    if "Bank transfer" in pm or "automatic" in pm and "Bank" in pm:
        row["PaymentMethod_Bank transfer (automatic)"] = 1
    elif "Credit card" in pm or "Credit card (automatic)" in pm:
        row["PaymentMethod_Credit card (automatic)"] = 1
    elif "Electronic" in pm:
        row["PaymentMethod_Electronic check"] = 1
    elif "Mailed" in pm:
        row["PaymentMethod_Mailed check"] = 1
    else:
        row["PaymentMethod_Electronic check"] = 1  # default
    # One-hot: MultipleLines
    for c in ["MultipleLines_No", "MultipleLines_No phone service", "MultipleLines_Yes"]:
        row[c] = 0
    ml = req.multiple_lines.strip().lower()
    if "no phone" in ml:
        row["MultipleLines_No phone service"] = 1
    elif ml == "yes":
        row["MultipleLines_Yes"] = 1
    else:
        row["MultipleLines_No"] = 1
    # One-hot: tenure_group
    for tg in ["tenure_group_0-12", "tenure_group_13-24", "tenure_group_25-48", "tenure_group_49-60", "tenure_group_60+"]:
        row[tg] = 0
    row[f"tenure_group_{tenure_group}"] = 1
    # One-hot: monthly_charges_bucket
    for b in ["monthly_charges_bucket_low", "monthly_charges_bucket_medium", "monthly_charges_bucket_high"]:
        row[b] = 0
    row[f"monthly_charges_bucket_{monthly_bucket}"] = 1
    return row


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model, scaler, feature columns (and quantiles) once at startup."""
    model_path = os.path.join(MODELS_DIR, "churn_model.joblib")
    scaler_path = os.path.join(MODELS_DIR, "scaler.joblib")
    fc_path = os.path.join(MODELS_DIR, "feature_columns.json")
    if not all(os.path.exists(p) for p in [model_path, scaler_path, fc_path]):
        raise RuntimeError("Missing model artifacts. Run src/train.py first.")
    app_state["model"] = joblib.load(model_path)
    app_state["scaler"] = joblib.load(scaler_path)
    with open(fc_path) as f:
        app_state["feature_columns"] = json.load(f)
    # Load data to get monthly charge quantiles for bucket boundaries
    from src.preprocessing import load_and_clean_data
    df = load_and_clean_data()
    app_state["q33"] = float(df["MonthlyCharges"].quantile(0.33))
    app_state["q66"] = float(df["MonthlyCharges"].quantile(0.66))
    yield
    # shutdown: nothing to do


app = FastAPI(title="Churn Prediction API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    """Run churn prediction with same feature engineering as training."""
    model = app_state["model"]
    scaler = app_state["scaler"]
    feature_columns = app_state["feature_columns"]
    q33 = app_state["q33"]
    q66 = app_state["q66"]
    if model is None or scaler is None or feature_columns is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    row = build_feature_row(request, q33, q66)
    # Build vector in exact training column order
    numerical_cols = ["tenure", "MonthlyCharges", "TotalCharges", "total_spend"]
    num_vals = np.array([[row["tenure"], row["MonthlyCharges"], row["TotalCharges"], row["total_spend"]]], dtype=float)
    scaled_num = scaler.transform(num_vals)[0]
    # Full feature vector: use scaled values for numerical, row values for rest
    X_list = []
    for c in feature_columns:
        if c in numerical_cols:
            X_list.append(scaled_num[numerical_cols.index(c)])
        else:
            X_list.append(row.get(c, 0))
    X = np.array([X_list], dtype=float)
    proba = float(model.predict_proba(X)[0, 1])
    prediction = "Likely to Churn" if proba >= 0.5 else "Not Likely"
    if proba >= 0.8 or proba <= 0.2:
        confidence = "High"
    elif proba >= 0.6 or proba <= 0.4:
        confidence = "Medium"
    else:
        confidence = "Low"
    return PredictResponse(churn_probability=round(proba, 2), prediction=prediction, confidence=confidence)
