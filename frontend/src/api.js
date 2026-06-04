const BASE = "/api";
const TOKEN_KEY = "utbis_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function req(path, options = {}) {
  const token = getToken();
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  const res = await fetch(`${BASE}${path}`, options);
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
    throw new Error("Session expired — please log in again");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email, password) =>
    req("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  register: (email, password, display_name = "") =>
    req("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name }),
    }),
  logout: () => req("/auth/logout", { method: "POST" }),
  me: () => req("/auth/me"),

  // Scan
  scan: (taxYear = 2025) =>
    req(`/scan?tax_year=${taxYear}`, { method: "POST" }),

  // User data
  listSections: () => req("/user-data"),
  getSection: (section) => req(`/user-data/${section}`),
  getParsedSection: (section) => req(`/user-data/${section}/parsed`),
  updateSection: (section, data) =>
    req(`/user-data/${section}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    }),

  // Reports
  listReports: () => req("/reports"),
  getReport: (name) => req(`/reports/${name}`),
  generateCpaPacket: (taxYear = 2025, withAI = false) =>
    req(`/reports/cpa-packet?tax_year=${taxYear}&with_ai=${withAI}`, { method: "POST" }),
  getCpaPacketStatus: (jobId) => req(`/reports/cpa-packet/${jobId}`),

  // Scenarios
  listScenarios: () => req("/scenarios"),
  runScenario: (key, taxYear = 2025) =>
    req(`/scenarios/${key}?tax_year=${taxYear}`, { method: "POST" }),

  // Tax law
  listChanges: (limit = 20) => req(`/tax-law/changes?limit=${limit}`),
  triggerUpdate: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.source) qs.set("source", params.source);
    if (params.days) qs.set("days", params.days);
    if (params.dry_run) qs.set("dry_run", "true");
    return req(`/tax-law/update?${qs}`, { method: "POST" });
  },
  updateStatus: () => req("/tax-law/status"),
  getAlertCount: (days = 30) => req(`/tax-law/alert-count?since_days=${days}`),

  // Config
  getConfig: () => req("/config"),

  // AI analysis
  triggerAIAnalysis: (taxYear = 2025, mode = "opportunities") =>
    req(`/scan/ai-analysis?tax_year=${taxYear}&mode=${mode}`, { method: "POST" }),
  getAIAnalysisStatus: (jobId) => req(`/scan/ai-analysis/${jobId}`),

  // Planning
  getYearEndPlan: (taxYear = 2025) => req(`/planning/year-end?tax_year=${taxYear}`),

  // Documents
  uploadDocument: (file) => {
    const form = new FormData();
    const token = getToken();
    form.append("file", file);
    return fetch(`${BASE}/documents/upload`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.ok ? r.json() : r.text().then((t) => { throw new Error(t); }));
  },
  listDocuments: () => req("/documents"),
  deleteDocument: (fileId) => req(`/documents/${fileId}`, { method: "DELETE" }),
  extractDocument: (fileId) => req(`/documents/${fileId}/extract`, { method: "POST" }),
  getExtractionStatus: (jobId) => req(`/documents/extract/${jobId}`),
  applyExtraction: (body) =>
    req("/documents/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  // Transactions ledger
  getTransactions: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.benefit_id)   qs.set("benefit_id", params.benefit_id);
    if (params.tax_category) qs.set("tax_category", params.tax_category);
    if (params.status)       qs.set("status", params.status);
    return req(`/transactions?${qs}`);
  },
  getTransactionSummary: () => req("/transactions/summary"),
  reverseTransaction: (txnId) => req(`/transactions/${txnId}`, { method: "DELETE" }),

  // Reconciliation
  getReconciliation: () => req("/reconciliation"),
};
