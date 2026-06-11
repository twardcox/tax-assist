// Inspect all AcroForm field values in the user's downloaded Form 1040
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";

const file = process.argv[2] || "C:\\Users\\tward\\Downloads\\Form_1040_2025.pdf";
const bytes = fs.readFileSync(file);
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = doc.getForm();

const fields = form.getFields();
if (fields.length === 0) {
  console.log("No AcroForm fields found — PDF is flattened. Checking raw annotations...");
} else {
  for (const field of fields) {
    try {
      const val = form.getTextField(field.getName()).getText();
      if (val && val.trim()) {
        const short = field.getName().split(".").pop();
        console.log(`  ${short.padEnd(22)} = ${JSON.stringify(val)}`);
      }
    } catch {}
  }
}

// Also check the f1_03 SSN field specifically
try {
  const ssn = form.getTextField("topmostSubform[0].Page1[0].f1_03[0]");
  console.log("\nSSN field found:", JSON.stringify(ssn.getText()));
} catch (e) {
  console.log("\nSSN field f1_03 not accessible:", e.message);
}
