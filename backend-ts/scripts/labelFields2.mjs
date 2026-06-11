// Label f1_60 through f1_75 and key f2 fields to find exact placements
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const CACHE = path.join(process.cwd(), "..", "state", "form_cache");
const OUT = path.join(process.cwd(), "..", "state", "pdf_check", "labeled_income.pdf");

const bytes = fs.readFileSync(path.join(CACHE, "f1040.pdf"));
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

for (let i = 60; i <= 75; i++) {
  const name = `topmostSubform[0].Page1[0].f1_${i}[0]`;
  try { doc.getForm().getTextField(name).setText(`f1_${i}`); } catch { /* skip */ }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, await doc.save());
console.log("Written:", OUT);
