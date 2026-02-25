"""
Customer Churn Prediction - Model Explainability (SHAP)
=======================================================
Step 7: SHAP summary plot, bar plot (feature importance), and single-prediction SHAP for API.

Run from project root: python src/evaluate.py
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for saving files
import matplotlib.pyplot as plt
import shap

# Ensure project root is on path
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
from src.preprocessing import preprocess, get_feature_matrix_and_target, MODELS_DIR


def load_model_and_data():
    """Load saved model and get feature matrix (sample for SHAP)."""
    model_path = os.path.join(MODELS_DIR, "churn_model.joblib")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}. Run src/train.py first.")
    model = joblib.load(model_path)
    df_clean, _ = preprocess(save_scaler=False)
    X, _ = get_feature_matrix_and_target(df_clean)
    return model, X


def generate_shap_plots(model, X_background, feature_names, models_dir: str):
    """
    Generate SHAP summary plot and bar plot (feature importance).
    Uses a sample of the data for speed (SHAP can be slow on full dataset).
    """
    # Use a sample to keep runtime reasonable (e.g. 500 rows)
    n_background = min(500, len(X_background))
    X_sample = X_background.sample(n=n_background, random_state=42)
    # TreeExplainer for tree models (RF, XGB), LinearExplainer for Logistic Regression
    model_type = type(model).__name__
    if "LogisticRegression" in model_type:
        explainer = shap.LinearExplainer(model, X_sample)
    else:
        explainer = shap.TreeExplainer(model, X_sample)
    shap_values = explainer.shap_values(X_sample)
    # For binary classification, shap_values can be a list (one per class); take positive class
    if isinstance(shap_values, list):
        shap_values = shap_values[1] if len(shap_values) > 1 else shap_values[0]
    # Summary plot (beeswarm)
    shap.summary_plot(shap_values, X_sample, feature_names=feature_names, show=False)
    summary_path = os.path.join(models_dir, "shap_summary.png")
    plt.gcf().savefig(summary_path, bbox_inches="tight")
    plt.close()
    print(f"Saved SHAP summary plot to {summary_path}")
    # Bar plot (mean |SHAP| = feature importance)
    shap.summary_plot(shap_values, X_sample, feature_names=feature_names, plot_type="bar", show=False)
    importance_path = os.path.join(models_dir, "shap_importance.png")
    plt.gcf().savefig(importance_path, bbox_inches="tight")
    plt.close()
    print(f"Saved SHAP importance plot to {importance_path}")


def get_shap_values_single(model, X_row: np.ndarray, X_background: pd.DataFrame):
    """
    Return SHAP values for a single prediction (for API use).
    X_row: 1D array or row of features in same order as feature_columns.
    X_background: small background dataset (e.g. 100 rows) for the explainer.
    Returns: dict with 'shap_values' (list per feature), 'base_value', 'feature_names'.
    """
    X_back = X_background.sample(n=min(100, len(X_background)), random_state=42)
    model_type = type(model).__name__
    if "LogisticRegression" in model_type:
        explainer = shap.LinearExplainer(model, X_back)
    else:
        explainer = shap.TreeExplainer(model, X_back)
    # Ensure X_row is 2D
    if X_row.ndim == 1:
        X_row = X_row.reshape(1, -1)
    shap_vals = explainer.shap_values(X_row)
    if isinstance(shap_vals, list):
        shap_vals = shap_vals[1] if len(shap_vals) > 1 else shap_vals[0]
    base = float(explainer.expected_value) if not isinstance(explainer.expected_value, np.ndarray) else float(explainer.expected_value[1])
    return {
        "shap_values": shap_vals[0].tolist(),
        "base_value": base,
        "feature_names": list(X_background.columns),
    }


def main():
    print("Loading model and data for SHAP...")
    model, X = load_model_and_data()
    feature_names = list(X.columns)
    os.makedirs(MODELS_DIR, exist_ok=True)
    print("Generating SHAP plots (this may take a minute)...")
    generate_shap_plots(model, X, feature_names, MODELS_DIR)
    print("Done. Use get_shap_values_single(model, row, X_sample) from this module for API explainability.")


if __name__ == "__main__":
    main()
