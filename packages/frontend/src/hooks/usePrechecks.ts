import { useState, useEffect, useCallback } from "react";
import type { PrecheckResult } from "@signin-sentinel/shared";
import { api } from "../services/api";

export function usePrechecks() {
  const [results, setResults] = useState<PrecheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ results: PrecheckResult[] }>("/prechecks");
      setResults(data.results);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const runAll = useCallback(async () => {
    try {
      setRunning(true);
      const data = await api.post<{ results: PrecheckResult[] }>("/prechecks/run");
      setResults(data.results);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }, []);

  const allPassed = results.length > 0 && results.every((r) => r.status === "pass");

  return { results, loading, running, error, runAll, allPassed, refresh: fetchResults };
}
