import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const formDir = path.resolve(__dirname, "../../state/form_cache");

async function inspectForm(filename: string) {
  const filePath = path.join(formDir, filename);
  const bytes = fs.readFileSync(filePath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${filename}  (${fields.length} fields)`);
  console.log("=".repeat(60));

  for (const field of fields) {
    const type = field.constructor.name;
    const name = field.getName();
    let value = "";
    try {
      if (type === "PDFTextField") {
        value = (field as import("pdf-lib").PDFTextField).getText() ?? "";
      } else if (type === "PDFCheckBox") {
        value = (field as import("pdf-lib").PDFCheckBox).isChecked() ? "checked" : "unchecked";
      } else if (type === "PDFDropdown") {
        value = (field as import("pdf-lib").PDFDropdown).getSelected().join(", ");
      }
    } catch {}
    console.log(`  [${type.replace("PDF", "")}]  ${name}${value ? `  = "${value}"` : ""}`);
  }
}

async function main() {
  const forms = fs.readdirSync(formDir).filter((f) => f.endsWith(".pdf"));
  for (const f of forms) {
    await inspectForm(f);
  }
}

main().catch(console.error);
