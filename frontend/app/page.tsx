"use client";

import { useState } from "react";

const API_URL = "http://localhost:8000";

type PredictResponse = {
  churn_probability: number;
  prediction: string;
  confidence: string;
};

export default function Home() {
  const [tenure, setTenure] = useState<string>("12");
  const [monthlyCharges, setMonthlyCharges] = useState<string>("70");
  const [contract, setContract] = useState<string>("Month-to-month");
  const [internetService, setInternetService] = useState<string>("Fiber optic");
  const [paymentMethod, setPaymentMethod] = useState<string>("Electronic check");
  const [techSupport, setTechSupport] = useState<string>("No");
  const [onlineSecurity, setOnlineSecurity] = useState<string>("No");
  const [paperlessBilling, setPaperlessBilling] = useState<string>("Yes");

  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenure: parseInt(tenure, 10),
          monthly_charges: parseFloat(monthlyCharges),
          contract,
          internet_service: internetService,
          payment_method: paymentMethod,
          paperless_billing: paperlessBilling,
          tech_support: techSupport,
          online_security: onlineSecurity,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Request failed: ${res.status}`);
      }
      const data: PredictResponse = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const isChurn = result ? result.prediction === "Likely to Churn" : false;
  const confidencePct =
    result?.confidence === "High"
      ? 90
      : result?.confidence === "Medium"
        ? 65
        : 40;

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-800 mb-2">
        Customer Churn Prediction
      </h1>
      <p className="text-slate-600 text-sm mb-6">
        Enter customer details to see churn probability.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tenure (months)
          </label>
          <input
            type="number"
            min={0}
            value={tenure}
            onChange={(e) => setTenure(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-slate-800"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Monthly Charges ($)
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={monthlyCharges}
            onChange={(e) => setMonthlyCharges(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-slate-800"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Contract Type
          </label>
          <select
            value={contract}
            onChange={(e) => setContract(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-slate-800"
          >
            <option value="Month-to-month">Month-to-month</option>
            <option value="One year">One year</option>
            <option value="Two year">Two year</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Internet Service
          </label>
          <select
            value={internetService}
            onChange={(e) => setInternetService(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-slate-800"
          >
            <option value="DSL">DSL</option>
            <option value="Fiber optic">Fiber optic</option>
            <option value="No">No</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-slate-800"
          >
            <option value="Electronic check">Electronic check</option>
            <option value="Mailed check">Mailed check</option>
            <option value="Bank transfer (automatic)">Bank transfer (automatic)</option>
            <option value="Credit card (automatic)">Credit card (automatic)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tech Support
          </label>
          <select
            value={techSupport}
            onChange={(e) => setTechSupport(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-slate-800"
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Online Security
          </label>
          <select
            value={onlineSecurity}
            onChange={(e) => setOnlineSecurity(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-slate-800"
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Paperless Billing
          </label>
          <select
            value={paperlessBilling}
            onChange={(e) => setPaperlessBilling(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-slate-800"
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-800 text-white py-2.5 font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Predicting…" : "Predict Churn"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 p-4 rounded-lg border border-slate-200 bg-white shadow-sm">
          <p className="text-sm font-medium text-slate-600 mb-1">
            Churn probability
          </p>
          <p className="text-2xl font-semibold text-slate-800 mb-3">
            {(result.churn_probability * 100).toFixed(0)}%
          </p>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              isChurn
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {result.prediction}
          </span>
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-1">Confidence: {result.confidence}</p>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-600 transition-all"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
