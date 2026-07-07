import { useState } from "react";
import StatusBadge from "./StatusBadge";

const MEMBER_ICON = {
  eligible_now: { glyph: "✓", cls: "text-emerald-400" },
  nearly_eligible: { glyph: "◐", cls: "text-amber-400" },
  eligible_if_changed: { glyph: "◑", cls: "text-blue-400" },
  future_opportunity: { glyph: "◔", cls: "text-purple-400" },
  high_risk: { glyph: "⚠", cls: "text-red-400" },
  not_applicable: { glyph: "—", cls: "text-gray-600" },
  expired: { glyph: "✗", cls: "text-red-500" },
  unknown: { glyph: "?", cls: "text-gray-500" },
};

const RISK_CLS = {
  low: "bg-gray-800 text-gray-400",
  medium: "bg-amber-900 text-amber-300",
  high: "bg-red-900 text-red-300",
};

export default function StackCard({ stack }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white">{stack.name}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={stack.status} />
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${RISK_CLS[stack.risk_level] ?? RISK_CLS.low}`}>
            {stack.risk_level} risk
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3 whitespace-pre-line">{stack.target_profile}</p>

      <ul className="space-y-1 mb-3">
        {stack.members.map((m) => {
          const icon = MEMBER_ICON[m.status] ?? MEMBER_ICON.unknown;
          return (
            <li key={m.benefit_id} className="flex gap-2 text-xs">
              <span className={`${icon.cls} w-3 shrink-0`} title={m.status}>{icon.glyph}</span>
              <span className="text-gray-300">
                <span className="font-mono text-gray-500">{m.benefit_id}</span>
                {m.required ? "" : " (optional)"} — {m.role}
              </span>
            </li>
          );
        })}
      </ul>

      {stack.risk_level === "high" && stack.abuse_boundary && (
        <div className="mb-3 p-3 bg-red-900/40 border border-red-700 rounded">
          <p className="text-xs font-bold text-red-300 uppercase mb-1">⚠ Abuse boundary — read before proceeding</p>
          <p className="text-xs text-red-200 whitespace-pre-line">{stack.abuse_boundary}</p>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-emerald-400 hover:text-emerald-300 self-start mb-2 focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
      >
        {open ? "▼ Hide playbook" : "▶ Show playbook"}
      </button>

      {open && (
        <div className="border-t border-gray-800 pt-3">
          {stack.interactions && (
            <p className="text-xs text-gray-300 mb-3 whitespace-pre-line">{stack.interactions}</p>
          )}
          <ol className="space-y-2 mb-3">
            {stack.sequence.map((s) => (
              <li key={s.step} className="text-xs text-gray-300 flex gap-2">
                <span className="text-gray-500 font-mono shrink-0">{s.step}.</span>
                <span>
                  {s.action}
                  <span className="block mt-0.5 text-gray-500">
                    {s.timing && <span className="mr-2">🕒 {s.timing}</span>}
                    {s.professional !== "none" && (
                      <span className="px-1 py-0.5 rounded bg-gray-800 text-gray-400">{s.professional}</span>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {stack.combined_value && (
            <p className="text-xs text-emerald-400/90 whitespace-pre-line mb-2">{stack.combined_value}</p>
          )}
        </div>
      )}

      {stack.review_required && (
        <p className="text-xs text-red-400 mt-auto">★ CPA / attorney review required before implementing</p>
      )}
    </div>
  );
}
