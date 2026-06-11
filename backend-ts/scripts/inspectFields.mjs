import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const FORMS = ["f1040.pdf", "f1040s1.pdf", "f1040sb.pdf", "f1040sc.pdf", "f1040sd.pdf", "f1040sse.pdf"];
const CACHE = path.join(process.cwd(), "..", "state", "form_cache");

for (const name of FORMS) {
  console.log(`\n${"=".repeat(60)}\n${name}\n${"=".repeat(60)}`);
  const bytes = fs.readFileSync(path.join(CACHE, name));
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const fields = form.getFields();
  for (const field of fields) {
    console.log(`  ${field.constructor.name.padEnd(15)} ${field.getName()}`);
  }
}
