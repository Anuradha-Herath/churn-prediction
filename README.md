# Customer Churn Prediction

End-to-end ML project: data cleaning, feature engineering, model training (Logistic Regression, Random Forest, XGBoost), MLflow tracking, FastAPI backend, and Next.js frontend.

## Setup

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -r requirements.txt
```

## Run

- **Preprocessing:** `python src/preprocessing.py`
- **Training:** `python src/train.py`
- **SHAP explainability:** `python src/evaluate.py` (saves `models/shap_summary.png`, `shap_importance.png`)
- **API:** `uvicorn api.main:app --reload --host 0.0.0.0 --port 8000`
- **Frontend:** `cd frontend && npm install && npm run dev` (then open http://localhost:3000)
- **Docker API:** `docker build -t churn-api .` then `docker run -p 8000:8000 churn-api`

## Project structure

- `data/` — Telco churn dataset
- `src/` — preprocessing, train, evaluate
- `models/` — scaler, churn_model.joblib, feature_columns.json, SHAP plots
- `api/` — FastAPI app (`/predict`, `/health`)
- `frontend/` — Next.js app (form → API → result)
- `Dockerfile` — container for FastAPI backend
