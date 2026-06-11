// Label f1_07 through f1_46 so we can identify what each field is on the form
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const CACHE = path.join(process.cwd(), "..", "..", "state", "form_cache");
const OUT = path.join(process.cwd(), "..", "..", "state", "pdf_check", "labeled_gap.pdf");

const bytes = fs.readFileSync(path.join(CACHE, "f1040.pdf"));
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

for (let i = 7; i <= 46; i++) {
  const name = `topmostSubform[0].Page1[0].f1_${i}[0]`;
  try { doc.getForm().getTextField(name).setText(`f1_${i}`); } catch { /* skip */ }
}

fs.writeFileSync(OUT, await doc.save());
console.log("Written:", OUT);
