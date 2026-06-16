import { useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import SectionForm from "../components/userdata/SectionForm";
import { essentialCompleteness, completionStatus } from "../lib/sectionCompleteness";

import { schema as householdSchema } from "../schemas/household";
import { schema as incomeSchema } from "../schemas/income";
import { schema as businessesSchema } from "../schemas/businesses";
import { schema as realEstateSchema } from "../schemas/real_estate";
import { schema as investmentsSchema } from "../schemas/investments";
import { schema as retirementSchema } from "../schemas/retirement";
import { schema as healthcareSchema } from "../schemas/healthcare";
import { schema as dependentsSchema } from "../schemas/dependents";
import { schema as goalsSchema } from "../schemas/goals";
import { schema as documentsSchema } from "../schemas/documents_index";

const SCHEMAS = {
  household: householdSchema,
  income: incomeSchema,
  businesses: businessesSchema,
  real_estate: realEstateSchema,
  investments: investmentsSchema,
  retirement: retirementSchema,
  healthcare: healthcareSchema,
  dependents: dependentsSchema,
  goals: goalsSchema,
  documents_index: documentsSchema,
};

const SECTION_LABELS = {
  household: "Household & Family",
  income: "Income",
  businesses: "Businesses",
  real_estate: "Real Estate",
  investments: "Investments",
  retirement: "Retirement",
  healthcare: "Healthcare",
  dependents: "Dependents",
  goals: "Goals & Planning",
  documents_index: "Documents",
};

// Groups sections by the user's mental model ("about me", "my money", "my
// stuff", "planning", "paperwork") rather than schema/insertion order.
const CATEGORIES = [
  { label: "About You", sections: ["household", "dependents"] },
  { label: "Income & Accounts", sections: ["income", "investments", "retirement"] },
  { label: "Business & Property", sections: ["businesses", "real_estate"] },
  { label: "Planning", sections: ["healthcare", "goals"] },
  { label: "Records", sections: ["documents_index"] },
];

const STATUS_DOT = {
  empty: "bg-gray-700",
  partial: "bg-amber-500",
  complete: "bg-emerald-500",
};

const STATUS_TEXT = {
  empty: "not started",
  partial: "in progress",
  complete: "complete",
};

export default function UserData() {
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);

  const { data: sectionsData, isLoading: loadingSections } = useQuery({
    queryKey: ["user-data-sections"],
    queryFn: api.listSections,
  });

  const sectionKeys = sectionsData?.sections ?? [];

  // Fetch every section's parsed data (small payloads) so the nav can show a
  // completion dot per section, not just whichever one is currently open.
  const allSectionQueries = useQueries({
    queries: sectionKeys.map((key) => ({
      queryKey: ["user-data-parsed", key],
      queryFn: () => api.getParsedSection(key),
      enabled: sectionKeys.length > 0,
    })),
  });

  const sectionDataByKey = {};
  sectionKeys.forEach((key, i) => {
    sectionDataByKey[key] = allSectionQueries[i]?.data?.data;
  });

  const { data: sectionData, isLoading: loadingSection } = useQuery({
    queryKey: ["user-data-parsed", activeSection],
    queryFn: () => api.getParsedSection(activeSection),
    enabled: !!activeSection,
  });

  const saveMutation = useMutation({
    mutationFn: ({ section, formState }) => api.updateSection(section, formState),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-data-parsed", activeSection] });
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 2500);
    },
    onError: (e) => setSaveMsg(`Error: ${e.message}`),
  });

  function handleSectionClick(section) {
    if (section === activeSection) return;
    setActiveSection(section);
    setSaveMsg(null);
  }

  function handleSave(formState) {
    saveMutation.mutate({ section: activeSection, formState });
  }

  const schema = activeSection ? SCHEMAS[activeSection] : null;

  // Build the category list from whatever the backend actually reports,
  // falling back to an "Other" bucket for any section not yet categorized
  // above so nothing silently disappears from the nav.
  const categorized = CATEGORIES
    .map((cat) => ({ ...cat, sections: cat.sections.filter((s) => sectionKeys.includes(s)) }))
    .filter((cat) => cat.sections.length > 0);
  const categorizedKeys = new Set(categorized.flatMap((c) => c.sections));
  const uncategorized = sectionKeys.filter((s) => !categorizedKeys.has(s));
  if (uncategorized.length > 0) {
    categorized.push({ label: "Other", sections: uncategorized });
  }

  const dependentsCount = sectionDataByKey.dependents?.dependents?.length ?? 0;

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Section list */}
      <nav aria-label="My Data sections" className="w-52 flex-shrink-0 overflow-y-auto">
        {loadingSections ? (
          <p className="text-gray-600 text-xs">Loading…</p>
        ) : (
          categorized.map((cat) => (
            <div key={cat.label} className="mb-4">
              <h2 aria-hidden="true" className="text-xs text-gray-500 uppercase mb-1.5 px-3">
                {cat.label}
              </h2>
              <ul className="space-y-1">
                {cat.sections.map((s) => {
                  const sectionSchema = SCHEMAS[s];
                  const data = sectionDataByKey[s];
                  const { filled, total } = sectionSchema && data
                    ? essentialCompleteness(sectionSchema, data)
                    : { filled: 0, total: 0 };
                  const status = completionStatus({ filled, total });
                  const statusLabel = total
                    ? `${STATUS_TEXT[status]} — ${filled} of ${total} essential fields`
                    : STATUS_TEXT[status];
                  return (
                    <li key={s}>
                      <button
                        onClick={() => handleSectionClick(s)}
                        aria-label={`${SECTION_LABELS[s] ?? s} — ${statusLabel}`}
                        aria-current={activeSection === s ? "page" : undefined}
                        className={`w-full flex items-center gap-2 text-left px-3 py-1.5 rounded text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          activeSection === s
                            ? "bg-gray-800 text-white"
                            : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
                        }`}
                      >
                        <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
                        <span className="truncate">{SECTION_LABELS[s] ?? s}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>

      {/* Form pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeSection ? (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            Select a section to edit
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-white mb-4 flex-shrink-0">
              {schema?.label ?? activeSection}
            </h2>

            {loadingSection ? (
              <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                Loading…
              </div>
            ) : !schema ? (
              <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                No form schema for this section.
              </div>
            ) : (
              <SectionForm
                key={activeSection}
                schema={schema}
                data={sectionData?.data ?? {}}
                onSave={handleSave}
                isSaving={saveMutation.isPending}
                saveMsg={saveMsg}
                crossSectionData={{ dependentsCount }}
                onGoToSection={handleSectionClick}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
