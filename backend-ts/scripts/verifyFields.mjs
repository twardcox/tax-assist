// Point-for-point live check: loads a user's data straight from the DB (same
// path the API uses), fills a form WITHOUT flattening, and dumps the live
// AcroForm field name -> value pairs. Unlike markitdown text-extraction, this
// reads the actual AcroForm data structure directly, so there's no risk of
// two-column layouts scrambling which value belongs to which label.
//
// Usage (from backend-ts/):
//   npx tsx scripts/verifyFields.mjs <userId> <taxYear> <formKey>
// formKey examples: f1040, f1040s1, f1040sb, f1040sc_0, f1040sd, f1040sse, f1040sf, f1040sh
//
// Find a user's id: SELECT id FROM users WHERE email = '...' in state/transactions.db
import { PDFForm, PDFDocument } from "pdf-lib";

const originalFlatten = PDFForm.prototype.flatten;
PDFForm.prototype.flatten = function () {
  // no-op — keep fields live for inspection
};

const { fillSingleIrsForm } = await import("../src/domain/taxForms/fillIrsForms.ts");
const { loadAllUserData, computeTaxFigures } = await import("../src/domain/taxForms/index.ts");

const userId = process.argv[2];
const taxYear = Number(process.argv[3] ?? 2025);
const formKey = process.argv[4];

if (!userId || !formKey) {
  console.error("Usage: tsx scripts/verifyFields.mjs <userId> <taxYear> <formKey>");
  process.exit(1);
}

const data = await loadAllUserData(userId, taxYear);
const figures = await computeTaxFigures(userId, taxYear);

const pdfBytes = await fillSingleIrsForm(formKey, figures.computed, figures.display_name, taxYear, data);

const doc = await PDFDocument.load(pdfBytes);
const form = doc.getForm();
const fields = form.getFields();
console.error(`DEBUG: ${fields.length} fields found in ${formKey}`);

for (const field of fields) {
  const name = field.getName();
  const type = field.constructor.name;
  let value = "";
  try {
    if (type === "PDFTextField") {
      value = field.getText() ?? "";
    } else if (type === "PDFCheckBox") {
      value = field.isChecked() ? "[X]" : "";
    } else if (type === "PDFRadioGroup") {
      value = field.getSelected() ?? "";
    } else {
      value = "(unsupported)";
    }
  } catch (e) {
    value = `(error: ${e.message})`;
  }
  if (value !== "") {
    console.log(`${name}\t${value}`);
  }
}
