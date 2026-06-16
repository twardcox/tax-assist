import { useState, useEffect, useMemo } from "react";
import FieldGroup from "./FieldGroup";
import ListEditor from "./ListEditor";

function deepClone(v) {
  return JSON.parse(JSON.stringify(v ?? {}));
}

function matchesSearch(field, term) {
  // Match the display label ("Social Security Number") and the raw field
  // key ("ssn") so abbreviation searches find spelled-out labels too.
  return field.label?.toLowerCase().includes(term) || field.key?.toLowerCase().includes(term);
}

export default function SectionForm({ schema, data, onSave, isSaving, saveMsg, crossSectionData, onGoToSection }) {
  const [formState, setFormState] = useState(() => deepClone(data));
  const [search, setSearch] = useState("");

  // Re-initialize when the section changes (data object reference changes)
  useEffect(() => {
    setFormState(deepClone(data));
    setSearch("");
  }, [data]);

  const pristine = useMemo(() => JSON.stringify(data ?? {}), [data]);
  const isDirty = useMemo(
    () => JSON.stringify(formState) !== pristine,
    [formState, pristine]
  );

  function handleGroupChange(newData) {
    setFormState(newData);
  }

  function handleListChange(key, newList) {
    setFormState((prev) => ({ ...prev, [key]: newList }));
  }

  const term = search.trim().toLowerCase();
  const isSearching = term.length > 0;

  // When searching, only render groups that contain a matching field (list
  // and callout groups have no fields to search — they stay visible if their
  // own label matches) and only the matching fields within each group,
  // forced open so the result is immediately visible. A match on the group's
  // own label (e.g. searching "dependents") shows the whole group untouched.
  const visibleGroups = schema.groups
    .map((group) => {
      const groupLabelMatches = isSearching && group.label?.toLowerCase().includes(term);
      if (group.type === "list" || group.type === "callout") {
        return { group, fields: null, hasMatch: !isSearching || groupLabelMatches };
      }
      if (!isSearching) return { group, fields: group.fields, hasMatch: true };
      const fields = groupLabelMatches ? group.fields : group.fields.filter((f) => matchesSearch(f, term));
      return { group, fields, hasMatch: groupLabelMatches || fields.length > 0 };
    })
    .filter((g) => g.hasMatch);

  return (
    <div className="flex flex-col h-full">
      {/* Section description */}
      {schema.description && (
        <p className="text-xs text-gray-500 mb-3">{schema.description}</p>
      )}

      {/* Field search */}
      <div className="mb-3 flex-shrink-0">
        <label htmlFor="section-field-search" className="sr-only">
          Search fields in this section
        </label>
        <input
          id="section-field-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fields…"
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        />
      </div>

      {/* Field groups / list editors */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isSearching && visibleGroups.length === 0 && (
          <p className="text-center text-gray-600 text-xs py-6">
            No fields match "{search}".
          </p>
        )}
        {visibleGroups.map(({ group, fields }) => {
          if (group.type === "list") {
            return (
              <div
                key={group.key}
                className={`border rounded-lg p-4 ${group.advanced ? "border-gray-900" : "border-gray-800"}`}
              >
                <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">
                  <span className={group.advanced ? "text-gray-500" : ""}>{group.label}</span>
                  {group.advanced && (
                    <span className="text-[10px] normal-case font-normal text-gray-600 border border-gray-700 rounded px-1.5 py-0.5">
                      Rarely needed
                    </span>
                  )}
                </h3>
                <ListEditor
                  fieldDef={group}
                  items={formState[group.key]}
                  onChange={(newList) => handleListChange(group.key, newList)}
                />
              </div>
            );
          }
          if (group.type === "callout") {
            return (
              <div
                key={group.label}
                className="border border-gray-800 rounded-lg p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1">
                    {group.label}
                  </h3>
                  <p className="text-sm text-gray-400">{group.text?.(crossSectionData ?? {})}</p>
                </div>
                {group.goToSection && (
                  <button
                    type="button"
                    onClick={() => onGoToSection?.(group.goToSection)}
                    className="flex-shrink-0 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {group.actionLabel ?? "Manage →"}
                  </button>
                )}
              </div>
            );
          }
          return (
            <FieldGroup
              key={group.label}
              label={group.label}
              fields={fields}
              data={formState}
              onChange={handleGroupChange}
              path={group.path}
              defaultOpen={group.defaultOpen ?? !group.advanced}
              advanced={group.advanced}
              showIf={group.showIf}
              forceOpen={isSearching}
            />
          );
        })}
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 pt-3 mt-3 border-t border-gray-800 flex-shrink-0">
        <span role="status" aria-live="polite" className="text-xs">
          {saveMsg && (
            <span className={saveMsg.startsWith("Error") ? "text-red-400" : "text-emerald-400"}>
              {saveMsg}
            </span>
          )}
          {!saveMsg && isDirty && <span className="text-amber-400">Unsaved changes</span>}
        </span>
        <button
          type="button"
          onClick={() => setFormState(deepClone(data))}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => onSave(formState)}
          disabled={isSaving}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-1.5 rounded text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
