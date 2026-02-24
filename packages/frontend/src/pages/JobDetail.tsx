import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import type { JobRun, JobItem } from "@signin-sentinel/shared";
import { api } from "../services/api";
import StatusBadge from "../components/common/StatusBadge";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorBanner from "../components/common/ErrorBanner";

interface JobDetailData {
  run: JobRun;
  items: JobItem[];
}

interface ExportFile {
  filePath: string;
  recordCount: number;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<JobDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ files: ExportFile[]; totalRecords: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  // Map of clientId → abbreviation for display
  const [clientNames, setClientNames] = useState<Record<number, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const result = await api.get<JobDetailData>(`/jobs/${id}`);
        setData(result);

        // Fetch client abbreviations for the items
        const clientRes = await api.get<{ clients: Array<{ id: number; abbreviation: string }> }>("/clients");
        const names: Record<number, string> = {};
        for (const c of clientRes.clients) {
          names[c.id] = c.abbreviation;
        }
        setClientNames(names);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleExport = async () => {
    try {
      setExporting(true);
      setExportError(null);
      const result = await api.post<{ files: ExportFile[]; totalRecords: number }>(`/jobs/${id}/export`);
      setExportResult(result);
    } catch (err: any) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return <ErrorBanner message="Job run not found." />;

  const { run, items } = data;
  const canExport = run.status === "completed" || run.status === "failed";
  const duration = run.startedAt && run.completedAt
    ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/jobs" className="text-gray-400 hover:text-gray-600">
            &larr; Back
          </Link>
          <h2 className="text-2xl font-bold">Job Run #{run.id}</h2>
          <StatusBadge status={run.status} />
        </div>
        {canExport && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {exporting ? "Exporting..." : "Export JSON"}
          </button>
        )}
      </div>

      {/* Export result */}
      {exportResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-800">Export Complete</h3>
          <p className="text-sm text-green-700 mt-1">
            {exportResult.files.length} file(s), {exportResult.totalRecords} total records
          </p>
          <ul className="mt-2 text-xs text-green-600 space-y-1">
            {exportResult.files.map((f) => (
              <li key={f.filePath}>{f.filePath} ({f.recordCount} records)</li>
            ))}
          </ul>
        </div>
      )}
      {exportError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">Export failed: {exportError}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Started</p>
          <p className="text-sm font-medium mt-1">
            {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Duration</p>
          <p className="text-sm font-medium mt-1">
            {duration !== null ? `${duration}s` : "—"}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-lg font-bold mt-1 text-green-600">{run.completedClients}/{run.totalClients}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Failed</p>
          <p className="text-lg font-bold mt-1 text-red-600">{run.failedClients}</p>
        </div>
      </div>

      {/* Job Items Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-medium">Client Items</h3>
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No items in this job run.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Client</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Records</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Started</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {clientNames[item.clientId] || `Client #${item.clientId}`}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-sm">{item.signInCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.startedAt ? new Date(item.startedAt).toLocaleTimeString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                    {item.errorMessage || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
