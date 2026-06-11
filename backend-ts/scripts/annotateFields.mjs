// Annotate each text field on a form by drawing its short name as text directly on the page.
// This lets markitdown extract the label alongside the surrounding form text.
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const CACHE = path.join(process.cwd(), "..", "state", "form_cache");
const OUT   = path.join(process.cwd(), "..", "state", "pdf_check");

const target = process.argv[2] || "f1040.pdf";
const bytes  = fs.readFileSync(path.join(CACHE, target));
const doc    = await PDFDocument.load(bytes, { ignoreEncryption: true });
const font   = await doc.embedFont(StandardFonts.HelveticaBold);

const pages = doc.getPages();
const form  = doc.getForm();

for (const field of form.getFields()) {
  const fullName = field.getName();
  const short    = fullName.split(".").pop() ?? fullName;

  let widgets;
  try { widgets = field.acroField.Kids(); } catch { continue; }
  if (!widgets) {
    try { widgets = [field.acroField]; } catch { continue; }
  }

  for (const widget of (widgets || [])) {
    try {
      const rect = widget.Rect();
      if (!rect) continue;
      const pageRef  = widget.P();
      if (!pageRef) continue;

      // Find which page this widget is on
      const pageIdx = pages.findIndex((p) => {
        try { return p.ref === pageRef; } catch { return false; }
      });
      if (pageIdx < 0) continue;

      const page = pages[pageIdx];
      const { height } = page.getSize();
      const x = rect.asArray()[0];
      const y = rect.asArray()[1];

      // Draw label in red at the field position (bottom-left of the field rect)
      page.drawText(short, {
        x: x + 1,
        y: y + 1,
        size: 5,
        font,
        color: rgb(0.9, 0, 0),
        opacity: 1,
      });
    } catch { /* skip */ }
  }
}

const outPath = path.join(OUT, `annotated_${target}`);
fs.writeFileSync(outPath, await doc.save());
console.log("Written:", outPath);
