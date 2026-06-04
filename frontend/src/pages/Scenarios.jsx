import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";

const STATUS_ORDER = [
  "eligible_now", "nearly_eligible", "eligible_if_changed",
  "future_opportunity", "high_risk", "unknown",
];

function CountTable({ label, counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {STATUS_ORDER.map((s) =>
          counts[s] ? (
            <span key={s} className="text-xs text-gray-400">
              {s.replace(/_/g, " ")}: <span className="text-white">{counts[s]}</span>
            </span>
          ) : null
        )}
        <span className="text-xs text-gray-600">({total} total)</span>
      </div>
    </div>
  );
}

function DiffSection({ title, color, items, renderItem }) {
  if (!items?.length) return null;
  return (
    <div className="mb-4">
      <h4 className={`text-xs uppercase font-bold mb-2 ${color}`}>
        {title} ({items.length})
      </h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="bg-gray-900 rounded p-3 text-xs">
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Scenarios() {
  const [activeKey, setActiveKey] = useState(null);
  const [result, setResult] = useState(null);

  const { data: scenariosData, isLoading } = useQuery({
    queryKey: ["scenarios"],
    queryFn: api.listScenarios,
  });

  const runMutation = useMutation({
    mutationFn: (key) => api.runScenario(key),
    onSuccess: (data) => setResult(data),
  });

  function handleRun(key) {
    setActiveKey(key);
    setResult(null);
    runMutation.mutate(key);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-1">Scenario Simulator</h1>
      <p className="text-xs text-gray-500 mb-6">
        See which benefits would unlock or change under hypothetical fact changes.
      </p>

      {isLoading ? (
        <p className="text-gray-600 text-sm">Loading scenarios…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-8">
          {scenariosData?.scenarios?.map(({ key, description }) => (
            <button
              key={key}
              onClick={() => handleRun(key)}
              disabled={runMutation.isPending}
              className={`text-left p-4 rounded-lg border transition-colors ${
                activeKey === key
                  ? "border-emerald-600 bg-emerald-900/20"
                  : "border-gray-700 bg-gray-900 hover:border-gray-600"
              }`}
            >
              <div className="text-sm text-white font-medium mb-1">
                {key.replace(/_/g, " ")}
              </div>
              <div className="text-xs text-gray-400">{description}</div>
              {runMutation.isPending && activeKey === key && (
                <div className="text-xs text-emerald-400 mt-2">Running…</div>
              )}
            </button>
          ))}
        </div>
      )}

      {runMutation.isError && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
          {runMutation.error?.message}
        </div>
      )}

      {result && (
        <div className="border border-gray-700 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-white mb-1">{result.description}</h3>

          <div className="grid grid-cols-2 gap-4 mb-5 p-3 bg-gray-900 rounded">
            <CountTable label="Baseline (current facts)" counts={result.baseline_counts} />
            <CountTable label="After scenario" counts={result.scenario_counts} />
          </div>

          <DiffSection
            title="Newly Unlocked"
            color="text-emerald-400"
            items={result.diff.newly_added}
            renderItem={(r) => (
              <div className="flex items-center gap-3">
                <StatusBadge status={r.status} />
                <span className="text-white">{r.benefit_name}</span>
                {r.estimated_value && (
                  <span className="text-emerald-400 ml-auto">{r.estimated_value}</span>
                )}
              </div>
            )}
          />

          <DiffSection
            title="Improved"
            color="text-blue-400"
            items={result.diff.improved}
            renderItem={({ before, after }) => (
              <div className="flex items-center gap-3">
                <StatusBadge status={before.status} />
                <span className="text-gray-500">→</span>
                <StatusBadge status={after.status} />
                <span className="text-white">{after.benefit_name}</span>
              </div>
            )}
          />

          <DiffSection
            title="Degraded"
            color="text-amber-400"
            items={result.diff.degraded}
            renderItem={({ before, after }) => (
              <div className="flex items-center gap-3">
                <StatusBadge status={before.status} />
                <span className="text-gray-500">→</span>
                <StatusBadge status={after.status} />
                <span className="text-white">{after.benefit_name}</span>
              </div>
            )}
          />

          <DiffSection
            title="Removed from results"
            color="text-gray-500"
            items={result.diff.removed}
            renderItem={(r) => (
              <div className="flex items-center gap-3">
                <span className="text-gray-500 line-through">{r.benefit_name}</span>
              </div>
            )}
          />

          {Object.values(result.diff).every((arr) => arr.length === 0) && (
            <p className="text-gray-500 text-sm">No changes — scenario facts don&apos;t affect any benefits.</p>
          )}
        </div>
      )}
    </div>
  );
}
