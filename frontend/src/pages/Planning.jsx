import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

const URGENCY_CONFIG = {
  overdue:  { label: "Overdue",       border: "border-red-800",   header: "text-red-400",   bg: "bg-red-950/30"  },
  critical: { label: "Act This Month", border: "border-red-700",   header: "text-red-400",   bg: "bg-red-900/20"  },
  soon:     { label: "Next 90 Days",   border: "border-amber-700", header: "text-amber-400", bg: "bg-amber-900/10" },
  normal:   { label: "On Track",       border: "border-gray-700",  header: "text-gray-400",  bg: ""               },
};

function CountdownChip({ label, days, color }) {
  const cls = color === "red"
    ? "bg-red-900/40 border-red-700 text-red-300"
    : color === "amber"
    ? "bg-amber-900/40 border-amber-700 text-amber-300"
    : "bg-gray-800 border-gray-700 text-gray-300";
  return (
    <div className={`border rounded-lg px-4 py-2 text-center ${cls}`}>
      <div className="text-2xl font-bold">{days < 0 ? "Past" : days}</div>
      <div className="text-xs opacity-70">{days < 0 ? "days ago" : "days"}</div>
      <div className="text-xs mt-0.5 opacity-60">{label}</div>
    </div>
  );
}

function ActionCard({ action }) {
  const [open, setOpen] = useState(false);
  const cfg = URGENCY_CONFIG[action.urgency] ?? URGENCY_CONFIG.normal;
  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-gray-900 ${cfg.border} ${cfg.bg}`}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={action.status} />
            <span className="text-sm font-medium text-white">{action.benefit_name}</span>
          </div>
          <p className="text-xs text-gray-300">{action.action}</p>
        </div>
        <span className="text-gray-600 text-xs flex-shrink-0">{open ? "▲" : "▼"}</span>
      </div>

      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          ⏰ {action.deadline_label}
          {action.days_remaining >= 0
            ? <span className={`font-medium ${cfg.header}`}> — {action.days_remaining} days</span>
            : <span className="font-medium text-red-400"> — overdue</span>
          }
          {action.extendable && <span className="text-gray-600 ml-1">(extendable)</span>}
        </span>
        {action.estimated_value && (
          <span className="text-xs text-emerald-400">💰 {action.estimated_value}</span>
        )}
      </div>

      {open && action.next_steps?.length > 0 && (
        <ul className="mt-3 space-y-0.5 border-t border-gray-800 pt-3">
          {action.next_steps.map((s, i) => (
            <li key={i} className="text-xs text-gray-400">• {s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const URGENCY_ORDER = ["overdue", "critical", "soon", "normal"];

export default function Planning() {
  const [taxYear, setTaxYear] = useState(2025);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["year-end-plan", taxYear],
    queryFn: () => api.getYearEndPlan(taxYear),
  });

  const grouped = {};
  for (const u of URGENCY_ORDER) {
    grouped[u] = (data?.actions ?? []).filter((a) => a.urgency === u);
  }

  const dec31Color = data
    ? data.days_until_dec_31 < 30 ? "red" : data.days_until_dec_31 < 90 ? "amber" : "gray"
    : "gray";
  const apr15Color = data
    ? data.days_until_apr_15 < 30 ? "red" : data.days_until_apr_15 < 90 ? "amber" : "gray"
    : "gray";

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Year-End Tax Action Plan</h1>
          {data && (
            <p className="text-xs text-gray-500 mt-0.5">
              {data.summary.total} time-sensitive action{data.summary.total !== 1 ? "s" : ""} ·
              tax year {data.tax_year} · as of {data.today}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data && (
            <div className="flex gap-3">
              <CountdownChip label="until Dec 31" days={data.days_until_dec_31} color={dec31Color} />
              <CountdownChip label="until Apr 15" days={data.days_until_apr_15} color={apr15Color} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300"
            >
              {[2025, 2024, 2023].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => refetch()}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {isError && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
          {error?.message}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-20 text-gray-500">
          <div className="text-2xl mb-3 animate-pulse">⟳</div>
          <p className="text-sm">Building your year-end action plan…</p>
        </div>
      )}

      {data && data.summary.total === 0 && (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg mb-2">No time-sensitive actions found</p>
          <p className="text-sm mb-4">
            Run a scan first so the planner can identify your opportunities.
          </p>
          <Link to="/dashboard" className="text-emerald-400 hover:text-emerald-300 text-sm underline">
            Go to Dashboard →
          </Link>
        </div>
      )}

      {data && data.summary.total > 0 && (
        <div className="space-y-8">
          {URGENCY_ORDER.map((urgency) => {
            const items = grouped[urgency];
            if (!items?.length) return null;
            const cfg = URGENCY_CONFIG[urgency];
            return (
              <section key={urgency}>
                <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${cfg.header}`}>
                  {cfg.label} — {items.length} action{items.length !== 1 ? "s" : ""}
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((action) => (
                    <ActionCard key={action.benefit_id} action={action} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
