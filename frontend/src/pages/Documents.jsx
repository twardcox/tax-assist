import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";

const CATEGORY_STYLES = {
  business_expense:    "bg-blue-900 text-blue-300",
  rental_expense:      "bg-purple-900 text-purple-300",
  capital_improvement: "bg-orange-900 text-orange-300",
  medical:             "bg-red-900 text-red-300",
  charitable:          "bg-emerald-900 text-emerald-300",
  education:           "bg-amber-900 text-amber-300",
  repair:              "bg-yellow-900 text-yellow-300",
  mixed_use:           "bg-gray-700 text-gray-300",
  personal_expense:    "bg-gray-800 text-gray-400",
  income_document:     "bg-cyan-900 text-cyan-300",
  w2_income:           "bg-cyan-900 text-cyan-300",
  self_employment_income: "bg-blue-900 text-blue-300",
  interest_income:     "bg-teal-900 text-teal-300",
  dividend_income:     "bg-teal-900 text-teal-300",
  retirement_distribution: "bg-indigo-900 text-indigo-300",
  needs_review:        "bg-gray-900 text-gray-500",
};

function CategoryBadge({ category }) {
  const cls = CATEGORY_STYLES[category] ?? "bg-gray-800 text-gray-400";
  const label = category?.replace(/_/g, " ") ?? "unknown";
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>{label}</span>;
}

