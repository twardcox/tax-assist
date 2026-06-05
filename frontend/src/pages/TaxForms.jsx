import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function dollar(v) {
  if (!v && v !== 0) return "—";
  const n = Number(v);
  if (n === 0) return "—";
  return n < 0
    ? `(${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })})`
    : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function pct(v) {
  return v != null ? `${Number(v).toFixed(1)}%` : "—";
}

// ── Section / line primitives ─────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-gray-200">{title}</span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-xs text-gray-400 font-mono">{badge}</span>
          )}
          <span className="text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && <div className="divide-y divide-gray-800/60">{children}</div>}
    </div>
  );
}

function Line({ line, label, value, indent = false, bold = false, highlight, cpa, note }) {
  const valColor =
    highlight === "income"   ? "text-gray-100" :
    highlight === "deduct"   ? "text-emerald-400" :
    highlight === "tax"      ? "text-amber-400" :
    highlight === "credit"   ? "text-sky-400" :
    highlight === "payment"  ? "text-violet-400" :
    highlight === "total"    ? "text-white" :
    highlight === "refund"   ? "text-emerald-300" :
    highlight === "owed"     ? "text-red-400" :
    "text-gray-300";

  return (
    <div className={`flex items-baseline gap-3 px-4 py-1.5 ${bold ? "bg-gray-900/60" : ""}`}>
      <span className="w-8 flex-shrink-0 text-right text-[10px] text-gray-600 font-mono">{line || ""}</span>
      <span className={`flex-1 text-xs ${indent ? "pl-4" : ""} ${bold ? "font-semibold text-gray-200" : "text-gray-400"}`}>
        {label}
        {cpa && <span className="ml-2 text-[10px] text-amber-500 font-semibold">[CPA REVIEW]</span>}
        {note && <span className="ml-2 text-[10px] text-gray-600 italic">{note}</span>}
      </span>
      <span className={`text-xs font-mono text-right min-w-[90px] ${valColor} ${bold ? "font-bold" : ""}`}>
        {value != null ? (typeof value === "number" ? dollar(value) : value) : "—"}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-800 my-0.5" />;
}

// ── Sub-views for each schedule ───────────────────────────────────────────────

function Form1040View({ c, fs }) {
  const w2s = c.w2_records || [];
  return (
    <Section title="Form 1040 — U.S. Individual Income Tax Return" badge={dollar(c.total_tax) + " total tax"}>

      {w2s.length > 0 && (
        <div className="px-4 py-2 bg-gray-900/30">
          <p className="text-[11px] text-gray-500 mb-1 font-semibold uppercase tracking-wide">W-2 Employers</p>
          {w2s.map((w, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-400 py-0.5">
              <span>{w.employer_name || `Employer ${i + 1}`}</span>
              <span className="font-mono">${Number(w.wages || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <Line line="1a" label="Wages, salaries, tips" value={c.wages} highlight="income" />
      <Line line="2b" label="Taxable interest" value={c.taxable_interest} />
      <Line line="3a" label="Qualified dividends" value={c.qualified_dividends} indent />
      <Line line="3b" label="Ordinary dividends" value={c.ordinary_dividends} />
      <Line line="4a" label="IRA distributions — gross" value={c.ira_gross} indent />
      <Line line="4b" label="IRA distributions — taxable" value={c.ira_taxable} />
      <Line line="5a" label="Pensions & annuities — gross" value={c.pension_gross} indent />
      <Line line="5b" label="Pensions & annuities — taxable" value={c.pension_taxable} cpa />
      <Line line="6a" label="Social security benefits — gross" value={c.ss_gross} indent />
      <Line line="6b" label="Social security benefits — taxable" value={c.ss_taxable} note="IRC §86 combined income rule" />
      <Line line="7"  label={"Capital gain / (loss)  [ST: " + dollar(c.stcg) + "  LT: " + dollar(c.ltcg) + "]"} value={c.capital_gains_net} />
      <Line line="8"  label="Other income (Schedule 1)" value={c.schedule1_additional} />
      <Divider />
      <Line line="9"  label="TOTAL INCOME" value={c.total_income} bold highlight="total" />

      <div className="px-4 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Adjustments to Income</div>
      <Line line="" label="½ self-employment tax" value={c.se_tax_deduction} indent />
      <Line line="" label="Self-employed health insurance" value={c.se_health_insurance} indent />
      <Line line="" label="Student loan interest" value={c.student_loan_interest} indent />
      <Line line="" label="Educator expenses" value={c.educator_expenses} indent />
      <Line line="" label="HSA contributions (outside payroll)" value={c.hsa_outside_payroll} indent />
      <Line line="" label="IRA deduction" value={c.ira_deduction} indent />
      <Line line="" label="Alimony paid (pre-2019)" value={c.alimony_paid} indent cpa />
      <Line line="" label="Military moving expenses" value={c.moving_expenses_military} indent />
      <Divider />
      <Line line="10" label="TOTAL ADJUSTMENTS" value={c.total_adjustments} bold highlight="deduct" />
      <Line line="11" label="ADJUSTED GROSS INCOME (AGI)" value={c.agi} bold highlight="total" />

      <div className="px-4 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Deductions</div>
      {c.using_standard ? (
        <Line line="12" label={`Standard deduction (${fs})`} value={c.standard_deduction} highlight="deduct" />
      ) : (
        <Line line="12" label="Itemized deductions (Schedule A)" value={c.itemized} highlight="deduct" />
      )}
      <Line line="13" label="Qualified Business Income deduction (§199A)" value={c.qbi_deduction} highlight="deduct" note="simplified" />
      <Divider />
      <Line line="15" label="TAXABLE INCOME" value={c.taxable_income} bold highlight="total" />

      <div className="px-4 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Tax</div>
      <Line line="16" label="Ordinary income tax" value={c.ordinary_tax} highlight="tax" />
      <Line line=""   label="Long-term capital gains / qualified dividends tax" value={c.ltcg_tax} highlight="tax" indent />
      <Line line=""   label="Additional Medicare Tax (0.9%)" value={c.addl_medicare_tax} highlight="tax" indent />
      <Line line=""   label="Net Investment Income Tax (3.8%)" value={c.niit} highlight="tax" indent />
      <Line line="17" label="INCOME TAX BEFORE CREDITS" value={c.income_tax_before_credits} bold highlight="tax" />

      <div className="px-4 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Credits</div>
      <Line line="19" label={`Child Tax Credit (${c.qualifying_children || 0} children × $${(c.p_ctc || 2000).toLocaleString()})`} value={c.child_tax_credit} highlight="credit" />
      <Line line=""   label="Credit for other dependents" value={c.other_dependent_credit} highlight="credit" indent />
      <Line line=""   label={`Child & Dependent Care Credit (expenses: ${dollar(c.care_expenses)})`} value={c.child_care_credit} highlight="credit" indent />
      <Line line=""   label={`Education credit (tuition: ${dollar(c.tuition_expenses)})`} value={c.education_credit} highlight="credit" indent cpa />
      <Line line=""   label="Clean Vehicle Credit (§30D)" value={c.ev_credit} highlight="credit" indent cpa />
      <Divider />
      <Line line="21" label="TOTAL CREDITS" value={c.total_credits} bold highlight="credit" />
      <Line line=""   label="Income tax after credits" value={c.income_tax_after_credits} bold />
      <Line line=""   label="Self-employment tax (Schedule SE)" value={c.se_tax} highlight="tax" />
      <Divider />
      <Line line="24" label="TOTAL TAX" value={c.total_tax} bold highlight="total" />

      <div className="px-4 py-2 text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Payments</div>
      <Line line="25" label="Federal income tax withheld (W-2)" value={c.w2_withholding} highlight="payment" />
      <Line line="26" label="Estimated tax payments" value={c.estimated_tax_payments} highlight="payment" />
      <Divider />
      <Line line="33" label="TOTAL PAYMENTS" value={c.total_payments} bold highlight="payment" />
      <Divider />
      {c.refund > 0 ? (
        <Line line="34" label="REFUND" value={c.refund} bold highlight="refund" />
      ) : (
        <Line line="37" label="AMOUNT OWED" value={c.amount_owed} bold highlight="owed" />
      )}
    </Section>
  );
}

function ScheduleAView({ c }) {
  if (!c._need_sch_a && (c.itemized || 0) === 0) return null;
  return (
    <Section
      title="Schedule A — Itemized Deductions"
      badge={c.using_standard ? "not used (std > itemized)" : dollar(c.itemized)}
      defaultOpen={!c.using_standard}
    >
      {c.using_standard && (
        <div className="px-4 py-2 text-xs text-amber-600">
          Standard deduction (${(c.standard_deduction || 0).toLocaleString()}) exceeds itemized total. Detail shown for CPA review.
        </div>
      )}
      <Line line="1"  label="Medical and dental expenses (total)" value={c.medical_total} />
      <Line line="3"  label="Medical above 7.5% AGI floor" value={c.medical_deductible} indent highlight="deduct" />
      <Line line="5e" label="State & local income taxes withheld" value={c.state_tax_paid} />
      <Line line="5b" label="Real estate taxes" value={c.prop_tax_paid} />
      <Line line="5d" label="SALT total (capped $10,000 / $5,000 MFS)" value={c.salt} bold highlight="deduct" />
      <Line line="8a" label="Home mortgage interest" value={c.mortgage_interest} highlight="deduct" cpa note="Form 1098 required" />
      <Line line="12" label="Charitable contributions" value={c.charitable} highlight="deduct" cpa note="written acknowledgment ≥ $250" />
      <Divider />
      <Line line="17" label="TOTAL ITEMIZED DEDUCTIONS" value={c.itemized} bold highlight="deduct" />
    </Section>
  );
}

function ScheduleBView({ c }) {
  if (!c._need_sch_b) return null;
  return (
    <Section title="Schedule B — Interest and Ordinary Dividends" defaultOpen={false}>
      <Line line="Part I"  label="Taxable interest" value={c.taxable_interest} highlight="income" />
      <Line line="Part II" label="Ordinary dividends" value={c.ordinary_dividends} highlight="income" />
      <Line line=""        label="  of which qualified dividends" value={c.qualified_dividends} indent />
      <div className="px-4 py-2 text-xs text-amber-600">
        [CPA REVIEW] Enter individual payer names and EINs. Complete Part III (foreign accounts / trusts).
      </div>
    </Section>
  );
}

function ScheduleCView({ c }) {
  if (!c._need_sch_c) return null;
  return (
    <>
      {(c.schedule_c_records || []).map((biz, i) => (
        <Section
          key={i}
          title={`Schedule C — ${biz.business_name || "Business " + (i + 1)}`}
          badge={dollar(biz.net_profit_loss)}
          defaultOpen={true}
        >
          <Line line="A"  label="Business name" value={biz.business_name} />
          <Line line="B"  label="Principal business code (NAICS)" value={biz.naics || "—"} cpa />
          <Line line="C"  label="Entity type" value={(biz.entity_type || "").replace(/_/g, " ")} />
          <Line line="D"  label="EIN" value={biz.ein || "—"} />
          <Line line="1"  label="Gross receipts / sales" value={biz.gross_revenue} highlight="income" />
          <Line line="28" label="Total expenses" value={biz.expenses} highlight="deduct" />
          <Divider />
          <Line line="31" label="Net profit / (loss)" value={biz.net_profit_loss} bold highlight="total" />
          {biz.home_office && (
            <div className="px-4 py-2 text-xs text-amber-600">
              [CPA REVIEW] Home office deduction may apply — Form 8829 required.
            </div>
          )}
          <div className="px-4 py-2 text-xs text-amber-600">
            [CPA REVIEW] Populate individual expense lines (Part II) from records and receipts.
            Business vehicle mileage logs required.
          </div>
        </Section>
      ))}
    </>
  );
}

function ScheduleDView({ c }) {
  if (!c._need_sch_d) return null;
  return (
    <Section title="Schedule D — Capital Gains and Losses" defaultOpen={false} badge={dollar(c.capital_gains_net)}>
      <Line line="Part I"  label="Short-term net gain / (loss)" value={c.stcg} highlight={c.stcg >= 0 ? "income" : "owed"} />
      <Line line="Part II" label="Long-term net gain / (loss)"  value={c.ltcg} highlight={c.ltcg >= 0 ? "credit" : "owed"} />
      <Divider />
      <Line line="16" label="Net capital gain / (loss)" value={c.capital_gains_net} bold highlight="total" />
      <div className="px-4 py-2 text-xs text-amber-600">
        [CPA REVIEW] Individual transactions must be reported on Form 8949. Provide brokerage 1099-B
        statements and cost-basis records. Wash-sale adjustments apply.
      </div>
    </Section>
  );
}

function ScheduleEView({ c }) {
  if (!c._need_sch_e) return null;
  return (
    <Section title="Schedule E — Supplemental Income and Loss (Rental)" defaultOpen={true} badge={dollar(c.schedule_e_net)}>
      {(c.schedule_e_records || []).map((p, i) => (
        <div key={i} className="border-b border-gray-800/50 last:border-0">
          <div className="px-4 pt-2 pb-1">
            <span className="text-xs text-gray-500 font-semibold">Property {i + 1}</span>
          </div>
          <Line line="A"  label="Address" value={p.property_address || "—"} />
          <Line line="3"  label="Gross rents received" value={Number(p.gross_rents || 0)} highlight="income" />
          <Line line="21" label="Net income / (loss)" value={Number(p.net_income_loss || 0)} bold highlight="total" />
        </div>
      ))}
      <Divider />
      <Line line="26" label="TOTAL RENTAL NET INCOME / (LOSS)" value={c.schedule_e_net} bold highlight="total" />
      <div className="px-4 py-2 text-xs text-amber-600">
        [CPA REVIEW] Itemized expense lines (advertising, insurance, repairs, depreciation, etc.)
        must be completed. Depreciation schedules and Form 4562 required if assets present.
      </div>
    </Section>
  );
}

function ScheduleSEView({ c }) {
  if (!c._need_sch_se) return null;
  const se_net = (c.schedule_c_profit || 0) * 0.9235;
  return (
    <Section title="Schedule SE — Self-Employment Tax" defaultOpen={true} badge={dollar(c.se_tax)}>
      <Line line="2" label="Net profit from Schedule C" value={c.schedule_c_profit} highlight="income" />
      <Line line="3" label="Net earnings subject to SE tax (× 0.9235)" value={se_net} />
      <Divider />
      <Line line="5" label="Self-employment tax (15.3%)" value={c.se_tax} bold highlight="tax" />
      <Line line="6" label="Deduction: ½ of SE tax (→ Schedule 1)" value={c.se_tax_deduction} highlight="deduct" />
    </Section>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ c, fs, taxYear }) {
  const isRefund = (c.refund || 0) > 0;
  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50 flex flex-col gap-2">
      <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Summary — TY {taxYear}</div>
      <div className="text-[11px] text-gray-500">{fs}</div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
        {[
          ["AGI",           dollar(c.agi),           "text-gray-300"],
          ["Taxable Inc.",  dollar(c.taxable_income), "text-gray-300"],
          ["Total Tax",     dollar(c.total_tax),      "text-amber-400"],
          ["Payments",      dollar(c.total_payments), "text-violet-400"],
          ["Effective",     pct(c.effective_rate),    "text-gray-400"],
          ["Marginal",      pct(c.marginal_rate),     "text-gray-400"],
        ].map(([label, val, cls]) => (
          <div key={label}>
            <div className="text-[10px] text-gray-600">{label}</div>
            <div className={`text-sm font-mono font-semibold ${cls}`}>{val}</div>
          </div>
        ))}
      </div>

      <div className={`mt-2 rounded px-3 py-2 text-center font-bold text-sm ${
        isRefund ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                 : "bg-red-900/40 text-red-300 border border-red-800"
      }`}>
        {isRefund ? "REFUND" : "AMOUNT DUE"}
        <span className="block text-lg">${((isRefund ? c.refund : c.amount_owed) || 0).toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── Download job widget ────────────────────────────────────────────────────────

function DownloadWidget({ taxYear }) {
  const [jobId,    setJobId]    = useState(null);
  const [status,   setStatus]   = useState(null);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    if (!jobId || status !== "running") return;
    const id = setInterval(async () => {
      try {
        const s = await api.getTaxFormsStatus(jobId);
        setProgress(s.progress || "");
        if (s.status !== "running") {
          setStatus(s.status);
          clearInterval(id);
        }
      } catch {
        setStatus("error");
        clearInterval(id);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [jobId, status]);

  async function start() {
    setStatus("running");
    setProgress("Starting…");
    try {
      const { job_id } = await api.generateTaxForms(taxYear);
      setJobId(job_id);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50 flex flex-col gap-2">
      <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Download Package</div>
      <p className="text-xs text-gray-500 leading-relaxed">
        ZIP containing the filled IRS PDFs (1040 + applicable schedules) and this data summary as a
        print-ready PDF. IRS forms are downloaded from irs.gov — takes ~15 seconds.
      </p>

      {status !== "complete" && (
        <button
          onClick={start}
          disabled={status === "running"}
          className="w-full bg-blue-800 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-semibold transition-colors"
        >
          {status === "running" ? "Building…" : "Build & Download ZIP"}
        </button>
      )}

      {status === "running" && progress && (
        <p className="text-xs text-gray-400 truncate" title={progress}>{progress}</p>
      )}

      {status === "complete" && jobId && (
        <>
          <a
            href={api.downloadTaxFormsUrl(jobId)}
            download
            className="block w-full text-center bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors"
          >
            Download ZIP
          </a>
          <button
            onClick={() => { setStatus(null); setJobId(null); setProgress(""); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Build again
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <p className="text-xs text-red-400">Build failed — check server logs.</p>
          <button
            onClick={() => setStatus(null)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TaxForms() {
  const [taxYear]   = useState(2025);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);

  const compute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.computeTaxForms(taxYear);
      setResult(data);
    } catch (e) {
      setError(e.message || "Computation failed");
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  const c  = result?.computed || {};
  const fs = result?.filing_status || "";

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)]">

      {/* ── Left: form review ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-white">Federal Tax Forms</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Tax Year {taxYear} — Review computed figures before sending to your CPA.
            </p>
          </div>
          <button
            onClick={compute}
            disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
          >
            {loading ? "Computing…" : result ? "Recompute" : "Compute Tax Figures"}
          </button>
        </div>

        {error && (
          <div className="border border-red-800 bg-red-900/20 rounded-lg p-4 mb-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-600">
            <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Click <strong className="text-gray-400">Compute Tax Figures</strong> to review your federal return.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-40 text-gray-500 text-sm gap-2">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
            Computing…
          </div>
        )}

        {result && !loading && (
          <div>
            <Form1040View c={c} fs={fs} />
            <ScheduleAView c={c} />
            <ScheduleBView c={c} />
            <ScheduleCView c={c} />
            <ScheduleDView c={c} />
            <ScheduleEView c={c} />
            <ScheduleSEView c={c} />

            {/* CPA notes */}
            <div className="border border-amber-900/50 bg-amber-900/10 rounded-lg p-4 mt-2 mb-4">
              <p className="text-xs font-semibold text-amber-500 mb-2 uppercase tracking-wide">CPA Review Notes</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                <li>All figures are based on taxpayer-entered data. Reconcile against W-2s, 1099s, and brokerage statements before filing.</li>
                <li>State return not included — use federal AGI as the starting point.</li>
                <li>AMT (Form 6251) applicability should be evaluated for this income level.</li>
                <li>Schedule C expense detail must be populated from receipts; home office requires Form 8829.</li>
                <li>Schedule D requires Form 8949 transaction detail; wash-sale rules apply.</li>
                <li>Education credits, Saver's Credit, and EV credit are subject to income limits and documentation requirements.</li>
                <li>Evaluate 2026 estimated tax payment obligation. Form 2210 penalty may apply.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: summary + download ─────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-4">
        {result && (
          <SummaryCard c={c} fs={fs} taxYear={taxYear} />
        )}
        <DownloadWidget taxYear={taxYear} />
        <div className="border border-gray-800 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
          <p className="font-semibold text-gray-500 mb-1">What's in the ZIP</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Filled Form 1040 (official IRS PDF)</li>
            <li>Applicable schedules (A/B/C/D/E/SE)</li>
            <li>Print-ready data summary PDF</li>
            <li>CPA instructions sheet</li>
            <li>Field manifest (transparency)</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
