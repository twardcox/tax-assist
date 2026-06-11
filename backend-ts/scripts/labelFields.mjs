// Fills every f2_XX field on Form 1040 Page 2 with its field name so we can see the mapping
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const CACHE = path.join(process.cwd(), "..", "state", "form_cache");
const OUT = path.join(process.cwd(), "..", "state", "pdf_check", "labeled_p2.pdf");

const bytes = fs.readFileSync(path.join(CACHE, "f1040.pdf"));
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = doc.getForm();

for (const field of form.getFields()) {
  const name = field.getName();
  if (name.includes("Page2") && name.includes("f2_")) {
    try {
      doc.getForm().getTextField(name).setText(name.split(".").pop() ?? name);
    } catch { /* skip */ }
  }
}

// Also label page 1 f1_70 through f1_75
for (let i = 70; i <= 75; i++) {
  const name = `topmostSubform[0].Page1[0].f1_${i}[0]`;
  try {
    doc.getForm().getTextField(name).setText(`f1_${i}`);
  } catch { /* skip */ }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, await doc.save());
console.log("Written:", OUT);
