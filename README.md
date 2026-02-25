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
- **Training:** `python src/train.py` (when added)
- **API:** `uvicorn api.main:app --reload`
- **Frontend:** `cd frontend && npm run dev` (when added)

## Project structure

- `data/` — Telco churn dataset
- `src/` — preprocessing, training, evaluation, prediction
- `models/` — saved scaler and model artifacts
- `api/` — FastAPI app
- `frontend/` — Next.js app (when added)