function BenefitBadge({ id }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-300 font-mono">
      {id}
    </span>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtMoney(val) {
  if (val == null || val === "") return "—";
  return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatValue(val) {
  if (typeof val === "number") return val.toLocaleString();
  return String(val);
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.tiff,.csv";

export default function Documents() {
  const [activeFile, setActiveFile]       = useState(null);
  const [uploading, setUploading]         = useState(new Set());
  const [dragOver, setDragOver]           = useState(false);
  const [errors, setErrors]               = useState([]);

  // AI extraction state
  const [extractJobId, setExtractJobId]   = useState(null);
  const [extractStatus, setExtractStatus] = useState(null);
  const [extracted, setExtracted]         = useState(null);
  const [deductiblePct, setDeductiblePct] = useState(1.0);
  const [applying, setApplying]           = useState(false);
  const [applied, setApplied]             = useState(false);
  const [applyResult, setApplyResult]     = useState(null);
  const [isDuplicate, setIsDuplicate]     = useState(false);

  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: config } = useQuery({ queryKey: ["config"], queryFn: api.getConfig });
  const { data, isLoading } = useQuery({ queryKey: ["documents"], queryFn: api.listDocuments });
  const files = data?.files ?? [];

  // Reconciliation summary (lightweight)
  const { data: txnSummary } = useQuery({
    queryKey: ["txnSummary"],
    queryFn: api.getTransactionSummary,
    refetchOnWindowFocus: false,
  });

  // Reset extraction state when active file changes
  useEffect(() => {
    setExtractJobId(null);
    setExtractStatus(null);
    setExtracted(null);
    setDeductiblePct(1.0);
    setApplied(false);
    setApplyResult(null);
    setIsDuplicate(false);
  }, [activeFile?.file_id]);

  // Seed deductible_pct from AI result when it arrives
  useEffect(() => {
    if (extracted?.deductible_pct != null) {
      setDeductiblePct(Math.max(0, Math.min(1, extracted.deductible_pct)));
    }
  }, [extracted]);

  // Poll extraction job
  useEffect(() => {
    if (!extractJobId || extractStatus !== "running") return;
    const id = setInterval(async () => {
      try {
        const s = await api.getExtractionStatus(extractJobId);
        if (s.status !== "running") {
          setExtractStatus(s.status);
          setExtracted(s.extracted ?? null);
          clearInterval(id);
        }
      } catch {
        setExtractStatus("error");
        clearInterval(id);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [extractJobId, extractStatus]);

  async function handleUpload(fileList) {
    const newErrors = [];
    const uploads = Array.from(fileList);
    setUploading((s) => new Set([...s, ...uploads.map((f) => f.name)]));
    await Promise.all(
      uploads.map(async (file) => {
        try {
          const result = await api.uploadDocument(file);
          setActiveFile(result);
        } catch (e) {
          newErrors.push(`${file.name}: ${e.message}`);
        } finally {
          setUploading((s) => { const n = new Set(s); n.delete(file.name); return n; });
        }
      })
    );
    setErrors(newErrors);
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  }

  async function handleDelete(fileId, e) {
    e.stopPropagation();
    try {
      await api.deleteDocument(fileId);
      if (activeFile?.file_id === fileId) setActiveFile(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      setErrors([e.message]);
    }
  }

  async function handleExtract() {
    try {
      const { job_id } = await api.extractDocument(activeFile.file_id);
      setExtractJobId(job_id);
      setExtractStatus("running");
      setExtracted(null);
    } catch (e) {
      setExtractStatus("error");
      setExtracted({ error: e.message });
    }
  }

  async function handleApply() {
    if (!extracted?.suggested_updates?.length) return;
    setApplying(true);
    try {
      const result = await api.applyExtraction({
        meta: {
          file_id:       activeFile.file_id,
          filename:      activeFile.file,
          date:          extracted.date ?? null,
          merchant:      extracted.merchant_or_payer ?? null,
          total_amount:  extracted.total_amount ?? 0,
          deductible_pct: deductiblePct,
          tax_category:  extracted.tax_category ?? "",
          benefit_ids:   extracted.benefit_ids ?? [],
          form_line:     extracted.form_line ?? null,
        },
        updates: extracted.suggested_updates,
      });
      setIsDuplicate(result.duplicate === true);
      setApplied(true);
      setApplyResult(result);
      if (!result.duplicate) {
        queryClient.invalidateQueries({ queryKey: ["txnSummary"] });
      }
    } catch (e) {
      setErrors([e.message]);
    } finally {
      setApplying(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }

  const hasUpdates = extracted?.suggested_updates?.length > 0;
  const aiAvailable = config?.ai_available;
  const benefitIds = extracted?.benefit_ids ?? [];
  const pctLabel = `${Math.round(deductiblePct * 100)}%`;

  // Ledger totals for the summary strip
  const ledgerCategories = txnSummary?.by_category ?? [];
  const ledgerTotal = txnSummary?.total_applied?.total_deductible ?? 0;
  const txnCount = txnSummary?.total_applied?.count ?? 0;

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver ? "border-emerald-500 bg-emerald-900/20" : "border-gray-700 hover:border-gray-500"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden"
            onChange={(e) => handleUpload(e.target.files)} />
          <div className="text-2xl mb-1 text-gray-500">↑</div>
          <p className="text-xs text-gray-400">Drop files or click to upload</p>
          <p className="text-[10px] text-gray-600 mt-1">PDF, JPG, PNG, HEIC, CSV</p>
        </div>

        {uploading.size > 0 && (
          <p className="text-xs text-emerald-400 animate-pulse px-1">
            Uploading {uploading.size} file{uploading.size > 1 ? "s" : ""}…
          </p>
        )}
        {errors.length > 0 && (
          <div className="text-xs text-red-400 px-1 space-y-0.5">
            {errors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        {/* Ledger summary strip */}
        {txnCount > 0 && (
          <div className="p-2 bg-gray-900 border border-gray-800 rounded text-xs space-y-1">
            <p className="text-gray-500 font-medium">Ledger</p>
            <p className="text-emerald-400 font-mono">{fmtMoney(ledgerTotal)} deductible</p>
            <p className="text-gray-600">{txnCount} transaction{txnCount !== 1 ? "s" : ""}</p>
            {ledgerCategories.slice(0, 3).map((c) => (
              <div key={c.tax_category} className="flex justify-between text-[10px] text-gray-500">
                <span className="truncate">{c.tax_category?.replace(/_/g, " ")}</span>
                <span className="font-mono ml-1">{fmtMoney(c.total_deductible)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <h2 className="text-xs text-gray-500 uppercase mb-2">
            {files.length} document{files.length !== 1 ? "s" : ""}
          </h2>
          {isLoading ? (
            <p className="text-xs text-gray-600">Loading…</p>
          ) : files.length === 0 ? (
            <p className="text-xs text-gray-600">No documents yet.</p>
          ) : (
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.file_id}>
                  <button
                    onClick={() => setActiveFile(f)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors group flex items-start gap-1 ${
                      activeFile?.file_id === f.file_id
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
                    }`}
                  >
                    <span className="flex-1 truncate">{f.file}</span>
                    <span onClick={(e) => handleDelete(f.file_id, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-opacity ml-1 flex-shrink-0"
                      title="Delete">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main pane */}
      <div className="flex-1 overflow-y-auto">
        {!activeFile ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <p className="text-lg mb-1">No document selected</p>
              <p className="text-sm">Upload a file or select one from the list</p>
            </div>
          </div>
        ) : (
          <div className="max-w-lg space-y-4">
            <h2 className="text-lg font-semibold text-white break-all">{activeFile.file}</h2>

            {/* File metadata */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24">Category</span>
                <CategoryBadge category={activeFile.category} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24">Confidence</span>
                <span className={`text-xs font-medium ${
                  activeFile.confidence === "high" ? "text-emerald-400"
                  : activeFile.confidence === "medium" ? "text-amber-400"
                  : "text-gray-500"
                }`}>{activeFile.confidence}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24">Size</span>
                <span className="text-xs text-gray-400">{formatBytes(activeFile.size)}</span>
              </div>
              {activeFile.note && (
                <div className="p-3 bg-gray-900 border border-gray-800 rounded text-xs text-gray-400">
                  {activeFile.note}
                </div>
              )}
            </div>

            {/* AI Extraction section */}
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs text-gray-400 uppercase tracking-wide">AI Extraction</h3>
                {!applied && (
                  <button
                    onClick={handleExtract}
                    disabled={!aiAvailable || extractStatus === "running"}
                    title={!aiAvailable ? "Set ANTHROPIC_API_KEY to enable AI extraction" : undefined}
                    className="bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    {extractStatus === "running" ? "Extracting…" : "Extract with AI"}
                  </button>
                )}
              </div>

              {extractStatus === "running" && (
                <p className="text-xs text-violet-400 animate-pulse">
                  Reading document with Claude…
                </p>
              )}

              {extractStatus === "error" && (
                <div className="p-3 bg-red-900/40 border border-red-700 rounded text-xs text-red-300">
                  {extracted?.error ?? "Extraction failed. Check that the file is readable."}
                </div>
              )}

              {extractStatus === "complete" && extracted && (
                <div className="space-y-3">
                  {/* Extraction summary */}
                  <div className="p-3 bg-gray-900 border border-gray-800 rounded space-y-1.5 text-xs">
                    {extracted.document_type && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-28">Type</span>
                        <span className="text-gray-300">{extracted.document_type.replace(/_/g, " ")}</span>
                      </div>
                    )}
                    {extracted.merchant_or_payer && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-28">Merchant / Payer</span>
                        <span className="text-gray-300">{extracted.merchant_or_payer}</span>
                      </div>
                    )}
                    {extracted.payer_ein && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-28">EIN</span>
                        <span className="text-gray-400 font-mono">{extracted.payer_ein}</span>
                      </div>
                    )}
                    {extracted.date && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-28">Date</span>
                        <span className="text-gray-300">{extracted.date}</span>
                      </div>
                    )}
                    {extracted.total_amount != null && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-28">Amount</span>
                        <span className="text-emerald-400">{fmtMoney(extracted.total_amount)}</span>
                      </div>
                    )}
                    {extracted.form_line && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-28">Form line</span>
                        <span className="text-gray-400">{extracted.form_line}</span>
                      </div>
                    )}
                    {extracted.description && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-28">Description</span>
                        <span className="text-gray-300">{extracted.description}</span>
                      </div>
                    )}
                    {extracted.confidence && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-28">AI Confidence</span>
                        <span className={
                          extracted.confidence === "high" ? "text-emerald-400"
                          : extracted.confidence === "medium" ? "text-amber-400"
                          : "text-gray-500"
                        }>{extracted.confidence}</span>
                      </div>
                    )}
                    {/* Benefit associations */}
                    {benefitIds.length > 0 && (
                      <div className="flex gap-2 pt-1 border-t border-gray-800">
                        <span className="text-gray-500 w-28 mt-0.5 flex-shrink-0">Benefits</span>
                        <div className="flex flex-wrap gap-1">
                          {benefitIds.map((id) => <BenefitBadge key={id} id={id} />)}
                        </div>
                      </div>
                    )}
                    {extracted.notes && (
                      <p className="text-gray-500 pt-1 border-t border-gray-800">{extracted.notes}</p>
                    )}
                  </div>

                  {/* Deductibility slider — only for expense docs with updates */}
                  {!applied && hasUpdates && extracted.document_type !== "w2" && (
                    <div className="p-3 bg-gray-900 border border-gray-800 rounded text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Deductibility</span>
                        <span className={`font-mono font-semibold ${
                          deductiblePct >= 0.9 ? "text-emerald-400"
                          : deductiblePct >= 0.5 ? "text-amber-400"
                          : "text-red-400"
                        }`}>{pctLabel}</span>
                      </div>
                      <input
                        type="range" min="0" max="100"
                        value={Math.round(deductiblePct * 100)}
                        onChange={(e) => setDeductiblePct(Number(e.target.value) / 100)}
                        className="w-full accent-violet-500"
                      />
                      <p className="text-gray-600 text-[10px]">
                        Adjust for mixed-use items (e.g. 60% for a business phone).
                        Business meals are 50% per IRC §274.
                      </p>
                      {extracted.total_amount != null && deductiblePct < 1 && (
                        <div className="flex justify-between text-[11px] pt-1 border-t border-gray-800">
                          <span className="text-gray-500">Deductible amount</span>
                          <span className="text-emerald-400 font-mono">
                            {fmtMoney(extracted.total_amount * deductiblePct)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proposed updates */}
                  {!applied && hasUpdates && (
                    <div className="border border-violet-800 rounded-lg overflow-hidden">
                      <div className="bg-violet-900/30 px-3 py-2 text-xs font-medium text-violet-300">
                        Proposed Updates to Your Data
                      </div>
                      <ul className="divide-y divide-gray-800">
                        {extracted.suggested_updates.map((u, i) => {
                          const scaledVal = (u.operation === "add" && typeof u.value === "number" && u.value > 0)
                            ? u.value * deductiblePct : u.value;
                          const showBoth = u.operation === "add" && typeof u.value === "number"
                            && deductiblePct < 1 && u.value > 0;
                          return (
                            <li key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                              <span className="text-gray-300">{u.label}</span>
                              <span className="text-emerald-400 font-mono flex-shrink-0">
                                {showBoth && (
                                  <span className="text-gray-600 line-through mr-1">
                                    {u.operation === "add" ? "+" : ""}{formatValue(u.value)}
                                  </span>
                                )}
                                {u.operation === "add" ? "+" : ""}{formatValue(
                                  typeof scaledVal === "number" ? Number(scaledVal.toFixed(2)) : scaledVal
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="px-3 py-2 flex gap-2 bg-gray-900/50">
                        <button
                          onClick={handleApply}
                          disabled={applying}
                          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1 rounded text-xs transition-colors"
                        >
                          {applying ? "Applying…" : "Apply All"}
                        </button>
                        <button
                          onClick={() => { setExtracted(null); setExtractStatus(null); }}
                          className="text-gray-500 hover:text-gray-300 px-3 py-1 text-xs transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {!applied && !hasUpdates && (
                    <p className="text-xs text-gray-500">
                      No automatic updates suggested — review the extraction above and update My Data manually.
                    </p>
                  )}

                  {/* Apply result */}
                  {applied && applyResult && (
                    isDuplicate ? (
                      <div className="p-3 bg-amber-900/30 border border-amber-700 rounded text-xs text-amber-300 space-y-1">
                        <p className="font-medium">Already applied</p>
                        <p className="text-amber-400/70">
                          This file was previously applied to your data. Re-uploading will not create a duplicate entry.
                          To revert it, find the transaction in the ledger and reverse it first.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-900/30 border border-emerald-700 rounded text-xs text-emerald-300 space-y-1">
                        <p className="font-medium">
                          ✓ {applyResult.applied?.length ?? 0} update{applyResult.applied?.length !== 1 ? "s" : ""} applied
                          {deductiblePct < 1 && ` at ${pctLabel} deductibility`}
                        </p>
                        {applyResult.skipped?.length > 0 && (
                          <p className="text-gray-500">{applyResult.skipped.length} skipped (path not found in data)</p>
                        )}
                        <p className="mt-2">
                          <Link to="/dashboard" className="underline hover:text-emerald-200">
                            Run a new scan to see the impact →
                          </Link>
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}

              {!extractStatus && !aiAvailable && (
                <p className="text-xs text-gray-600">
                  Set <span className="font-mono">ANTHROPIC_API_KEY</span> in <span className="font-mono">.env</span> to enable AI extraction.
                </p>
              )}
            </div>

            {/* Delete */}
            <div className="border-t border-gray-800 pt-3">
              <button
                onClick={(e) => handleDelete(activeFile.file_id, e)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors"
              >
                Delete file
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
