import { useState } from "react";
import type { SSEEvent, JobItemProgressPayload } from "@signin-sentinel/shared";
import { api } from "../services/api";
import { useSSE } from "../hooks/useSSE";
import StatusBadge from "../components/common/StatusBadge";

export default function JobRunner() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [running, setRunning] = useState(false);
  const [jobRunId, setJobRunId] = useState<number | null>(null);
  const [progress, setProgress] = useState<JobItemProgressPayload[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("idle");

  useSSE((event: SSEEvent) => {
    switch (event.type) {
      case "job:started":
        setStatus("running");
        setLogs((prev) => [...prev, `Job started`]);
        break;
      case "job:item:started":
        setLogs((prev) => [
          ...prev,
          `Processing: ${(event.payload as any).clientAbbreviation}`,
        ]);
        break;
      case "job:item:progress":
        setProgress((prev) => {
          const payload = event.payload as JobItemProgressPayload;
          const existing = prev.findIndex((p) => p.jobItemId === payload.jobItemId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = payload;
            return updated;
          }
          return [...prev, payload];
        });
        break;
      case "job:item:completed":
        setLogs((prev) => [
          ...prev,
          `Completed: ${(event.payload as any).clientAbbreviation} (${(event.payload as any).signInCount} records)`,
        ]);
        break;
      case "job:item:failed":
        setLogs((prev) => [
          ...prev,
          `Failed: ${(event.payload as any).clientAbbreviation} - ${(event.payload as any).error}`,
        ]);
        break;
      case "job:completed":
        setStatus("completed");
        setRunning(false);
        setLogs((prev) => [...prev, `Job completed.`]);
        break;
      case "job:cancelled":
        setStatus("cancelled");
        setRunning(false);
        setLogs((prev) => [...prev, `Job cancelled.`]);
        break;
    }
  });

  const handleStart = async () => {
    try {
      setRunning(true);
      setStatus("starting");
      setProgress([]);
      setLogs(["Starting job..."]);
      const data = await api.post<{ jobRunId: number }>("/jobs", { dateFrom, dateTo });
      setJobRunId(data.jobRunId);
    } catch (err: any) {
      setStatus("failed");
      setRunning(false);
      setLogs((prev) => [...prev, `Error: ${err.message}`]);
    }
  };

  const handleCancel = async () => {
    if (jobRunId) {
      await api.post(`/jobs/${jobRunId}/cancel`);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">New Job Run</h2>

      {/* Config Panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-medium mb-4">Date Range</h3>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={running}
              className="border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={running}
              className="border rounded px-3 py-2"
            />
          </div>
          <div className="flex items-end gap-2">
            {!running ? (
              <button
                onClick={handleStart}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Run
              </button>
            ) : (
              <button
                onClick={handleCancel}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      {status !== "idle" && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <span className="font-medium">Status:</span>
            <StatusBadge status={status} />
          </div>
        </div>
      )}

      {/* Log Output */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-lg shadow p-4 max-h-96 overflow-auto">
          <h3 className="text-green-400 font-mono text-sm mb-2">Log Output</h3>
          {logs.map((log, i) => (
            <div key={i} className="text-gray-300 font-mono text-sm">
              <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
