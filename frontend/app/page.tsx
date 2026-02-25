"use client";

import { useState, useCallback } from "react";

const API_URL = "http://localhost:8000";

type PredictResponse = {
  churn_probability: number;
  prediction: string;
  confidence: string;
};

/* ---- Donut gauge (SVG) ------------------------------------------- */
function DonutGauge({
  value,
  size = 176,
  stroke = 14,
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-4xl font-semibold tracking-tight"
          style={{ color }}
        >
          {value}
        </span>
        <span className="text-[11px] text-slate-400 -mt-0.5 tracking-wide">
          % risk
        </span>
      </div>
    </div>
  );
}

/* ---- Tooltip ------------------------------------------------------ */
function Tip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <span className="tooltip-trigger">
      {children}
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

/* ---- Helpers ------------------------------------------------------ */
function riskColor(pct: number) {
  if (pct < 30)
    return {
      hex: "#059669",
      label: "Low Risk",
      cls: "text-emerald-600 bg-emerald-50 border-emerald-200",
    };
  if (pct < 60)
    return {
      hex: "#D97706",
      label: "Medium Risk",
      cls: "text-amber-600 bg-amber-50 border-amber-200",
    };
  return {
    hex: "#DC2626",
    label: "High Risk",
    cls: "text-red-600 bg-red-50 border-red-200",
  };
}

