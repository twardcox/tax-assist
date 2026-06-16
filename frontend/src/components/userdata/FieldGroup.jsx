import { useId, useState, useEffect } from "react";
import FieldInput from "./FieldInput";

function getNestedValue(obj, path) {
  if (!path) return obj;
  return path.split(".").reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
}

function setNestedValue(obj, path, value) {
  if (!path) return value;
  const keys = path.split(".");
  const result = { ...(obj ?? {}) };
  let cur = result;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] ?? {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return result;
}

export default function FieldGroup({ label, fields, data, onChange, path, defaultOpen = true, advanced = false, showIf, forceOpen = false, sectionData }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const groupData = path ? (getNestedValue(data, path) ?? {}) : (data ?? {});

  // `forceOpen` (e.g. a search match) must reopen an already-collapsed group.
  // `useState(defaultOpen)` only reads its argument on the initial render, so
  // a later prop change alone wouldn't do it — this effect is required.
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  // `showIf` lets a schema hide an entire group (e.g. "Spouse") when it's
  // not relevant to the current data (e.g. filing status is Single).
  if (showIf && !showIf(data)) return null;

  function handleFieldChange(fieldKey, value) {
    const fullPath = path ? `${path}.${fieldKey}` : fieldKey;
    let updated = setNestedValue(data, fullPath, value);
    // Recompute all derived siblings after any field change.
    for (const f of (fields ?? [])) {
      if (typeof f.derivedFrom !== "function") continue;
      const updatedGroup = path ? (getNestedValue(updated, path) ?? {}) : updated;
      const computed = f.derivedFrom(updatedGroup, sectionData ?? updated);
      updated = setNestedValue(updated, path ? `${path}.${f.key}` : f.key, computed);
    }
    onChange(updated);
  }

  return (
    <fieldset
      className={`border rounded-lg overflow-hidden ${advanced ? "border-gray-900" : "border-gray-800"}`}
    >
      <legend className="sr-only">{label}</legend>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset ${
          advanced ? "bg-gray-950 hover:bg-gray-900" : "bg-gray-900 hover:bg-gray-800"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wide ${advanced ? "text-gray-500" : "text-gray-300"}`}>
            {label}
          </span>
          {advanced && (
            <span className="text-[10px] normal-case font-normal text-gray-600 border border-gray-700 rounded px-1.5 py-0.5">
              Rarely needed
            </span>
          )}
        </span>
        <span aria-hidden="true" className="text-gray-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div id={contentId} className="px-4 py-1 divide-y divide-gray-800">
          {advanced && (
            <p className="text-xs text-gray-600 py-2">Only fill these in if they apply to you.</p>
          )}
          {fields.map((f) => {
            if (typeof f.derivedFrom === "function") {
              const computed = f.derivedFrom(groupData, sectionData ?? data);
              if (computed != null) {
                return (
                  <div key={f.key} className="flex items-center justify-between gap-4 py-1.5">
                    <span className="text-sm text-gray-400 flex-shrink-0 truncate max-w-[45%]">{f.label}</span>
                    <span className="text-sm font-medium text-emerald-400 bg-gray-800 px-2 py-0.5 rounded tabular-nums">
                      {computed}
                    </span>
                  </div>
                );
              }
            }
            return (
              <FieldInput
                key={f.key}
                fieldDef={f}
                value={groupData[f.key] ?? null}
                onChange={(v) => handleFieldChange(f.key, v)}
              />
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
