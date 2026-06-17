// Client-side, schema-driven completion signal for the My Data nav.
// No backend change required — this only reads data already fetched for the
// active section plus the schema definitions already in the bundle.

function getNestedValue(obj, path) {
  if (!path) return obj;
  return path.split(".").reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), obj);
}

function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

function countFields(schema, data, { essentialOnly }) {
  let total = 0;
  let filled = 0;
  for (const group of schema.groups ?? []) {
    if (typeof group.showIf === "function" && !group.showIf(data ?? {})) continue;

    if (group.type === "list") {
      if (essentialOnly) continue;
      total += 1;
      const listData = group.path ? getNestedValue(data, group.path) : data?.[group.key];
      if (Array.isArray(listData) && listData.length > 0) filled += 1;
      continue;
    }

    const groupData = group.path ? (getNestedValue(data, group.path) ?? {}) : (data ?? {});
    for (const field of group.fields ?? []) {
      if (typeof field.derivedFrom === "function") continue;
      if (essentialOnly && !field.essential) continue;
      total += 1;
      if (isFilled(groupData[field.key])) filled += 1;
    }
  }
  return { filled, total };
}

/**
 * Returns { filled, total, mode }. Prefers fields flagged `essential: true`
 * (a handful of load-bearing fields per schema — see household.js for the
 * pattern). Schemas that haven't been retrofitted with `essential` flags yet
 * fall back to a flat ratio across all non-list fields so the nav still
 * shows a reasonable signal.
 */
export function essentialCompleteness(schema, data) {
  const essential = countFields(schema, data, { essentialOnly: true });
  if (essential.total > 0) return { ...essential, mode: "essential" };
  const flat = countFields(schema, data, { essentialOnly: false });
  return { ...flat, mode: "flat" };
}

/** Maps a { filled, total } pair to a nav status dot color. */
export function completionStatus({ filled, total }) {
  if (filled === 0) return "empty";
  if (total > 0 && filled >= total) return "complete";
  return "partial";
}
