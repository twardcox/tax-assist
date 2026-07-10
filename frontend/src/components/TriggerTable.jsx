function fmtCurrency(value) {
  const abs = Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value < 0 ? `-$${abs}` : `$${abs}`;
}

// Trigger Watch (M2 / EP-002): threshold, current value, dollar distance, fired state for
// every trigger-bearing scan result. Renders nothing when no triggers exist — no empty chrome.
export default function TriggerTable({ results }) {
  const items = (results ?? []).filter((r) => r.trigger);
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">
        Trigger Watch — CPA Conversation Thresholds
      </h2>
      <div className="rounded-lg border border-gray-800 bg-gray-900/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-800">
              <th scope="col" className="px-3 py-2 font-medium">Benefit</th>
              <th scope="col" className="px-3 py-2 font-medium">Metric</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Threshold</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Current</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">Distance</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const t = r.trigger;
              return (
                <tr key={r.benefit_id} className="border-b border-gray-800/60 last:border-0">
                  <td className="px-3 py-2 text-gray-200">{r.benefit_name}</td>
                  <td className="px-3 py-2 text-gray-400">{t.label}</td>
                  <td className="px-3 py-2 text-right text-gray-300 font-mono">
                    {t.comparison === "lte" ? "≤ " : "≥ "}{fmtCurrency(t.threshold)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300 font-mono">{fmtCurrency(t.current_value)}</td>
                  <td className="px-3 py-2 text-right text-gray-300 font-mono">
                    {t.fired ? "—" : fmtCurrency(t.distance)}
                  </td>
                  <td className="px-3 py-2">
                    {t.fired ? (
                      <span className="text-amber-300 font-semibold">FIRED — evaluate with CPA</span>
                    ) : (
                      <span className="text-gray-500">not fired</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
