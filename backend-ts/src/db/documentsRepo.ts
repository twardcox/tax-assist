import { query, queryOne, execute } from "./client";

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

export async function upsertDocument(
  userId: string,
  fileId: string,
  filename: string,
  content: Buffer,
  info: { category: string; confidence: string; note: string }
): Promise<void> {
  const subdir = info.category || "uploads";
  const filePath = `${subdir}/${fileId}/${filename}`;

  await execute(
    `INSERT INTO documents
      (id, user_id, filename, subdir, path, category, confidence, document_type, note, size, extracted, extraction_json, content, uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, NULL, $11, $12)
     ON CONFLICT(id) DO UPDATE SET
       filename = EXCLUDED.filename,
       subdir = EXCLUDED.subdir,
       path = EXCLUDED.path,
       category = EXCLUDED.category,
       confidence = EXCLUDED.confidence,
       document_type = EXCLUDED.document_type,
       note = EXCLUDED.note,
       size = EXCLUDED.size,
       content = EXCLUDED.content`,
    [
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
      nowIso(),
    ]
  );
}

export async function getDocumentsForUser(userId: string): Promise<DocumentSummary[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT id, filename, category, confidence, note, size, extracted, uploaded_at
     FROM documents
     WHERE user_id = $1
     ORDER BY uploaded_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    file_id: String(row.id),
    file: String(row.filename ?? ""),
    category: String(row.category ?? ""),
    confidence: String(row.confidence ?? ""),
    size: Number(row.size ?? 0),
    note: String(row.note ?? ""),
    extracted: row.extracted === 1,
    uploaded_at: String(row.uploaded_at ?? ""),
  }));
}

export async function deleteDocumentRecord(userId: string, fileId: string): Promise<boolean> {
  const affected = await execute(
    "DELETE FROM documents WHERE user_id = $1 AND id = $2",
    [userId, fileId]
  );
  return affected > 0;
}

export async function getDocumentContent(userId: string, fileId: string): Promise<{ content: Buffer | null; filename: string }> {
  const row = await queryOne<{ filename?: string; content?: Buffer | null }>(
    "SELECT filename, content FROM documents WHERE user_id = $1 AND id = $2",
    [userId, fileId]
  );

  return {
    content: row?.content ?? null,
    filename: row?.filename ?? "",
  };
}

export async function saveDocumentExtraction(userId: string, fileId: string, extraction: Record<string, unknown>): Promise<void> {
  await execute(
    `UPDATE documents
     SET extracted = 1,
         extraction_json = $1
     WHERE user_id = $2 AND id = $3`,
    [JSON.stringify(extraction), userId, fileId]
  );
}
