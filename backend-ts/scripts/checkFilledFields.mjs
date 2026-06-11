// List all Page1 text fields in the base f1040.pdf to find what's between zip (f1_24) and wages (f1_47)
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const CACHE = path.join(process.cwd(), "..", "..", "state", "form_cache");
const bytes = fs.readFileSync(path.join(CACHE, "f1040.pdf"));
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = doc.getForm();

console.log("All Page1 text fields (sorted by field index):\n");
const fields = [];
for (const field of form.getFields()) {
  const name = field.getName();
  if (!name.includes("Page1")) continue;
  try {
    form.getTextField(name); // throws if not a text field
    fields.push(name);
  } catch {}
}

// Sort by the numeric index in the field name
fields.sort((a, b) => {
  const na = parseInt((a.match(/f1_(\d+)/) || [0, 0])[1]);
  const nb = parseInt((b.match(/f1_(\d+)/) || [0, 0])[1]);
  return na - nb;
});

for (const f of fields) {
  const short = f.split(".").pop();
  console.log(" ", short);
}
