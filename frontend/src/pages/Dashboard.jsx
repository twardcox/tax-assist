import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge, { STATUS_CONFIG } from "../components/StatusBadge";
import StackCard from "../components/StackCard";
import TriggerTable from "../components/TriggerTable";

const STATUS_ORDER = [
  "eligible_now",
  "nearly_eligible",
  "eligible_if_changed",
  "future_opportunity",
  "high_risk",
  "unknown",
];

const CATEGORIES = [
  "all", "business_deduction", "retirement", "real_estate",
  "individual_credit", "healthcare", "education", "energy", "investment", "estate",
];

function SummaryCard({ status, count }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <div className={`rounded-lg p-3 ${cfg.bg} border border-gray-700`}>
      <div className={`text-xl font-bold ${cfg.text}`}>{count}</div>
      <div className="text-xs text-gray-400 mt-0.5">{cfg.label}</div>
    </div>
  );
}

function BenefitRow({ result }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="border-t border-gray-800 hover:bg-gray-900 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-3 py-2">
          <span className="text-gray-400 mr-1">{open ? "▼" : "▶"}</span>
          {result.benefit_name}
        </td>
        <td className="px-3 py-2">
          <StatusBadge status={result.status} />
        </td>
        <td className="px-3 py-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            result.jurisdiction === "federal"
              ? "bg-blue-900 text-blue-300"
              : result.jurisdiction === "state"
              ? "bg-purple-900 text-purple-300"
              : "bg-gray-800 text-gray-400"
          }`}>
            {result.jurisdiction || "—"}
          </span>
        </td>
        <td className="px-3 py-2 text-gray-400 text-xs">{result.category}</td>
        <td className="px-3 py-2 text-emerald-400 text-xs">{result.estimated_value || "—"}</td>
        <td className="px-3 py-2">
          <span
            className={`text-xs ${
              result.risk_level === "low"
                ? "text-gray-500"
                : result.risk_level === "moderate"
                ? "text-amber-400"
                : "text-red-400"
            }`}
          >
            {result.risk_level}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-gray-800 bg-gray-900">
          <td colSpan={6} className="px-6 py-4">
            <p className="text-gray-300 mb-3">{result.message}</p>
            {result.next_steps?.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-gray-500 uppercase">Next Steps</span>
                <ul className="mt-1 space-y-0.5">
                  {result.next_steps.map((s, i) => (
                    <li key={i} className="text-xs text-gray-300">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.missing_facts?.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-amber-500 uppercase">Missing Facts</span>
                <ul className="mt-1 space-y-0.5">
                  {result.missing_facts.map((f, i) => (
                    <li key={i} className="text-xs text-amber-300 font-mono">• {f}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.changes_needed?.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-blue-400 uppercase">Changes Needed</span>
                <ul className="mt-1 space-y-0.5">
                  {result.changes_needed.map((c, i) => (
                    <li key={i} className="text-xs text-blue-300">• {c}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.documents_needed?.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-gray-500 uppercase">Documents Needed</span>
                <ul className="mt-1 space-y-0.5">
                  {result.documents_needed.map((d, i) => (
                    <li key={i} className="text-xs text-gray-400">• {d}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.forms_required?.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Forms: {result.forms_required.join(", ")}
              </p>
            )}
            {result.phaseout_note && (
              <p className="text-xs text-amber-400 mt-1">⚠ {result.phaseout_note}</p>
            )}
            {result.review_required && (
              <p className="text-xs text-red-400 mt-1">★ CPA review recommended before claiming</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

const RISK_ORDER = { low: 0, moderate: 1, high: 2 };

function SortableHeader({ col, label, sortBy, sortDir, onSort }) {
  const active = sortBy === col;
  return (
    <th
      className="px-3 py-2 text-left cursor-pointer select-none hover:text-gray-300"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-xs opacity-40">
          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </span>
    </th>
  );
}

export default function Dashboard() {
  const [results, setResults] = useState(null);
  const [taxYear, setTaxYear] = useState(2025);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [aiJobId, setAiJobId] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [aiReportName, setAiReportName] = useState(null);

  const { data: config } = useQuery({ queryKey: ["config"], queryFn: api.getConfig });

  useEffect(() => {
    if (!aiJobId || aiStatus !== "running") return;
    const id = setInterval(async () => {
      try {
        const s = await api.getAIAnalysisStatus(aiJobId);
        if (s.status !== "running") {
          setAiStatus(s.status);
          setAiReportName(s.report_name ?? null);
          clearInterval(id);
        }
      } catch {
        setAiStatus("error");
        clearInterval(id);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [aiJobId, aiStatus]);

  async function handleAIAnalysis() {
    try {
      const { job_id } = await api.triggerAIAnalysis(taxYear);
      setAiJobId(job_id);
      setAiStatus("running");
      setAiReportName(null);
    } catch (e) {
      setAiStatus("error");
    }
  }

  function handleSort(col) {
    if (col === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  const scanMutation = useMutation({
    mutationFn: () => api.scan(taxYear),
    onSuccess: (data) => setResults(data),
  });

  const filtered = results?.results?.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    if (jurisdictionFilter !== "all" && r.jurisdiction !== jurisdictionFilter) return false;
    return true;
  });

  const sorted = (() => {
    if (!filtered || !sortBy) return filtered;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "status") {
        cmp = (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
      } else if (sortBy === "risk_level") {
        cmp = (RISK_ORDER[a.risk_level] ?? 0) - (RISK_ORDER[b.risk_level] ?? 0);
      } else if (sortBy === "jurisdiction") {
        cmp = (a.jurisdiction ?? "zzz").localeCompare(b.jurisdiction ?? "zzz");
      } else {
        cmp = (a[sortBy] ?? "").localeCompare(b[sortBy] ?? "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Opportunity Dashboard</h1>
          {results && (
            <p className="text-xs text-gray-500 mt-0.5">
              {results.total} opportunities · tax year {results.tax_year}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
          >
            {[2025, 2024, 2023].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm transition-colors"
          >
            {scanMutation.isPending ? "Scanning…" : "Run Scan"}
          </button>
          <button
            onClick={handleAIAnalysis}
            disabled={!config?.ai_available || aiStatus === "running" || scanMutation.isPending}
            title={!config?.ai_available ? "Set ANTHROPIC_API_KEY to enable AI analysis" : undefined}
            className="bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm transition-colors"
          >
            {aiStatus === "running" ? "Analyzing…" : "AI Analysis"}
          </button>
        </div>
      </div>

      {scanMutation.isError && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
          {scanMutation.error?.message}
        </div>
      )}

      {aiStatus === "complete" && aiReportName && (
        <div className="mb-4 p-3 bg-violet-900/40 border border-violet-700 rounded text-sm text-violet-300 flex items-center justify-between">
          <span>AI analysis complete.</span>
          <Link to="/reports" className="underline hover:text-violet-100">View in Reports →</Link>
        </div>
      )}
      {aiStatus === "error" && (
        <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded text-sm text-red-300">
          AI analysis failed. Check that ANTHROPIC_API_KEY is valid.
        </div>
      )}

      {results && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-6 gap-3 mb-6">
            {STATUS_ORDER.map((s) => (
              <SummaryCard key={s} status={s} count={results.counts[s] ?? 0} />
            ))}
          </div>

          {/* Trigger watch */}
          <TriggerTable results={results.results} />

          {/* Strategy stacks */}
          {results.stacks?.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Strategy Stacks</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[...results.stacks]
                  .sort((a, b) => {
                    const rank = (s) => { const i = STATUS_ORDER.indexOf(s.status); return i === -1 ? STATUS_ORDER.length : i; };
                    return rank(a) - rank(b);
                  })
                  .map((s) => (
                    <StackCard key={s.stack_id} stack={s} />
                  ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 mr-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
              >
                <option value="all">All</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mr-2">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mr-2">Source</label>
              <select
                value={jurisdictionFilter}
                onChange={(e) => setJurisdictionFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
              >
                <option value="all">All</option>
                <option value="federal">Federal</option>
                <option value="state">State</option>
              </select>
            </div>
            <span className="text-xs text-gray-600 self-center">
              {sorted?.length ?? 0} shown
            </span>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900 text-xs text-gray-500 uppercase">
                <tr>
                  <SortableHeader col="benefit_name" label="Benefit" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="status" label="Status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="jurisdiction" label="Source" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="category" label="Category" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="estimated_value" label="Est. Value" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader col="risk_level" label="Risk" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted?.map((r) => (
                  <BenefitRow key={`${r.benefit_id}-${r.jurisdiction}`} result={r} />
                ))}
              </tbody>
            </table>
            {sorted?.length === 0 && (
              <div className="text-center py-8 text-gray-600">No results match filters</div>
            )}
          </div>
        </>
      )}

      {scanMutation.isPending && (
        <div className="text-center py-20 text-gray-500">
          <div className="text-2xl mb-3 animate-pulse">⟳</div>
          <p className="text-sm">Scanning all benefit rules…</p>
        </div>
      )}

      {!results && !scanMutation.isPending && (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg mb-2">No scan data</p>
          <p className="text-sm">Click Run Scan to evaluate your opportunities</p>
        </div>
      )}
    </div>
  );
}
