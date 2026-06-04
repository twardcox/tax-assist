import { useState } from "react";
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

export default function FieldGroup({ label, fields, data, onChange, path, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const groupData = path ? (getNestedValue(data, path) ?? {}) : (data ?? {});

  function handleFieldChange(fieldKey, value) {
    const fullPath = path ? `${path}.${fieldKey}` : fieldKey;
    onChange(setNestedValue(data, fullPath, value));
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-850 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{label}</span>
        <span className="text-gray-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 py-1 divide-y divide-gray-800">
          {fields.map((f) => (
            <FieldInput
              key={f.key}
              fieldDef={f}
              value={groupData[f.key] ?? null}
              onChange={(v) => handleFieldChange(f.key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
