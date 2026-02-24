import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import StatusBadge from "../components/common/StatusBadge";
import type { PrecheckResult } from "@signin-sentinel/shared";

type Step = "paths" | "validate" | "graph" | "summary";

interface ResolvedConfig {
  baseFolder?: string;
  companiesFilename?: string;
  adminEmailsFile?: string;
}

interface SetupWizardProps {
  onComplete?: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("paths");
  const [baseFolder, setBaseFolder] = useState("");
  const [companiesFilename, setCompaniesFilename] = useState("companies.xlsx");
  const [adminEmailsFile, setAdminEmailsFile] = useState("");
  const [saving, setSaving] = useState(false);
  const [precheckResults, setPrecheckResults] = useState<PrecheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill fields from .env / DB config on mount
  useEffect(() => {
    api.get<ResolvedConfig>("/config/resolved").then((data) => {
      if (data.baseFolder) setBaseFolder(data.baseFolder);
      if (data.companiesFilename) setCompaniesFilename(data.companiesFilename);
      if (data.adminEmailsFile) setAdminEmailsFile(data.adminEmailsFile);
    }).catch(() => {
      // Ignore — fields stay at defaults
    });
  }, []);

  const saveAndNext = async (nextStep: Step) => {
    setSaving(true);
    setError(null);
    try {
      await api.put("/config/baseFolder", { value: baseFolder });
      await api.put("/config/companiesFilename", { value: companiesFilename });
      await api.put("/config/adminEmailsFile", { value: adminEmailsFile });
      setStep(nextStep);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runPrechecks = async () => {
    setSaving(true);
    try {
      const data = await api.post<{ results: PrecheckResult[] }>("/prechecks/run");
      setPrecheckResults(data.results);
      setStep("summary");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const allPassed = precheckResults.length > 0 && precheckResults.every((r) => r.status === "pass");

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h2 className="text-2xl font-bold mb-2">Setup Wizard</h2>
      <p className="text-gray-500 mb-8">Let's get everything configured so you can start fetching sign-in logs.</p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(["paths", "validate", "graph", "summary"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded ${step === s ? "bg-blue-600" : i < ["paths", "validate", "graph", "summary"].indexOf(step) ? "bg-blue-300" : "bg-gray-200"}`}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Step 1: File Paths */}
      {step === "paths" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="font-medium text-lg">Step 1: Configure File Paths</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Folder (UNC path)</label>
            <input
              type="text"
              value={baseFolder}
              onChange={(e) => setBaseFolder(e.target.value)}
              placeholder="\\\\192.168.203.207\\Shared Folders\\PBIData\\Biztech"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Companies Filename</label>
            <input
              type="text"
              value={companiesFilename}
              onChange={(e) => setCompaniesFilename(e.target.value)}
              placeholder="companies.xlsx"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Emails File (full path)</label>
            <input
              type="text"
              value={adminEmailsFile}
              onChange={(e) => setAdminEmailsFile(e.target.value)}
              placeholder="\\\\192.168.203.207\\Shared Folders\\Data\\CDMS\\Admin Emails.xlsx"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <button
            onClick={() => saveAndNext("validate")}
            disabled={saving || !baseFolder || !adminEmailsFile}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Next: Validate Files"}
          </button>
        </div>
      )}

      {/* Step 2: Validate */}
      {step === "validate" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="font-medium text-lg">Step 2: Validate Files</h3>
          <p className="text-gray-500">We'll check that your file paths are accessible and have the expected format.</p>
          <button
            onClick={runPrechecks}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Checking..." : "Run Validation"}
          </button>
          <button
            onClick={() => setStep("graph")}
            className="ml-3 px-6 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            Skip to Graph Config
          </button>
        </div>
      )}

      {/* Step 3: Graph API */}
      {step === "graph" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="font-medium text-lg">Step 3: Azure AD Configuration</h3>
          <p className="text-gray-500">
            Each client tenant needs an Azure AD app registration with <code>AuditLog.Read.All</code> permission.
            You can configure these in Settings after setup.
          </p>
          <button
            onClick={runPrechecks}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Checking..." : "Run Final Checks"}
          </button>
        </div>
      )}

      {/* Step 4: Summary */}
      {step === "summary" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="font-medium text-lg">Setup Summary</h3>
          <div className="divide-y">
            {precheckResults.map((r) => (
              <div key={r.checkName} className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.checkName}</span>
                  <StatusBadge status={r.status} />
                </div>
                {r.status === "fail" && r.message && (
                  <p className="text-xs text-red-600 mt-1">{r.message}</p>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => { onComplete?.(); navigate("/"); }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {allPassed ? "Go to Dashboard" : "Continue to Dashboard"}
          </button>
        </div>
      )}
    </div>
  );
}
