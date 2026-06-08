import { getDb } from "./client";

export type DocumentRow = {
  id: string;
  user_id: string;
  filename: string;
  subdir: string;
  path: string;
  category: string | null;
  confidence: string | null;
  document_type: string | null;
  note: string | null;
  size: number;
  extracted: number;
  extraction_json: string | null;
  content?: Buffer | null;
  uploaded_at: string;
};

export type DocumentSummary = {
  file_id: string;
  file: string;
  category: string;
  confidence: string;
  size: number;
  note: string;
  extracted: boolean;
  uploaded_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function upsertDocument(
  userId: string,
  fileId: string,
  filename: string,
  content: Buffer,
  info: { category: string; confidence: string; note: string }
): void {
  const db = getDb();
  const subdir = info.category || "uploads";
  const filePath = `${subdir}/${fileId}/${filename}`;

  db.prepare(
    `INSERT INTO documents
      (id, user_id, filename, subdir, path, category, confidence, document_type, note, size, extracted, extraction_json, content, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       filename = excluded.filename,
       subdir = excluded.subdir,
       path = excluded.path,
       category = excluded.category,
       confidence = excluded.confidence,
       document_type = excluded.document_type,
       note = excluded.note,
       size = excluded.size,
       content = excluded.content`
  ).run(
    fileId,
    userId,
    filename,
    subdir,
    filePath,
    info.category,
    info.confidence,
    info.category,
    info.note,
    content.length,
    content,
    nowIso()
  );
}

export function getDocumentsForUser(userId: string): DocumentSummary[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, filename, category, confidence, note, size, extracted, uploaded_at
     FROM documents
     WHERE user_id = ?
     ORDER BY uploaded_at DESC`
  ).all(userId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    file_id: String(row.id),
    file: String(row.filename ?? ""),
    category: String(row.category ?? ""),
    confidence: String(row.confidence ?? ""),
    size: Number(row.size ?? 0),
    note: String(row.note ?? ""),
    extracted: row.extracted === 1,
    uploaded_at: String(row.uploaded_at ?? "")
  }));
}

export function deleteDocumentRecord(userId: string, fileId: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM documents WHERE user_id = ? AND id = ?").run(userId, fileId);
  return result.changes > 0;
}

export function getDocumentContent(userId: string, fileId: string): { content: Buffer | null; filename: string } {
  const db = getDb();
  const row = db.prepare(
    "SELECT filename, content FROM documents WHERE user_id = ? AND id = ?"
  ).get(userId, fileId) as { filename?: string; content?: Buffer | null } | undefined;

  return {
    content: row?.content ?? null,
    filename: row?.filename ?? ""
  };
}

export function saveDocumentExtraction(userId: string, fileId: string, extraction: Record<string, unknown>): void {
  const db = getDb();
  db.prepare(
    `UPDATE documents
     SET extracted = 1,
         extraction_json = ?
     WHERE user_id = ? AND id = ?`
  ).run(JSON.stringify(extraction), userId, fileId);
}
