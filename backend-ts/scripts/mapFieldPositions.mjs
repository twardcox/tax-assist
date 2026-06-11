// Outputs each PDF field with its page, Y position (top-to-bottom), and X position
// so we can definitively map form labels to field names.
import { PDFDocument } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const CACHE = path.join(process.cwd(), "..", "state", "form_cache");
const [, , formName = "f1040.pdf"] = process.argv;

const bytes = fs.readFileSync(path.join(CACHE, formName));
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = doc.getForm();

const pages = doc.getPages();
const pageHeights = pages.map(p => p.getHeight());

const rows = [];
for (const field of form.getFields()) {
  const name = field.getName();
  const type = field.constructor.name.replace("PDF", "");
  const widgets = field.acroField.getWidgets();
  for (const widget of widgets) {
    const rect = widget.getRectangle();
    // pageIndex from the widget's page ref
    let pageIndex = 0;
    try {
      const pageRef = widget.P();
      if (pageRef) {
        pageIndex = doc.getPages().findIndex(p => p.ref === pageRef);
        if (pageIndex === -1) pageIndex = 0;
      }
    } catch { /* ignore */ }
    const pageH = pageHeights[pageIndex] ?? 792;
    const topY = pageH - rect.y - rect.height; // flip: 0 = top of page
    rows.push({ page: pageIndex + 1, topY: Math.round(topY), x: Math.round(rect.x), type, name });
  }
}

rows.sort((a, b) => a.page - b.page || a.topY - b.topY || a.x - b.x);

console.log(`Page | TopY |   X | Type            | Field name`);
console.log(`-----|------|-----|-----------------|---------------------------------------------`);
for (const r of rows) {
  console.log(`   ${r.page} | ${String(r.topY).padStart(4)} | ${String(r.x).padStart(3)} | ${r.type.padEnd(15)} | ${r.name}`);
}
