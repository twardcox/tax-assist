import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../api";

const CHANGE_COLORS = {
  rate_change: "text-red-400",
  limit_increase: "text-emerald-400",
  limit_decrease: "text-amber-400",
  new_credit: "text-blue-400",
  new_deduction: "text-blue-400",
  phaseout_change: "text-purple-400",
  deadline_change: "text-amber-400",
  penalty_change: "text-red-400",
  form_change: "text-gray-400",
  procedure_change: "text-gray-400",
  guidance_issued: "text-gray-400",
  general_update: "text-gray-500",
};

const SOURCES = [
  { value: "", label: "All sources" },
  { value: "federal_register", label: "Federal Register" },
  { value: "irs_news", label: "IRS News" },
  { value: "irs_publications", label: "IRS Publications" },
  { value: "treasury_regulations", label: "Treasury Regulations" },
  { value: "congress_legislation", label: "Congress.gov" },
];

function ChangeCard({ change }) {
  const typeColor = CHANGE_COLORS[change.change_type] ?? "text-gray-400";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-sm text-white font-medium mb-1">
            {change.title || change.filename}
          </h3>
          {change.description && (
            <p className="text-xs text-gray-400 mb-2">{change.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {change.change_type && (
              <span className={`text-xs ${typeColor}`}>
                {change.change_type.replace(/_/g, " ")}
              </span>
            )}
            {change.source && (
              <span className="text-xs text-gray-600">{change.source}</span>
            )}
            {change.effective_date && (
              <span className="text-xs text-gray-600">
                effective: {change.effective_date}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {change.detected_date && (
            <span className="text-xs text-gray-600">{change.detected_date}</span>
          )}
          {change.url && (
            <a
              href={change.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-emerald-500 hover:text-emerald-400 mt-1"
            >
              Source ↗
            </a>
          )}
        </div>
      </div>
      {change.affected_benefits?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-800">
          <span className="text-xs text-gray-600">Affects: </span>
          <span className="text-xs text-gray-400">
            {change.affected_benefits.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

export default function TaxLaw() {
  const [source, setSource] = useState("");
  const [days, setDays] = useState(30);
  const [dryRun, setDryRun] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tax-law-changes"],
    queryFn: () => api.listChanges(50),
    refetchInterval: 30_000,
  });

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ["tax-law-status"],
    queryFn: api.updateStatus,
    refetchInterval: (query) => (query.state.data?.running ? 3_000 : false),
  });

  const updateRunning = statusData?.running ?? false;

  const triggerMutation = useMutation({
    mutationFn: () => api.triggerUpdate({ source: source || undefined, days, dry_run: dryRun }),
    onSuccess: (d) => {
      setTriggerMsg(`Update started (${d.dry_run ? "dry run" : "live"}, ${d.days} days)`);
      refetchStatus();
      setTimeout(() => {
        setTriggerMsg(null);
        refetch();
      }, 5000);
    },
    onError: (e) => setTriggerMsg(`Error: ${e.message}`),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Tax Law Monitor</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {data?.total ?? "—"} change records tracked
          </p>
        </div>

        {/* Trigger panel */}
        <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="accent-emerald-500"
            />
            Dry run
          </label>
          <button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending || updateRunning}
            className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs transition-colors"
          >
            {updateRunning ? "Running…" : triggerMutation.isPending ? "Starting…" : "Update Now"}
          </button>
        </div>
      </div>

      {triggerMsg && (
        <div className={`mb-4 p-3 rounded text-sm border ${
          triggerMsg.startsWith("Error")
            ? "bg-red-900/50 border-red-700 text-red-300"
            : "bg-emerald-900/50 border-emerald-700 text-emerald-300"
        }`}>
          {triggerMsg}
          {!triggerMsg.startsWith("Error") && (
            <span className="text-xs text-emerald-500 ml-2">
              (changes will appear below in ~30 seconds)
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-600 text-sm">Loading changes…</p>
      ) : data?.changes?.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg mb-2">No change records yet</p>
          <p className="text-sm">Click Update Now to fetch the latest tax law changes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.changes?.map((change, i) => (
            <ChangeCard key={change.filename ?? i} change={change} />
          ))}
        </div>
      )}
    </div>
  );
}
