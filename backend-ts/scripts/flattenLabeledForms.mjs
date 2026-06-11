// Flattens every labeled_all_*.pdf so markitdown can read the field labels.
// Run after labelAllForms.mjs.
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "..", "state", "pdf_check");

const labeled = fs.readdirSync(OUT).filter(f => f.startsWith("labeled_all_") && f.endsWith(".pdf"));

for (const name of labeled) {
  const bytes = fs.readFileSync(path.join(OUT, name));
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  try { doc.getForm().flatten(); } catch { /* skip if already flat */ }
  const flatName = name.replace("labeled_all_", "flat_labeled_");
  fs.writeFileSync(path.join(OUT, flatName), await doc.save());
  console.log(`${name} → ${flatName}`);
}
