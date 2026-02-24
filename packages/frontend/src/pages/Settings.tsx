import { useState, useEffect, useCallback } from "react";
import { useConfig } from "../hooks/useConfig";
import { usePrechecks } from "../hooks/usePrechecks";
import { api } from "../services/api";
import type { Credential } from "@signin-sentinel/shared";
import StatusBadge from "../components/common/StatusBadge";
import LoadingSpinner from "../components/common/LoadingSpinner";

const CONFIG_FIELDS = [
  { key: "baseFolder", label: "Base Folder (UNC path)", placeholder: "\\\\server\\share\\folder" },
  { key: "companiesFilename", label: "Companies Filename", placeholder: "companies.xlsx" },
  { key: "adminEmailsFile", label: "Admin Emails File Path", placeholder: "\\\\server\\share\\file.xlsx" },
  { key: "defaultDateRangeDays", label: "Default Date Range (days)", placeholder: "7" },
  { key: "exportOutputDir", label: "Export Output Directory", placeholder: "C:\\exports" },
  { key: "graphPageSize", label: "Graph API Page Size", placeholder: "500" },
];

export default function Settings() {
  const { configs, loading, updateConfig } = useConfig();
  const { results: prechecks, running: prechecksRunning, runAll } = usePrechecks();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Credentials state
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credsLoading, setCredsLoading] = useState(true);
  const [editingCredId, setEditingCredId] = useState<number | null>(null);
  const [graphForm, setGraphForm] = useState({ tenantId: "", clientAppId: "", clientSecret: "" });
  const [savingCred, setSavingCred] = useState(false);
  const [testingCred, setTestingCred] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ credId: number; success: boolean; message: string } | null>(null);

  const fetchCredentials = useCallback(async () => {
    try {
      setCredsLoading(true);
      const data = await api.get<{ credentials: Credential[] }>("/credentials");
      setCredentials(data.credentials);
    } catch {
      // silently fail - credentials may not exist yet
    } finally {
      setCredsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  if (loading) return <LoadingSpinner />;

  const getConfigValue = (key: string) => {
    if (editValues[key] !== undefined) return editValues[key];
    const entry = configs.find((c) => c.key === key);
    return entry?.value || "";
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await updateConfig(key, editValues[key] || getConfigValue(key));
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  const handleEditGraphConfig = (cred: Credential) => {
    setEditingCredId(cred.id);
    setGraphForm({
      tenantId: cred.tenantId || "",
      clientAppId: cred.clientAppId || "",
      clientSecret: "",
    });
    setTestResult(null);
  };

  const handleSaveGraphConfig = async () => {
    if (!editingCredId) return;
    setSavingCred(true);
    try {
      await api.put(`/credentials/${editingCredId}/graph-config`, graphForm);
      setEditingCredId(null);
      fetchCredentials();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSavingCred(false);
    }
  };

  const handleTestConnection = async (credId: number) => {
    setTestingCred(credId);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; tenantName?: string; error?: string }>(
        "/graph/test-connection",
        { credentialId: credId }
      );
      setTestResult({
        credId,
        success: result.success,
        message: result.success ? `Connected (${result.tenantName})` : result.error || "Failed",
      });
    } catch (err: any) {
      setTestResult({ credId, success: false, message: err.message });
    } finally {
      setTestingCred(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-medium">Configuration</h3>
          <p className="text-sm text-gray-500 mt-1">
            Values stored in the database override the .env file.
          </p>
        </div>
        <div className="p-4 space-y-4">
          {CONFIG_FIELDS.map((field) => (
            <div key={field.key} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={getConfigValue(field.key)}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {editValues[field.key] !== undefined && (
                <button
                  onClick={() => handleSave(field.key)}
                  disabled={saving === field.key}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving === field.key ? "Saving..." : "Save"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Credentials / Graph Config */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-medium">Graph API Credentials</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure Azure AD app registration per client. Sync clients from Excel first to populate this list.
          </p>
        </div>
        {credsLoading ? (
          <div className="p-4"><LoadingSpinner message="Loading credentials..." /></div>
        ) : credentials.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm">
            No credentials found. Sync clients from the Clients page to create credential entries.
          </div>
        ) : (
          <div className="divide-y">
            {credentials.map((cred) => (
              <div key={cred.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{cred.email}</p>
                    <p className="text-xs text-gray-500">
                      Client #{cred.clientId}
                      {cred.tenantId && ` \u00B7 Tenant: ${cred.tenantId.substring(0, 8)}...`}
                      {cred.hasClientSecret && " \u00B7 Secret configured"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {cred.tenantId && cred.hasClientSecret && (
                      <button
                        onClick={() => handleTestConnection(cred.id)}
                        disabled={testingCred === cred.id}
                        className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                      >
                        {testingCred === cred.id ? "Testing..." : "Test"}
                      </button>
                    )}
                    <button
                      onClick={() => handleEditGraphConfig(cred)}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      {cred.tenantId ? "Edit" : "Configure"}
                    </button>
                  </div>
                </div>
                {testResult && testResult.credId === cred.id && (
                  <div className={`mt-2 text-xs px-2 py-1 rounded ${testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {testResult.message}
                  </div>
                )}
                {editingCredId === cred.id && (
                  <div className="mt-3 p-3 bg-gray-50 rounded space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tenant ID</label>
                      <input
                        type="text"
                        value={graphForm.tenantId}
                        onChange={(e) => setGraphForm((f) => ({ ...f, tenantId: e.target.value }))}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Client App ID</label>
                      <input
                        type="text"
                        value={graphForm.clientAppId}
                        onChange={(e) => setGraphForm((f) => ({ ...f, clientAppId: e.target.value }))}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Client Secret {cred.hasClientSecret && "(leave blank to keep existing)"}
                      </label>
                      <input
                        type="password"
                        value={graphForm.clientSecret}
                        onChange={(e) => setGraphForm((f) => ({ ...f, clientSecret: e.target.value }))}
                        placeholder="Enter client secret"
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveGraphConfig}
                        disabled={savingCred || !graphForm.tenantId || !graphForm.clientAppId}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingCred ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingCredId(null)}
                        className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prechecks */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-medium">Prechecks</h3>
          <button
            onClick={runAll}
            disabled={prechecksRunning}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {prechecksRunning ? "Running..." : "Run All"}
          </button>
        </div>
        <div className="divide-y">
          {prechecks.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">
              No precheck results yet. Click "Run All" to check your setup.
            </div>
          ) : (
            prechecks.map((check) => (
              <div key={check.checkName} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{check.checkName}</p>
                  <p className="text-sm text-gray-500">{check.message}</p>
                  {check.resolution && check.status === "fail" && (
                    <p className="text-xs text-red-600 mt-1">{check.resolution}</p>
                  )}
                </div>
                <StatusBadge status={check.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
