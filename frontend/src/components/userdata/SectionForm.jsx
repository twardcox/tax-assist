import { useState, useEffect } from "react";
import FieldGroup from "./FieldGroup";
import ListEditor from "./ListEditor";

function deepClone(v) {
  return JSON.parse(JSON.stringify(v ?? {}));
}

export default function SectionForm({ schema, data, onSave, isSaving, saveMsg }) {
  const [formState, setFormState] = useState(() => deepClone(data));

  // Re-initialize when the section changes (data object reference changes)
  useEffect(() => {
    setFormState(deepClone(data));
  }, [data]);

  function handleGroupChange(newData) {
    setFormState(newData);
  }

  function handleListChange(key, newList) {
    setFormState((prev) => ({ ...prev, [key]: newList }));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Section description */}
      {schema.description && (
        <p className="text-xs text-gray-500 mb-4">{schema.description}</p>
      )}

      {/* Field groups / list editors */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {schema.groups.map((group) => {
          if (group.type === "list") {
            return (
              <div key={group.key} className="border border-gray-800 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">
                  {group.label}
                </h3>
                <ListEditor
                  fieldDef={group}
                  items={formState[group.key]}
                  onChange={(newList) => handleListChange(group.key, newList)}
                />
              </div>
            );
          }
          return (
            <FieldGroup
              key={group.label}
              label={group.label}
              fields={group.fields}
              data={formState}
              onChange={handleGroupChange}
              path={group.path}
              defaultOpen={true}
            />
          );
        })}
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 pt-3 mt-3 border-t border-gray-800 flex-shrink-0">
        {saveMsg && (
          <span
            className={`text-xs ${
              saveMsg.startsWith("Error") ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {saveMsg}
          </span>
        )}
        <button
          type="button"
          onClick={() => setFormState(deepClone(data))}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => onSave(formState)}
          disabled={isSaving}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-1.5 rounded text-xs transition-colors"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
