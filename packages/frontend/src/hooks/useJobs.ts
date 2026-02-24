import { useState, useEffect, useCallback } from "react";
import type { JobRun } from "@signin-sentinel/shared";
import { api } from "../services/api";

export function useJobs() {
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ runs: JobRun[] }>("/jobs");
      setJobs(data.runs);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return { jobs, loading, error, refresh: fetchJobs };
}
