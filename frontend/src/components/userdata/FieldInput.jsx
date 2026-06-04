import { useState } from "react";
import HelpPopover from "./HelpPopover";

const BASE_INPUT = "w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-gray-500";
const BASE_SELECT = BASE_INPUT + " cursor-pointer";

function CurrencyInput({ value, onChange }) {
  const [raw, setRaw] = useState(
    value != null && value !== "" ? String(value) : ""
  );

  function handleChange(e) {
    const v = e.target.value.replace(/[^0-9.]/g, "");
    setRaw(v);
    const n = parseFloat(v);
    onChange(isNaN(n) ? null : n);
  }

  function handleBlur() {
    const n = parseFloat(raw);
    if (!isNaN(n)) setRaw(n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
  }

  function handleFocus() {
    if (raw) setRaw(raw.replace(/,/g, ""));
  }

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
      <input
        type="text"
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={BASE_INPUT + " pl-5"}
        placeholder="0"
      />
    </div>
  );
}

function TristateToggle({ value, onChange }) {
  const opts = [
    { val: true, label: "Yes" },
    { val: false, label: "No" },
    { val: null, label: "Unknown" },
  ];
  return (
    <div className="flex gap-1">
      {opts.map((o) => (
        <button
          key={String(o.val)}
          type="button"
          onClick={() => onChange(o.val)}
          className={`px-2 py-1 rounded text-xs border transition-colors ${
            value === o.val
              ? "bg-gray-600 border-gray-500 text-white"
              : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BoolToggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
        value ? "bg-emerald-700" : "bg-gray-700"
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function FieldInput({ fieldDef, value, onChange }) {
  const { type, options, placeholder, label } = fieldDef;

  function row(input) {
    return (
      <div className="flex items-center justify-between gap-4 py-1.5">
        <label className="flex items-center gap-0.5 text-sm text-gray-400 flex-shrink-0 min-w-0 max-w-[45%]">
          <span className="truncate">{label}</span>
          <HelpPopover fieldDef={fieldDef} />
        </label>
        <div className="flex-1 min-w-0 max-w-[55%]">{input}</div>
      </div>
    );
  }

  if (type === "boolean") {
    return row(<BoolToggle value={!!value} onChange={onChange} />);
  }
  if (type === "tristate") {
    return row(<TristateToggle value={value ?? null} onChange={onChange} />);
  }
  if (type === "currency") {
    return row(<CurrencyInput value={value} onChange={onChange} />);
  }
  if (type === "select") {
    return row(
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={BASE_SELECT}
      >
        <option value="">— select —</option>
        {options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  if (type === "number") {
    return row(
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={placeholder ?? ""}
        className={BASE_INPUT}
      />
    );
  }
  if (type === "date") {
    return row(
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={BASE_INPUT}
      />
    );
  }
  if (type === "textarea") {
    return (
      <div className="py-1.5 space-y-1">
        <label className="flex items-center gap-0.5 text-sm text-gray-400">
          <span>{label}</span>
          <HelpPopover fieldDef={fieldDef} />
        </label>
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          rows={3}
          placeholder={placeholder ?? ""}
          className={BASE_INPUT + " resize-none"}
        />
      </div>
    );
  }
  // default: text
  return row(
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder ?? ""}
      className={BASE_INPUT}
    />
  );
}
