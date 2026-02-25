"""
Customer Churn Prediction - Data Preprocessing
==============================================
Step 1: Data cleaning (load, fix types, encode, scale)
Step 2: Feature engineering (tenure_group, monthly_charges_bucket, total_spend)
The cleaned data is ready for model training in train.py
"""

import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import joblib
from typing import Tuple


# ---------------------------------------------------------------------------
# Paths (relative to project root - run scripts from churn-prediction/)
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(PROJECT_ROOT, "data", "churn.csv")
MODELS_DIR = os.path.join(PROJECT_ROOT, "models")


def load_and_clean_data(data_path: str = None) -> pd.DataFrame:
    """
    Step 1a: Load the CSV and do basic cleaning.
    - Drop customerID (identifier, not a feature)
    - Convert TotalCharges to numeric (handles spaces/invalid values)
    - Fill missing TotalCharges with median
    """
    path = data_path or DATA_PATH
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset not found: {path}")

    df = pd.read_csv(path)

    # Drop customer ID - it's unique per customer and not useful for prediction
    if "customerID" in df.columns:
        df = df.drop(columns=["customerID"])

    # TotalCharges is often stored as string with spaces for missing values.
    # Convert to numeric; invalid values become NaN.
    if "TotalCharges" in df.columns:
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")
        median_total = df["TotalCharges"].median()
        df["TotalCharges"] = df["TotalCharges"].fillna(median_total)

    return df


def encode_target(df: pd.DataFrame) -> pd.DataFrame:
    """
    Step 1b: Encode target column Churn.
    Yes -> 1, No -> 0 (so "churn" is the positive class for metrics)
    """
    df = df.copy()
    if "Churn" not in df.columns:
        raise ValueError("Target column 'Churn' not found")
    df["Churn"] = (df["Churn"] == "Yes").astype(int)
    return df


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Step 2: Feature engineering (done BEFORE scaling).
    - tenure_group: bins for tenure (0-12, 13-24, 25-48, 49-60, 60+)
    - monthly_charges_bucket: low / medium / high from MonthlyCharges
    - total_spend: tenure * MonthlyCharges (approximate total paid)
    """
    df = df.copy()

    # Tenure groups (months): 0-12, 13-24, 25-48, 49-60, 60+
    bins_tenure = [0, 13, 25, 49, 61, np.inf]
    labels_tenure = ["0-12", "13-24", "25-48", "49-60", "60+"]
    df["tenure_group"] = pd.cut(df["tenure"], bins=bins_tenure, labels=labels_tenure, right=False)

    # Monthly charges buckets (rough thirds: low < ~45, medium 45-75, high > 75)
    # Using quantiles so they adapt to the data
    q33 = df["MonthlyCharges"].quantile(0.33)
    q66 = df["MonthlyCharges"].quantile(0.66)
    df["monthly_charges_bucket"] = pd.cut(
        df["MonthlyCharges"],
        bins=[-np.inf, q33, q66, np.inf],
        labels=["low", "medium", "high"],
    )

    # Total spend proxy
    df["total_spend"] = df["tenure"] * df["MonthlyCharges"]

    return df


def encode_binary_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Step 1c: Encode binary Yes/No columns to 0/1.
    """
    df = df.copy()
    binary_cols = [
        "gender", "Partner", "Dependents", "PhoneService",
        "PaperlessBilling",
        "OnlineSecurity", "OnlineBackup", "DeviceProtection",
        "TechSupport", "StreamingTV", "StreamingMovies",
    ]
    # Keep only those that exist (e.g. SeniorCitizen is already 0/1)
    for col in binary_cols:
        if col not in df.columns:
            continue
        # Map Yes->1, No->0; other values (e.g. "No internet service") we treat as No -> 0
        unique = df[col].dropna().unique()
        if set(unique).issubset({"Yes", "No"}):
            df[col] = (df[col] == "Yes").astype(int)
        else:
            # e.g. "No internet service" -> 0, "Yes" -> 1
            df[col] = (df[col] == "Yes").astype(int)

    return df


def one_hot_encode_categorical(df: pd.DataFrame) -> pd.DataFrame:
    """
    Step 1d: One-hot encode multi-category columns.
    Includes: Contract, InternetService, PaymentMethod, MultipleLines,
    tenure_group, monthly_charges_bucket (from feature engineering).
    """
    df = df.copy()
    categorical_cols = [
        "Contract",
        "InternetService",
        "PaymentMethod",
        "MultipleLines",
        "tenure_group",
        "monthly_charges_bucket",
    ]
    # Only columns that exist and are still categorical (object/category)
    to_encode = [c for c in categorical_cols if c in df.columns and df[c].dtype in ("object", "category")]
    if not to_encode:
        return df

    df = pd.get_dummies(df, columns=to_encode, drop_first=False, dtype=int)
    return df


def scale_numerical_features(df: pd.DataFrame, scaler: StandardScaler = None, fit: bool = True):
    """
    Step 1e: Scale numerical features with StandardScaler.
    Numerical features: tenure, MonthlyCharges, TotalCharges, total_spend.
    If fit=True, fit the scaler and return it; if fit=False, only transform using provided scaler.
    """
    numerical_cols = ["tenure", "MonthlyCharges", "TotalCharges", "total_spend"]
    existing_num = [c for c in numerical_cols if c in df.columns]
    if not existing_num:
        return df, scaler

    X_num = df[existing_num].astype(float)
    if scaler is None:
        scaler = StandardScaler()
    if fit:
        X_num_scaled = scaler.fit_transform(X_num)
    else:
        X_num_scaled = scaler.transform(X_num)

    df = df.copy()
    df[existing_num] = X_num_scaled
    return df, scaler


def preprocess(data_path: str = None, save_scaler: bool = True) -> Tuple[pd.DataFrame, StandardScaler]:
    """
    Full preprocessing pipeline: clean, engineer features, encode, scale.
    Returns (cleaned DataFrame ready for training, fitted StandardScaler).
    Optionally saves the scaler to models/scaler.joblib.
    """
    # 1. Load and basic clean
    df = load_and_clean_data(data_path)

    # 2. Encode target first so we don't drop it
    df = encode_target(df)

    # 3. Feature engineering (before scaling)
    df = add_engineered_features(df)

    # 4. Encode binary columns
    df = encode_binary_columns(df)

    # 5. One-hot encode categorical (including engineered tenure_group, monthly_charges_bucket)
    df = one_hot_encode_categorical(df)

    # 6. Scale numerical features and fit scaler
    df, scaler = scale_numerical_features(df, fit=True)

    if save_scaler:
        os.makedirs(MODELS_DIR, exist_ok=True)
        scaler_path = os.path.join(MODELS_DIR, "scaler.joblib")
        joblib.dump(scaler, scaler_path)
        print(f"Scaler saved to {scaler_path}")

    return df, scaler


def get_feature_matrix_and_target(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Split preprocessed dataframe into X (all features) and y (target).
    Drops target and any non-feature columns.
    """
    if "Churn" not in df.columns:
        raise ValueError("Churn column not found")
    y = df["Churn"]
    X = df.drop(columns=["Churn"])
    return X, y


# ---------------------------------------------------------------------------
# Run preprocessing when this file is executed (for testing)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Running preprocessing pipeline...")
    df_clean, scaler = preprocess(save_scaler=True)
    X, y = get_feature_matrix_and_target(df_clean)
    print(f"Shape: X {X.shape}, y {y.shape}")
    print(f"Churn distribution:\n{y.value_counts()}")
    print(f"Feature columns ({len(X.columns)}): {list(X.columns)}")
    print("Done. Run 'python src/train.py' next for training.")
