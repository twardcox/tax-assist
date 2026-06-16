import { useId, useState } from "react";
import HelpPopover from "./HelpPopover";

const FOCUS_RING =
  "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950";
const BASE_INPUT = `w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 ${FOCUS_RING} focus:border-gray-500`;
const BASE_SELECT = BASE_INPUT + " cursor-pointer";

function CurrencyInput({ id, value, onChange }) {
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
      <span aria-hidden="true" className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={BASE_INPUT + " pl-5"}
        placeholder="0"
        {...NO_FILL}
      />
    </div>
  );
}

const NO_FILL = { autoComplete: "off", "data-lpignore": "true", "data-form-type": "other" };

function SsnInput({ id, value, onChange }) {
  const [digits, setDigits] = useState(() =>
    value ? String(value).replace(/\D/g, "").slice(0, 9) : ""
  );
  function format(d) {
    if (d.length <= 3) return d;
    if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  }
  function handleChange(e) {
    const d = e.target.value.replace(/\D/g, "").slice(0, 9);
    setDigits(d);
    onChange(d.length > 0 ? format(d) : null);
  }
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={format(digits)}
      onChange={handleChange}
      placeholder="XXX-XX-XXXX"
      maxLength={11}
      className={BASE_INPUT}
      {...NO_FILL}
    />
  );
}

function EinInput({ id, value, onChange }) {
  const [digits, setDigits] = useState(() =>
    value ? String(value).replace(/\D/g, "").slice(0, 9) : ""
  );
  function format(d) {
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}-${d.slice(2)}`;
  }
  function handleChange(e) {
    const d = e.target.value.replace(/\D/g, "").slice(0, 9);
    setDigits(d);
    onChange(d.length > 0 ? format(d) : null);
  }
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={format(digits)}
      onChange={handleChange}
      placeholder="XX-XXXXXXX"
      maxLength={10}
      className={BASE_INPUT}
      {...NO_FILL}
    />
  );
}

function DigitsInput({ id, value, onChange, maxLen, placeholder }) {
  function handleChange(e) {
    const d = e.target.value.replace(/\D/g, "").slice(0, maxLen);
    onChange(d || null);
  }
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={value ?? ""}
      onChange={handleChange}
      placeholder={placeholder ?? ""}
      maxLength={maxLen}
      className={BASE_INPUT}
      {...NO_FILL}
    />
  );
}

function TristateToggle({ id, value, onChange, label }) {
  const opts = [
    { val: true, label: "Yes" },
    { val: false, label: "No" },
    { val: null, label: "Unknown" },
  ];
  return (
    <div id={id} role="group" aria-label={label} className="flex gap-1">
      {opts.map((o) => (
        <button
          key={String(o.val)}
          type="button"
          aria-pressed={value === o.val}
          onClick={() => onChange(o.val)}
          className={`px-2 py-1 rounded text-xs border transition-colors ${FOCUS_RING} ${
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

function BoolToggle({ id, value, onChange, label }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={!!value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className={`relative inline-flex w-10 h-5 rounded-full transition-colors flex-shrink-0 ${FOCUS_RING} ${
        value ? "bg-emerald-700" : "bg-gray-700"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function FieldInput({ fieldDef, value, onChange }) {
  const { type, options, placeholder, label } = fieldDef;
  const id = useId();

  // `htmlFor` only applies cleanly to a single focusable control. Compound
  // widgets (tristate) supply their own aria-label on the group instead, so
  // the visible <label> renders without a `for` attribute for those.
  function row(input, { compound = false } = {}) {
    return (
      <div className="flex items-center justify-between gap-4 py-1.5">
        <label
          htmlFor={compound ? undefined : id}
          className="flex items-center gap-0.5 text-sm text-gray-400 flex-shrink-0 min-w-0 max-w-[45%]"
        >
          <span className="truncate">{label}</span>
          <HelpPopover fieldDef={fieldDef} describedById={`${id}-help`} />
        </label>
        <div className="flex-1 min-w-0 max-w-[55%]">{input}</div>
      </div>
    );
  }

  if (type === "boolean") {
    return row(<BoolToggle id={id} value={!!value} onChange={onChange} label={label} />);
  }
  if (type === "tristate") {
    return row(<TristateToggle id={id} value={value ?? null} onChange={onChange} label={label} />, { compound: true });
  }
  if (type === "currency") {
    return row(<CurrencyInput id={id} value={value} onChange={onChange} />);
  }
  if (type === "ssn") {
    return row(<SsnInput id={id} value={value} onChange={onChange} />);
  }
  if (type === "ein") {
    return row(<EinInput id={id} value={value} onChange={onChange} />);
  }
  if (type === "routing") {
    return row(<DigitsInput id={id} value={value} onChange={onChange} maxLen={9} placeholder="9-digit ABA number" />);
  }
  if (type === "zip") {
    return row(<DigitsInput id={id} value={value} onChange={onChange} maxLen={10} placeholder="XXXXX" />);
  }
  if (type === "naics") {
    return row(<DigitsInput id={id} value={value} onChange={onChange} maxLen={6} placeholder="6-digit code" />);
  }
  if (type === "select") {
    return row(
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={BASE_SELECT}
        {...NO_FILL}
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
        id={id}
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={placeholder ?? ""}
        className={BASE_INPUT}
        {...NO_FILL}
      />
    );
  }
  if (type === "date") {
    return row(
      <input
        id={id}
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={BASE_INPUT}
        style={{ colorScheme: "dark" }}
        {...NO_FILL}
      />
    );
  }
  if (type === "textarea") {
    return (
      <div className="py-1.5 space-y-1">
        <label htmlFor={id} className="flex items-center gap-0.5 text-sm text-gray-400">
          <span>{label}</span>
          <HelpPopover fieldDef={fieldDef} describedById={`${id}-help`} />
        </label>
        <textarea
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          rows={3}
          placeholder={placeholder ?? ""}
          className={BASE_INPUT + " resize-none"}
          {...NO_FILL}
        />
      </div>
    );
  }
  // default: text
  return row(
    <input
      id={id}
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={placeholder ?? ""}
      className={BASE_INPUT}
      {...NO_FILL}
    />
  );
}
