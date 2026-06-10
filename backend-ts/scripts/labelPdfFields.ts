import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const formDir = path.resolve(__dirname, "../../state/form_cache");
const outDir = path.resolve(__dirname, "../../state/form_cache/labeled");

async function labelForm(filename: string) {
  const filePath = path.join(formDir, filename);
  const bytes = fs.readFileSync(filePath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();

  for (const field of form.getFields()) {
    const name = field.getName();
    // Extract the short name (last segment) for display
    const short = name.split(".").pop() ?? name;
    try {
      if (field instanceof PDFTextField) {
        field.setText(short);
      } else if (field instanceof PDFCheckBox) {
        // Leave checkboxes unchecked — their name is visible via the field label
      }
    } catch {
      // Skip read-only or restricted fields
    }
  }

  const outPath = path.join(outDir, filename.replace(".pdf", "_labeled.pdf"));
  fs.writeFileSync(outPath, await pdf.save());
  console.log(`Saved: ${outPath}`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const forms = fs.readdirSync(formDir).filter((f) => f.endsWith(".pdf"));
  for (const f of forms) {
    await labelForm(f);
  }
}

main().catch(console.error);
