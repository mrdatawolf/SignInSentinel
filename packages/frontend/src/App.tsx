import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { initApiBaseUrl, api } from "./services/api";
import type { PrecheckResult } from "@signin-sentinel/shared";
import AppShell from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import ClientList from "./pages/ClientList";
import JobRunner from "./pages/JobRunner";
import JobHistory from "./pages/JobHistory";
import JobDetail from "./pages/JobDetail";
import Settings from "./pages/Settings";
import SetupWizard from "./pages/SetupWizard";
import LoadingSpinner from "./components/common/LoadingSpinner";

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    async function init() {
      await initApiBaseUrl();
      // Check if prechecks indicate first-run setup is needed
      try {
        const data = await api.get<{ results: PrecheckResult[] }>("/prechecks");
        const hasFail = data.results.some((r) => r.status === "fail");
        const noResults = data.results.length === 0;
        setNeedsSetup(hasFail || noResults);
      } catch {
        // If API isn't ready yet, assume setup needed
        setNeedsSetup(true);
      }
      setReady(true);
    }
    init();
  }, []);

  if (!ready) return <LoadingSpinner message="Initializing..." />;

  return (
    <Routes>
      <Route path="/setup" element={<SetupWizard onComplete={() => setNeedsSetup(false)} />} />
      <Route element={<AppShell />}>
        <Route path="/" element={needsSetup ? <Navigate to="/setup" replace /> : <Dashboard />} />
        <Route path="/clients" element={<ClientList />} />
        <Route path="/jobs/new" element={<JobRunner />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/jobs" element={<JobHistory />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
