import { useState, useEffect, useCallback } from "react";
import type { ConfigEntry } from "@signin-sentinel/shared";
import { api } from "../services/api";

export function useConfig() {
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<{ configs: ConfigEntry[] }>("/config");
      setConfigs(data.configs);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const updateConfig = useCallback(
    async (key: string, value: string, encrypted = false) => {
      await api.put(`/config/${key}`, { value, encrypted });
      await fetchConfigs();
    },
    [fetchConfigs]
  );

  const deleteConfig = useCallback(
    async (key: string) => {
      await api.delete(`/config/${key}`);
      await fetchConfigs();
    },
    [fetchConfigs]
  );

  return { configs, loading, error, updateConfig, deleteConfig, refresh: fetchConfigs };
}
