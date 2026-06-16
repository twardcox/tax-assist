import { useState, useEffect, useRef } from "react";

export default function HelpPopover({ fieldDef, describedById }) {
  const { description, source, calculate } = fieldDef;
  if (!description && !source && !calculate) return null;

  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const panelId = describedById ?? `help-panel-${fieldDef.key ?? "field"}`;

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span className="relative inline-block ml-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-4 h-4 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 text-[10px] font-bold leading-none flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label="Help"
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
      >
        ?
      </button>
      {open && (
        <div
          id={panelId}
          role="tooltip"
          className="absolute z-50 left-5 top-0 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 text-xs text-gray-300 space-y-2"
        >
          {description && (
            <div>
              <span className="text-gray-500 uppercase text-[10px] font-semibold tracking-wide">What it is</span>
              <p className="mt-0.5 leading-relaxed">{description}</p>
            </div>
          )}
          {source && (
            <div>
              <span className="text-gray-500 uppercase text-[10px] font-semibold tracking-wide">Where to find it</span>
              <p className="mt-0.5 leading-relaxed">{source}</p>
            </div>
          )}
          {calculate && (
            <div>
              <span className="text-gray-500 uppercase text-[10px] font-semibold tracking-wide">How to calculate</span>
              <p className="mt-0.5 leading-relaxed">{calculate}</p>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
