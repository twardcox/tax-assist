import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import SectionForm from "../components/userdata/SectionForm";

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
  household: "Household",
  income: "Income",
  businesses: "Businesses",
  real_estate: "Real Estate",
  investments: "Investments",
  retirement: "Retirement",
  healthcare: "Healthcare",
  dependents: "Dependents",
  goals: "Goals",
  documents_index: "Documents",
};

export default function UserData() {
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);

  const { data: sectionsData, isLoading: loadingSections } = useQuery({
    queryKey: ["user-data-sections"],
    queryFn: api.listSections,
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

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Section list */}
      <div className="w-48 flex-shrink-0">
        <h2 className="text-xs text-gray-500 uppercase mb-3">Sections</h2>
        {loadingSections ? (
          <p className="text-gray-600 text-xs">Loading…</p>
        ) : (
          <ul className="space-y-1">
            {sectionsData?.sections?.map((s) => (
              <li key={s}>
                <button
                  onClick={() => handleSectionClick(s)}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                    activeSection === s
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
                  }`}
                >
                  {SECTION_LABELS[s] ?? s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
