// Label every text field on every form with its short field name.
// Run markitdown on each output PDF to get an authoritative text→field mapping.
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const CACHE = path.join(process.cwd(), "..", "state", "form_cache");
const OUT   = path.join(process.cwd(), "..", "state", "pdf_check");
fs.mkdirSync(OUT, { recursive: true });

const FORMS = [
  "f1040.pdf",
  "f1040s1.pdf",
  "f1040sb.pdf",
  "f1040sc.pdf",
  "f1040sd.pdf",
  "f1040sse.pdf",
  "f5695.pdf",
];

for (const name of FORMS) {
  const bytes = fs.readFileSync(path.join(CACHE, name));
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();

  let count = 0;
  for (const field of form.getFields()) {
    const fullName = field.getName();
    const short = fullName.split(".").pop() ?? fullName;
    try {
      form.getTextField(fullName).setText(short);
      count++;
    } catch { /* skip checkboxes and radio buttons */ }
  }

  const outPath = path.join(OUT, `labeled_all_${name}`);
  fs.writeFileSync(outPath, await doc.save());
  console.log(`${name}: labeled ${count} text fields → ${path.basename(outPath)}`);
}
