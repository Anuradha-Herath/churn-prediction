"""
Customer Churn Prediction - Model Training
==========================================
Step 3: SMOTE on training data only (handle class imbalance)
Step 4: Train Logistic Regression, Random Forest, XGBoost; compare metrics
Step 5: Hyperparameter tuning (RandomizedSearchCV) on XGBoost
Step 6: MLflow experiment tracking for all runs
Step 8: Save best model, scaler, and feature_columns.json for the API

Run from project root: python src/train.py
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE
import mlflow
import mlflow.sklearn

# Ensure project root is on path so "from src.preprocessing" works when running python src/train.py
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
from src.preprocessing import preprocess, get_feature_matrix_and_target, MODELS_DIR

# ---------------------------------------------------------------------------
# Paths and config
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RANDOM_STATE = 42
TEST_SIZE = 0.2
MLFLOW_EXPERIMENT = "churn-prediction"


def get_metrics(y_true, y_pred, y_proba=None):
    """
    Compute accuracy, precision, recall, F1, and ROC-AUC.
    y_proba is required for ROC-AUC (probability of positive class).
    """
    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
    }
    if y_proba is not None:
        metrics["roc_auc"] = roc_auc_score(y_true, y_proba)
    else:
        metrics["roc_auc"] = 0.0
    return metrics


def train_and_log_model(name, model, X_train, y_train, X_test, y_test, run_name=None):
    """
    Train a model, evaluate on test set, and log to MLflow.
    Returns (trained_model, metrics_dict).
    """
    with mlflow.start_run(run_name=run_name or name):
        mlflow.log_param("model_name", name)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1] if hasattr(model, "predict_proba") else None
        metrics = get_metrics(y_test, y_pred, y_proba)
        for k, v in metrics.items():
            mlflow.log_metric(k, v)
        # Log the model artifact (works for sklearn-compatible estimators including XGBoost)
        mlflow.sklearn.log_model(model, "model")
        return model, metrics


def main():
    # -----------------------------------------------------------------------
    # Load preprocessed data and split
    # -----------------------------------------------------------------------
    print("Loading and preprocessing data...")
    df_clean, scaler = preprocess(save_scaler=True)  # Ensures scaler is saved
    X, y = get_feature_matrix_and_target(df_clean)
    feature_columns = list(X.columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    # -----------------------------------------------------------------------
    # Step 3: SMOTE on training data only (never on test)
    # -----------------------------------------------------------------------
    print("Applying SMOTE to training set (minority oversampling)...")
    smote = SMOTE(random_state=RANDOM_STATE, k_neighbors=5)
    X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)
    print(f"  Train after SMOTE: {X_train_resampled.shape[0]} samples (was {X_train.shape[0]})")

    # -----------------------------------------------------------------------
    # Step 6: MLflow experiment
    # -----------------------------------------------------------------------
    mlflow.set_experiment(MLFLOW_EXPERIMENT)

    # -----------------------------------------------------------------------
    # Step 4: Train and compare three models (each in its own MLflow run)
    # -----------------------------------------------------------------------
    print("\nTraining models and logging to MLflow...")
    results = {}

    # 1. Logistic Regression
    lr = LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)
    lr_model, results["Logistic Regression"] = train_and_log_model(
        "Logistic Regression", lr, X_train_resampled, y_train_resampled, X_test, y_test
    )

    # 2. Random Forest
    rf = RandomForestClassifier(n_estimators=100, random_state=RANDOM_STATE)
    rf_model, results["Random Forest"] = train_and_log_model(
        "Random Forest", rf, X_train_resampled, y_train_resampled, X_test, y_test
    )

    # 3. XGBoost (baseline for tuning)
    xgb = XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        random_state=RANDOM_STATE,
    )
    xgb_model, results["XGBoost"] = train_and_log_model(
        "XGBoost", xgb, X_train_resampled, y_train_resampled, X_test, y_test
    )

    # -----------------------------------------------------------------------
    # Print comparison table
    # -----------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("Model comparison (test set)")
    print("=" * 60)
    df_results = pd.DataFrame(results).T
    print(df_results.to_string())
    print("=" * 60)

    # Best model so far by ROC-AUC
    best_name = df_results["roc_auc"].idxmax()
    best_roc = df_results.loc[best_name, "roc_auc"]
    model_map = {"Logistic Regression": lr_model, "Random Forest": rf_model, "XGBoost": xgb_model}
    final_model = model_map[best_name]
    print(f"\nBest model so far by ROC-AUC: {best_name} ({best_roc:.4f})")

    # -----------------------------------------------------------------------
    # Step 5: Hyperparameter tuning for XGBoost
    # -----------------------------------------------------------------------
    print("\nRunning RandomizedSearchCV for XGBoost...")
    param_dist = {
        "n_estimators": [50, 100, 200, 300],
        "max_depth": [3, 4, 5, 6, 8],
        "learning_rate": [0.01, 0.05, 0.1, 0.2],
        "subsample": [0.6, 0.8, 1.0],
    }
    xgb_tune = XGBClassifier(random_state=RANDOM_STATE)
    search = RandomizedSearchCV(
        xgb_tune,
        param_distributions=param_dist,
        n_iter=20,
        cv=5,
        scoring="roc_auc",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    search.fit(X_train_resampled, y_train_resampled)
    best_xgb = search.best_estimator_
    y_pred_best = best_xgb.predict(X_test)
    y_proba_best = best_xgb.predict_proba(X_test)[:, 1]
    tune_metrics = get_metrics(y_test, y_pred_best, y_proba_best)

    # Log tuned XGBoost run to MLflow
    with mlflow.start_run(run_name="XGBoost_tuned"):
        mlflow.log_param("model_name", "XGBoost_tuned")
        for k, v in search.best_params_.items():
            mlflow.log_param(f"best_{k}", v)
        for k, v in tune_metrics.items():
            mlflow.log_metric(k, v)
        mlflow.sklearn.log_model(best_xgb, "model")

    # Overall best: compare baseline best vs tuned XGBoost
    if tune_metrics["roc_auc"] > best_roc:
        final_model = best_xgb
        best_name = "XGBoost_tuned"
        print(f"  Using tuned XGBoost (ROC-AUC: {tune_metrics['roc_auc']:.4f})")
    else:
        print(f"  Keeping {best_name} as best (tuned XGBoost did not improve)")

    # -----------------------------------------------------------------------
    # Step 8: Save best model and feature columns for API
    # -----------------------------------------------------------------------
    os.makedirs(MODELS_DIR, exist_ok=True)
    model_path = os.path.join(MODELS_DIR, "churn_model.joblib")
    joblib.dump(final_model, model_path)
    print(f"\nSaved best model to {model_path}")

    feature_columns_path = os.path.join(MODELS_DIR, "feature_columns.json")
    with open(feature_columns_path, "w") as f:
        json.dump(feature_columns, f, indent=2)
    print(f"Saved feature columns to {feature_columns_path}")

    print("\nDone. Next: run src/evaluate.py for SHAP explainability, then api/main.py for the API.")


if __name__ == "__main__":
    main()
