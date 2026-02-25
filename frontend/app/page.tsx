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
      const message = err instanceof Error ? err.message : "Something went wrong";
      if (message.includes("fetch") || message.includes("Failed") || message.includes("Network")) {
        setError("Can't reach the prediction service. Make sure the API is running on port 8000 (uvicorn api.main:app --reload).");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  const isChurn = result ? result.prediction === "Likely to Churn" : false;
  const confidencePct =
    result?.confidence === "High"
      ? 90
      : result?.confidence === "Medium"
        ? 65
        : 40;
  const interpretation = result
    ? isChurn
      ? "Consider reaching out with a retention offer or support."
      : "This customer profile shows lower churn risk."
    : "";

  const inputClass =
    "w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-200 transition-colors";
  const labelClass = "block text-xs font-medium text-slate-700 mb-0.5";
  const hintClass = "text-[10px] text-slate-500 mt-0.5";

  return (
    <main className="h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Header - compact */}
      <header className="shrink-0 text-center py-3 px-4 border-b border-slate-200/80 bg-white/60">
        <h1 className="text-lg font-bold text-slate-800">
          Customer Churn Prediction
        </h1>
        <p className="text-slate-600 text-xs max-w-md mx-auto">
          Enter customer details below. The model will estimate churn likelihood.
        </p>
      </header>

      {/* Single-view content: form left, result right */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden">
        {/* Form card - scroll only if needed on small screens */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 overflow-auto min-h-0 flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 flex-1 min-h-0">
              {/* Billing & tenure */}
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide sticky top-0 bg-white py-0.5">
                  Billing & tenure
                </h2>
                <div>
                  <label htmlFor="tenure" className={labelClass}>Tenure (months)</label>
                  <input
                    id="tenure"
                    type="number"
                    min={0}
                    value={tenure}
                    onChange={(e) => setTenure(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 12"
                    required
                  />
                  <p className={hintClass}>Months with company.</p>
                </div>
                <div>
                  <label htmlFor="monthlyCharges" className={labelClass}>Monthly charges ($)</label>
                  <input
                    id="monthlyCharges"
                    type="number"
                    min={0}
                    step={0.01}
                    value={monthlyCharges}
                    onChange={(e) => setMonthlyCharges(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 65.50"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="contract" className={labelClass}>Contract type</label>
                  <select id="contract" value={contract} onChange={(e) => setContract(e.target.value)} className={inputClass}>
                    <option value="Month-to-month">Month-to-month</option>
                    <option value="One year">One year</option>
                    <option value="Two year">Two year</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="paymentMethod" className={labelClass}>Payment method</label>
                  <select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                    <option value="Electronic check">Electronic check</option>
                    <option value="Mailed check">Mailed check</option>
                    <option value="Bank transfer (automatic)">Bank transfer (automatic)</option>
                    <option value="Credit card (automatic)">Credit card (automatic)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="paperlessBilling" className={labelClass}>Paperless billing</label>
                  <select id="paperlessBilling" value={paperlessBilling} onChange={(e) => setPaperlessBilling(e.target.value)} className={inputClass}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              {/* Services */}
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide sticky top-0 bg-white py-0.5">
                  Services
                </h2>
                <div>
                  <label htmlFor="internetService" className={labelClass}>Internet service</label>
                  <select id="internetService" value={internetService} onChange={(e) => setInternetService(e.target.value)} className={inputClass}>
                    <option value="DSL">DSL</option>
                    <option value="Fiber optic">Fiber optic</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="techSupport" className={labelClass}>Tech support</label>
                  <select id="techSupport" value={techSupport} onChange={(e) => setTechSupport(e.target.value)} className={inputClass}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="onlineSecurity" className={labelClass}>Online security</label>
                  <select id="onlineSecurity" value={onlineSecurity} onChange={(e) => setOnlineSecurity(e.target.value)} className={inputClass}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 shrink-0">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-slate-800 text-white py-2.5 text-sm font-medium hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                    Predicting…
                  </>
                ) : (
                  "Predict churn risk"
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Right column: error, tip, or result - always visible in one view */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col min-h-0 overflow-auto">
          {error && (
            <div
              className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-800 text-xs flex items-start gap-2"
              role="alert"
            >
              <span className="text-red-500 shrink-0" aria-hidden>⚠️</span>
              <div>
                <p className="font-medium">Request failed</p>
                <p className="mt-0.5 text-red-700">{error}</p>
              </div>
            </div>
          )}

          {!result && !error && !loading && (
            <p className="text-slate-500 text-sm py-4">
              Fill in the form and click &quot;Predict churn risk&quot; to see the result here.
            </p>
          )}

          {result && (
            <div className="flex flex-col" aria-live="polite">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold text-slate-800">Prediction result</h2>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-700 underline focus:outline-none focus:ring-2 focus:ring-slate-400 rounded"
                >
                  Try another
                </button>
              </div>
              <p className="text-xs text-slate-600 mb-3">{interpretation}</p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-slate-800">
                  {(result.churn_probability * 100).toFixed(0)}%
                </span>
                <span className="text-slate-500 text-xs">churn probability</span>
              </div>
              <span
                className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium w-fit ${
                  isChurn ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                }`}
              >
                {result.prediction}
              </span>
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-1">Model confidence: {result.confidence}</p>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-600 transition-all duration-500"
                    style={{ width: `${confidencePct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
