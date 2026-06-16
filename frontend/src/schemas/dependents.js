function ageAsOfYearEnd(dob) {
  if (!dob) return null;
  const taxYear = new Date().getFullYear();
  const birth = new Date(dob + "T00:00:00");
  const dec31 = new Date(taxYear, 11, 31);
  let age = dec31.getFullYear() - birth.getFullYear();
  const m = dec31.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && dec31.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

export const schema = {
  label: "Dependents",
  description: "Each person you claim as a dependent. Affects the Child Tax Credit, EITC, Dependent Care Credit, and education credits.",
  groups: [
    {
      label: "Dependent Records",
      type: "list",
      key: "dependents",
      addLabel: "Add Dependent",
      itemLabel: "Dependent",
      description: "Add one entry per qualifying child or relative you can claim on your return.",
      source: "You'll need their SSN, date of birth, and living arrangement records.",
      itemGroups: [
        {
          label: "Basic Information",
          fields: [
            {
              key: "name",
              label: "Full Name",
              type: "text",
              description: "The dependent's full name as it appears on their Social Security card.",
              source: "Their Social Security card.",
            },
            {
              key: "ssn",
              label: "Social Security Number",
              type: "ssn",
              description: "The dependent's SSN is required to claim the Child Tax Credit, EITC, and other dependent-based credits. Stored locally only.",
              source: "Their Social Security card. Apply at ssa.gov if not yet obtained.",
            },
            {
              key: "date_of_birth",
              label: "Date of Birth",
              type: "date",
              description: "Their exact date of birth. Used to verify age for qualifying child status and credit eligibility.",
              source: "Birth certificate.",
            },
            {
              key: "relationship",
              label: "Relationship",
              type: "select",
              options: [
                { value: "child", label: "Child (biological/adopted)" },
                { value: "stepchild", label: "Stepchild" },
                { value: "foster_child", label: "Foster Child" },
                { value: "sibling", label: "Sibling" },
                { value: "parent", label: "Parent" },
                { value: "other_relative", label: "Other Qualifying Relative" },
              ],
              description: "Your relationship to the dependent. Qualifying children have different rules than qualifying relatives.",
              source: "Birth certificate, adoption papers, or foster care placement documents.",
            },
            {
              key: "age_at_year_end",
              label: "Age at Year End",
              type: "number",
              derivedFrom: (groupData) => ageAsOfYearEnd(groupData?.date_of_birth),
              description: "Their age on December 31. Auto-calculated from Date of Birth. Under 17 qualifies for the Child Tax Credit; under 13 for Dependent Care Credit.",
              source: "Calculated automatically from Date of Birth.",
            },
            {
              key: "ssn_obtained",
              label: "SSN Confirmed",
              type: "boolean",
              description: "Confirms you have a valid Social Security card for this dependent. Enter the actual SSN in the field above.",
              source: "Their Social Security card.",
            },
            {
              key: "income_this_year",
              label: "Dependent's Income",
              type: "currency",
              description: "The dependent's own income this year. A qualifying relative cannot have gross income exceeding $5,050 (2025). Does not apply to qualifying children under age 19 (or 24 if student).",
              source: "Their W-2s, 1099s, or investment account statements.",
            },
          ],
        },
        {
          label: "Living Situation",
          fields: [
            {
              key: "lives_with_taxpayer",
              label: "Lives with You",
              type: "boolean",
              description: "Whether the dependent lives in your household. Qualifying children must live with you for more than half the year.",
              source: "School enrollment records, medical records, or lease/mortgage showing the child at your address.",
            },
            {
              key: "months_lived_with_taxpayer",
              label: "Months Lived with You",
              type: "number",
              placeholder: "12",
              description: "Number of months the dependent lived in your home. Must be more than 6 months for qualifying child status (some exceptions apply).",
              source: "Your own records.",
            },
            {
              key: "full_time_student",
              label: "Full-Time Student",
              type: "boolean",
              description: "Whether the dependent was a full-time student for at least 5 months of the year. Extends qualifying child status to age 23 (was under 19 otherwise).",
              source: "Enrollment verification from their school.",
            },
            {
              key: "disabled",
              label: "Disabled",
              type: "boolean",
              description: "Whether the dependent is permanently and totally disabled. Disabled qualifying children can be claimed at any age.",
              source: "Physician certification or SSA disability determination.",
            },
          ],
        },
        {
          label: "Education",
          path: "education",
          fields: [
            {
              key: "in_school",
              label: "In School",
              type: "boolean",
              description: "Whether the dependent is currently enrolled in school.",
              source: "Their school enrollment records.",
            },
            {
              key: "school_level",
              label: "School Level",
              type: "select",
              options: [
                { value: "k12", label: "K-12" },
                { value: "undergraduate", label: "Undergraduate College" },
                { value: "graduate", label: "Graduate School" },
                { value: "vocational", label: "Vocational / Trade School" },
              ],
              description: "Their current education level. Undergraduate students at eligible institutions qualify for the American Opportunity Credit (AOC) and Lifetime Learning Credit (LLC).",
              source: "Their enrollment status.",
            },
            {
              key: "tuition_paid",
              label: "Tuition Paid",
              type: "currency",
              description: "Qualified tuition and fees paid for post-secondary education. Used for the AOC (up to $2,500 credit, 40% refundable) or LLC (up to $2,000 credit).",
              source: "Form 1098-T Box 1 (amounts billed). Subtract Box 5 (scholarships) for the net qualifying amount.",
            },
            {
              key: "scholarships_received",
              label: "Scholarships Received",
              type: "currency",
              description: "Scholarships and grants received. Reduce qualifying tuition expenses for education credits.",
              source: "Form 1098-T Box 5.",
            },
            {
              key: "room_board_paid",
              label: "Room & Board Paid",
              type: "currency",
              description: "Room and board costs. Not eligible for education credits, but can be paid from 529 distributions for tax-free withdrawal.",
              source: "Your payment records or the college's Cost of Attendance statement.",
            },
            {
              key: "form_1098t_expected",
              label: "Form 1098-T Expected",
              type: "boolean",
              description: "Whether you expect to receive a Form 1098-T from their school. Required to claim education credits.",
              source: "Eligible institutions file 1098-T for students. Schools that charge only room/board (not tuition) may not issue one.",
            },
          ],
        },
        {
          label: "Care Expenses",
          path: "care_expenses",
          fields: [
            {
              key: "daycare_provider",
              label: "Daycare Provider Name",
              type: "text",
              description: "Name of the daycare or care provider. You must report the provider's name, address, and EIN/SSN on Form 2441 to claim the Dependent Care Credit.",
              source: "Your childcare contract or provider receipts.",
            },
            {
              key: "daycare_cost",
              label: "Daycare Cost",
              type: "currency",
              description: "Amount paid to daycare for qualifying care. Eligible for the Child and Dependent Care Credit (up to $3,000 for 1 child, $6,000 for 2+) and dependent care FSA exclusion.",
              source: "Your payment records or daycare billing statements.",
            },
            {
              key: "after_school_care_cost",
              label: "After-School Care Cost",
              type: "currency",
              description: "After-school program costs. Qualifies for the Dependent Care Credit if the child is under 13.",
              source: "Your payment receipts.",
            },
            {
              key: "summer_camp_cost",
              label: "Day Camp Cost",
              type: "currency",
              description: "Day camp costs qualify for the Dependent Care Credit. Overnight camps do not.",
              source: "Camp payment receipts.",
            },
          ],
        },
        {
          label: "Adoption",
          path: "adoption",
          advanced: true,
          fields: [
            {
              key: "adopted_this_year",
              label: "Adopted This Year",
              type: "boolean",
              description: "Whether you finalized an adoption this year. The Adoption Tax Credit (up to $17,280 in 2025) covers qualifying adoption expenses.",
              source: "Your adoption finalization decree.",
            },
            {
              key: "adoption_expenses",
              label: "Qualifying Adoption Expenses",
              type: "currency",
              description: "Reasonable and necessary adoption expenses: legal fees, court costs, agency fees, travel. Credit is up to $17,280 for 2025.",
              source: "Your adoption agency, attorney, and travel expense receipts.",
            },
          ],
        },
        {
          label: "Notes",
          fields: [
            {
              key: "notes",
              label: "Notes",
              type: "textarea",
              placeholder: "Notes about this dependent…",
              description: "Notes about custody arrangements, special circumstances, or eligibility questions.",
              source: "Your own notes.",
            },
          ],
        },
      ],
    },
  ],
};
