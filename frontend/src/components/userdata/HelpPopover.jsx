import { useState, useEffect, useRef, useLayoutEffect } from "react";

export default function HelpPopover({ fieldDef, describedById }) {
  const { description, source, calculate } = fieldDef;
  if (!description && !source && !calculate) return null;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = describedById ?? `help-panel-${fieldDef.key ?? "field"}`;

  // Compute fixed position every time the popover opens.
  // Using fixed positioning bypasses the scroll-container's overflow clipping.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) { setPos(null); return; }
    const rect = btnRef.current.getBoundingClientRect();
    const W = 288; // matches w-72
    const GAP = 8;
    const vw = window.innerWidth;

    // Prefer opening to the right of the button; flip left if it overflows.
    let left = rect.right + GAP;
    if (left + W > vw - GAP) {
      left = rect.left - W - GAP;
    }
    setPos({ top: rect.top, left: Math.max(GAP, left) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="inline-block ml-1">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-4 h-4 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 text-[10px] font-bold leading-none flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label="Help"
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
      >
        ?
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          id={panelId}
          role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: "18rem", zIndex: 9999 }}
          className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 text-xs text-gray-300 space-y-2"
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
