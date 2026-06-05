import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { api } from "../api";

export default function Reports() {
  const [activeReport, setActiveReport] = useState(null);
  const [withAI, setWithAI]             = useState(false);
  const [cpaJobId, setCpaJobId]         = useState(null);
  const [cpaStatus, setCpaStatus]       = useState(null);

  const queryClient = useQueryClient();

  const { data: config } = useQuery({ queryKey: ["config"], queryFn: api.getConfig });

  const { data: listData, isLoading: loadingList } = useQuery({
    queryKey: ["reports-list"],
    queryFn: api.listReports,
  });

  const { data: reportData, isLoading: loadingReport } = useQuery({
    queryKey: ["report", activeReport],
    queryFn: () => api.getReport(activeReport),
    enabled: !!activeReport,
  });

  useEffect(() => {
    if (!cpaJobId || cpaStatus !== "running") return;
    const id = setInterval(async () => {
      try {
        const s = await api.getCpaPacketStatus(cpaJobId);
        if (s.status !== "running") {
          setCpaStatus(s.status);
          if (s.status === "complete" && s.report_name) {
            await queryClient.invalidateQueries({ queryKey: ["reports-list"] });
            setActiveReport(s.report_name);
          }
          clearInterval(id);
        }
      } catch {
        setCpaStatus("error");
        clearInterval(id);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [cpaJobId, cpaStatus, queryClient]);

  async function handleGenerateCpaPacket() {
    try {
      const { job_id } = await api.generateCpaPacket(2025, withAI);
      setCpaJobId(job_id);
      setCpaStatus("running");
    } catch {
      setCpaStatus("error");
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Report list */}
      <div className="w-52 flex-shrink-0 flex flex-col gap-4">
        {/* CPA Packet generator */}
        <div className="border border-gray-800 rounded-lg p-3 flex flex-col gap-2">
          <h2 className="text-xs text-gray-500 uppercase">CPA Packet</h2>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={withAI}
              onChange={(e) => setWithAI(e.target.checked)}
              disabled={!config?.ai_available}
              className="accent-violet-500"
            />
            <span title={!config?.ai_available ? "Set ANTHROPIC_API_KEY to enable" : undefined}>
              With AI Summary
            </span>
          </label>
          <button
            onClick={handleGenerateCpaPacket}
            disabled={cpaStatus === "running"}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs transition-colors"
          >
            {cpaStatus === "running" ? "Generating…" : "Generate"}
          </button>
          {cpaStatus === "error" && (
            <p className="text-xs text-red-400">Generation failed.</p>
          )}
        </div>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto">
          <h2 className="text-xs text-gray-500 uppercase mb-3">Generated Reports</h2>
          {loadingList ? (
            <p className="text-gray-600 text-xs">Loading…</p>
          ) : listData?.reports?.length === 0 ? (
            <p className="text-gray-600 text-xs">No reports yet. Run a scan first.</p>
          ) : (
            <ul className="space-y-1">
              {listData?.reports?.map(({ name }) => (
                <li key={name}>
                  <button
                    onClick={() => setActiveReport(name)}
                    className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                      activeReport === name
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
                    }`}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Report viewer */}
      <div className="flex-1 overflow-y-auto">
        {!activeReport ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            Select a report to view
          </div>
        ) : loadingReport ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Loading…
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-gray-300 prose-li:text-gray-300 prose-code:text-emerald-400 prose-strong:text-white">
            <ReactMarkdown>{reportData?.content ?? ""}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
