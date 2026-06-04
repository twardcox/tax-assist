const CONFIG = {
  eligible_now:        { bg: "bg-emerald-900", text: "text-emerald-300", label: "Eligible Now" },
  nearly_eligible:     { bg: "bg-amber-900",   text: "text-amber-300",   label: "Nearly Eligible" },
  eligible_if_changed: { bg: "bg-blue-900",    text: "text-blue-300",    label: "If Changed" },
  future_opportunity:  { bg: "bg-purple-900",  text: "text-purple-300",  label: "Future" },
  high_risk:           { bg: "bg-red-900",     text: "text-red-300",     label: "High Risk" },
  unknown:             { bg: "bg-gray-800",    text: "text-gray-400",    label: "Unknown" },
};

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] ?? CONFIG.unknown;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

export { CONFIG as STATUS_CONFIG };