/* =================================================================== */
/*  MAIN PAGE                                                          */
/* =================================================================== */
export default function Home() {
  // Form state (start empty)
  const [tenure, setTenure] = useState("");
  const [monthlyCharges, setMonthlyCharges] = useState("");
  const [contract, setContract] = useState("");
  const [internetService, setInternetService] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [techSupport, setTechSupport] = useState("");
  const [onlineSecurity, setOnlineSecurity] = useState("");
  const [paperlessBilling, setPaperlessBilling] = useState("");

  // Progress tracking
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const touch = useCallback(
    (f: string) =>
      setTouched((prev) => {
        const s = new Set(prev);
        s.add(f);
        return s;
      }),
    [],
  );
  const progress = Math.round((touched.size / 8) * 100);
  const isFormComplete =
    tenure !== "" &&
    monthlyCharges !== "" &&
    contract !== "" &&
    internetService !== "" &&
    paymentMethod !== "" &&
    techSupport !== "" &&
    onlineSecurity !== "" &&
    paperlessBilling !== "";

  // Prediction state
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  const displayPct = result ? Math.round(result.churn_probability * 100) : 0;
  const rc = riskColor(displayPct);

  // Risk factor breakdown (shown only after prediction)
  function getRiskFactors() {
    if (!result) return [];
    type Factor = { label: string; weight: number; isRisk: boolean };
    const factors: Factor[] = [];

    if (contract === "Month-to-month")
      factors.push({ label: "Month-to-month contract", weight: 0.88, isRisk: true });
    else if (contract === "One year")
      factors.push({ label: "One year contract", weight: 0.35, isRisk: false });
    else if (contract)
      factors.push({ label: "Two year contract", weight: 0.08, isRisk: false });

    const t = parseInt(tenure) || 0;
    const tenureRisk = Math.max(0, 1 - t / 48);
    factors.push({ label: `${t} mo tenure`, weight: parseFloat(tenureRisk.toFixed(2)), isRisk: tenureRisk > 0.5 });

    const mc = parseFloat(monthlyCharges) || 0;
    const chgRisk = Math.min(1, mc / 110);
    factors.push({ label: `$${mc}/mo charges`, weight: parseFloat(chgRisk.toFixed(2)), isRisk: chgRisk > 0.55 });

    if (internetService === "Fiber optic")
      factors.push({ label: "Fiber optic internet", weight: 0.72, isRisk: true });
    else if (internetService === "DSL")
      factors.push({ label: "DSL internet", weight: 0.22, isRisk: false });
    else if (internetService)
      factors.push({ label: "No internet", weight: 0.08, isRisk: false });

    if (paymentMethod === "Electronic check")
      factors.push({ label: "Electronic check", weight: 0.78, isRisk: true });
    else if (paymentMethod)
      factors.push({ label: paymentMethod.split(" (")[0], weight: 0.15, isRisk: false });

    if (techSupport === "No")
      factors.push({ label: "No tech support", weight: 0.65, isRisk: true });
    else if (techSupport)
      factors.push({ label: "Has tech support", weight: 0.08, isRisk: false });

    if (onlineSecurity === "No")
      factors.push({ label: "No online security", weight: 0.58, isRisk: true });
    else if (onlineSecurity)
      factors.push({ label: "Has online security", weight: 0.08, isRisk: false });

    if (paperlessBilling === "Yes")
      factors.push({ label: "Paperless billing", weight: 0.48, isRisk: true });
    else if (paperlessBilling)
      factors.push({ label: "Paper billing", weight: 0.1, isRisk: false });

    factors.sort((a, b) => b.weight - a.weight);
    return factors;
  }

  // Submit handler
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
      setResult(await res.json());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(
        msg.includes("fetch") || msg.includes("Failed") || msg.includes("Network")
          ? "Can't reach the prediction service. Make sure the API is running on port 8000."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setShowExplainer(false);
  }

  // Risk signal helpers for amber glow on dropdowns
  const isContractRisk = contract === "Month-to-month";
  const isPaymentRisk = paymentMethod === "Electronic check";
  const isInternetRisk = internetService === "Fiber optic";

  // Shared classnames
  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all duration-200";
  const labelBase =
    "flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1";
  const riskCls = (on: boolean) => (on ? "select-risk-high" : "");

  /* ---- RENDER ----------------------------------------------------- */
  return (
    <main className="h-screen flex flex-col overflow-hidden bg-[#F7F6F3]">
      {/* Header bar */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            className="shrink-0"
          >
            <rect x="2" y="16" width="5" height="10" rx="1.5" fill="#818CF8" />
            <rect x="9" y="10" width="5" height="16" rx="1.5" fill="#6366F1" />
            <rect x="16" y="4" width="5" height="22" rx="1.5" fill="#4F46E5" />
            <rect x="23" y="8" width="3" height="18" rx="1.5" fill="#818CF8" opacity="0.5" />
          </svg>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight">
              Churn Prediction
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Estimate customer churn risk from profile attributes
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="hidden sm:flex items-center gap-3">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            Fields reviewed
          </span>
          <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {touched.size}/8
          </span>
        </div>
      </header>

      {/* Body grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-5 p-5 overflow-auto">
        {/* ---- Left column: Form card (3/5) ---- */}
        <section className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-7">
            {/* -- Billing & Tenure -- */}
            <div>
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-800 mb-5">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-base">
                  💳
                </span>
                Billing &amp; Tenure
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Tenure */}
                <div>
                  <label className={labelBase}>
                    Tenure
                    <Tip text="How long the customer has been with the company. Shorter tenure strongly correlates with higher churn risk.">
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] text-slate-400 cursor-help font-bold">
                        ?
                      </span>
                    </Tip>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={72}
                      value={tenure || "0"}
                      onChange={(e) => {
                        setTenure(e.target.value);
                        touch("tenure");
                      }}
                      className="flex-1"
                    />
                    <div className="flex items-baseline gap-1 min-w-[70px]">
                      <input
                        type="number"
                        min={0}
                        max={72}
                        value={tenure}
                        placeholder="0"
                        onChange={(e) => {
                          setTenure(e.target.value);
                          touch("tenure");
                        }}
                        className="w-12 text-right font-mono text-sm border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-200 transition-all"
                      />
                      <span className="text-[10px] text-slate-400">mo</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    {tenure ? `${parseInt(tenure)} months` : "\u2014"}
                  </p>
                </div>

                {/* Monthly Charges */}
                <div>
                  <label className={labelBase}>
                    Monthly Charges
                    <Tip text="Higher monthly charges increase churn likelihood, especially without a long-term contract commitment.">
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] text-slate-400 cursor-help font-bold">
                        ?
                      </span>
                    </Tip>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={150}
                      step={0.5}
                      value={monthlyCharges || "0"}
                      onChange={(e) => {
                        setMonthlyCharges(e.target.value);
                        touch("monthlyCharges");
                      }}
                      className="flex-1"
                    />
                    <div className="flex items-baseline gap-1 min-w-[70px]">
                      <span className="text-[10px] text-slate-400">$</span>
                      <input
                        type="number"
                        min={0}
                        max={150}
                        step={0.01}
                        value={monthlyCharges}
                        placeholder="0"
                        onChange={(e) => {
                          setMonthlyCharges(e.target.value);
                          touch("monthlyCharges");
                        }}
                        className="w-14 text-right font-mono text-sm border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-200 transition-all"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    {monthlyCharges ? `$${parseFloat(monthlyCharges)}/mo` : "\u2014"}
                  </p>
                </div>

                {/* Contract */}
                <div>
                  <label className={labelBase}>
                    Contract
                    <Tip text="Month-to-month contracts are the single strongest churn predictor. Longer commitments dramatically reduce risk.">
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] text-slate-400 cursor-help font-bold">
                        ?
                      </span>
                    </Tip>
                  </label>
                  <select
                    value={contract}
                    onChange={(e) => {
                      setContract(e.target.value);
                      touch("contract");
                    }}
                    className={`${inputBase} ${riskCls(isContractRisk)} ${contract === "" ? "text-slate-400" : ""}`}
                  >
                    <option value="" disabled>Select contract type</option>
                    <option value="Month-to-month">Month-to-month</option>
                    <option value="One year">One year</option>
                    <option value="Two year">Two year</option>
                  </select>
                </div>

                {/* Payment Method */}
                <div>
                  <label className={labelBase}>
                    Payment Method
                    <Tip text="Electronic check users churn at roughly 2x the rate of auto-pay customers.">
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] text-slate-400 cursor-help font-bold">
                        ?
                      </span>
                    </Tip>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value);
                      touch("paymentMethod");
                    }}
                    className={`${inputBase} ${riskCls(isPaymentRisk)} ${paymentMethod === "" ? "text-slate-400" : ""}`}
                  >
                    <option value="" disabled>Select payment method</option>
                    <option value="Electronic check">Electronic check</option>
                    <option value="Mailed check">Mailed check</option>
                    <option value="Bank transfer (automatic)">Bank transfer (automatic)</option>
                    <option value="Credit card (automatic)">Credit card (automatic)</option>
                  </select>
                </div>

                {/* Paperless Billing */}
                <div className="sm:col-span-2">
                  <label className={labelBase}>
                    Paperless Billing
                    <Tip text="Paperless billing customers show slightly higher churn, possibly due to lower bill engagement.">
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] text-slate-400 cursor-help font-bold">
                        ?
                      </span>
                    </Tip>
                  </label>
                  <select
                    value={paperlessBilling}
                    onChange={(e) => {
                      setPaperlessBilling(e.target.value);
                      touch("paperlessBilling");
                    }}
                    className={`${inputBase} ${paperlessBilling === "" ? "text-slate-400" : ""}`}
                  >
                    <option value="" disabled>Select option</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* -- Services -- */}
            <div>
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-800 mb-5">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-base">
                  🌐
                </span>
                Services
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* Internet Service */}
                <div>
                  <label className={labelBase}>
                    Internet Service
                    <Tip text="Fiber optic customers churn more - likely due to higher costs and competitive fiber alternatives.">
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] text-slate-400 cursor-help font-bold">
                        ?
                      </span>
                    </Tip>
                  </label>
                  <select
                    value={internetService}
                    onChange={(e) => {
                      setInternetService(e.target.value);
                      touch("internetService");
                    }}
                    className={`${inputBase} ${riskCls(isInternetRisk)} ${internetService === "" ? "text-slate-400" : ""}`}
                  >
                    <option value="" disabled>Select service</option>
                    <option value="DSL">DSL</option>
                    <option value="Fiber optic">Fiber optic</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {/* Tech Support */}
                <div>
                  <label className={labelBase}>
                    Tech Support
                    <Tip text="Customers without tech support are significantly more likely to churn due to unresolved issues.">
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] text-slate-400 cursor-help font-bold">
                        ?
                      </span>
                    </Tip>
                  </label>
                  <select
                    value={techSupport}
                    onChange={(e) => {
                      setTechSupport(e.target.value);
                      touch("techSupport");
                    }}
                    className={`${inputBase} ${riskCls(techSupport === "No")} ${techSupport === "" ? "text-slate-400" : ""}`}
                  >
                    <option value="" disabled>Select option</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {/* Online Security */}
                <div>
                  <label className={labelBase}>
                    Online Security
                    <Tip text="Online security adds perceived value. Customers without it tend to feel less invested in the service.">
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 text-[9px] text-slate-400 cursor-help font-bold">
                        ?
                      </span>
                    </Tip>
                  </label>
                  <select
                    value={onlineSecurity}
                    onChange={(e) => {
                      setOnlineSecurity(e.target.value);
                      touch("onlineSecurity");
                    }}
                    className={`${inputBase} ${riskCls(onlineSecurity === "No")} ${onlineSecurity === "" ? "text-slate-400" : ""}`}
                  >
                    <option value="" disabled>Select option</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !isFormComplete}
              className="w-full rounded-xl bg-navy-800 text-white py-3 text-sm font-display font-semibold tracking-wide hover:bg-navy-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="spinner inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Analyzing...
                </>
              ) : (
                "Predict Churn Risk"
              )}
            </button>

            {/* Error */}
            {error && (
              <div
                className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-800 text-xs flex items-start gap-2"
                role="alert"
              >
                <span className="shrink-0 mt-0.5">&#9888;</span>
                <div>
                  <p className="font-medium">Request failed</p>
                  <p className="mt-0.5 text-red-600">{error}</p>
                </div>
              </div>
            )}
          </form>
        </section>

        {/* ---- Right column: Results (2/5) ---- */}
        <section className="lg:col-span-2 flex flex-col gap-5">
          {/* Gauge card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-5">
              <h2 className="font-display text-sm font-semibold text-slate-800">
                {result ? "Prediction Result" : "Risk Assessment"}
              </h2>
              {result && (
                <button
                  onClick={handleReset}
                  className="text-[10px] text-slate-400 hover:text-slate-600 underline transition-colors duration-200"
                >
                  Reset
                </button>
              )}
            </div>

            {!result ? (
              <div className="flex flex-col items-center py-8 gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500 text-center max-w-[220px] leading-relaxed">
                  Fill in the customer details and click{" "}
                  <strong className="text-slate-700">Predict Churn Risk</strong>{" "}
                  to see the result
                </p>
                <div className="flex gap-1.5 mt-1">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                        i < touched.size ? "bg-indigo-400" : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  {touched.size}/8 fields completed
                </p>
              </div>
            ) : (
              <>
                <DonutGauge value={displayPct} color={rc.hex} />

                <div className="mt-4 flex flex-col items-center gap-1.5">
                  <span
                    className={`inline-flex px-3.5 py-1 rounded-full text-xs font-semibold border ${rc.cls}`}
                  >
                    {rc.label}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Confidence:{" "}
                    <span className="font-mono font-medium text-slate-600">
                      {result.confidence}
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Risk factor breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1">
            <h3 className="font-display text-sm font-semibold text-slate-800 mb-4">
              Risk Factor Breakdown
            </h3>
            {!result ? (
              <div className="flex flex-col items-center py-4 gap-2">
                <p className="text-xs text-slate-400 text-center">
                  Risk factors will appear here after prediction
                </p>
                <div className="w-full space-y-2.5 mt-3 opacity-20">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <span className="h-2 bg-slate-200 rounded w-24" />
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full" />
                      <span className="h-2 bg-slate-200 rounded w-6" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {getRiskFactors().map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        f.isRisk ? "bg-red-400" : "bg-emerald-400"
                      }`}
                    />
                    <span className="text-xs text-slate-600 w-40 truncate">
                      {f.label}
                    </span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          f.isRisk ? "bg-red-400" : "bg-emerald-400"
                        }`}
                        style={{ width: `${Math.round(f.weight * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 w-8 text-right tabular-nums">
                      {Math.round(f.weight * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* What does this mean? */}
          {result && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <button
                onClick={() => setShowExplainer(!showExplainer)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-display font-medium text-slate-700 hover:bg-slate-50/80 transition-colors duration-200"
              >
                <span>What does this mean?</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={`transform transition-transform duration-200 ${
                    showExplainer ? "rotate-180" : ""
                  }`}
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div
                className={`expandable-content ${showExplainer ? "open" : ""}`}
              >
                <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed space-y-2.5">
                  {displayPct >= 60 ? (
                    <>
                      <p>
                        This customer profile has a{" "}
                        <strong className="text-red-600">high churn risk</strong>.
                        Key contributing factors include short tenure,
                        month-to-month contract, and limited support services.
                      </p>
                      <p>
                        <strong>Recommended actions:</strong> Consider offering a
                        discounted long-term contract, bundled services, or
                        proactive tech support outreach to improve retention.
                      </p>
                    </>
                  ) : displayPct >= 30 ? (
                    <>
                      <p>
                        This customer has a{" "}
                        <strong className="text-amber-600">moderate churn risk</strong>.
                        Some risk signals are present, but protective factors
                        partially offset them.
                      </p>
                      <p>
                        <strong>Recommended actions:</strong> Monitor engagement
                        metrics and consider targeted loyalty offers to
                        strengthen retention.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        This customer has a{" "}
                        <strong className="text-emerald-600">low churn risk</strong>.
                        Their profile includes several retention-positive factors
                        such as longer tenure or annual contracts.
                      </p>
                      <p>
                        <strong>Recommended actions:</strong> Maintain current
                        service quality and consider upsell opportunities for
                        premium services.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
