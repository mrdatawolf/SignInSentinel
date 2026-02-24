import { useState, useEffect } from "react";
import type { Client } from "@signin-sentinel/shared";
import { api } from "../services/api";
import StatusBadge from "../components/common/StatusBadge";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorBanner from "../components/common/ErrorBanner";

export default function ClientList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ clients: Client[] }>("/clients");
      setClients(data.clients);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post("/clients/sync");
      await fetchClients();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      await api.patch(`/clients/${id}`, { isActive: !isActive });
      await fetchClients();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clients</h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {syncing ? "Syncing..." : "Sync from Excel"}
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchClients} />}

      <div className="bg-white rounded-lg shadow">
        {clients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No clients found. Click "Sync from Excel" to import from the companies file.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Abbreviation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Group</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{client.abbreviation}</td>
                  <td className="px-4 py-3 text-sm">{client.name || "-"}</td>
                  <td className="px-4 py-3 text-sm">{client.group || "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={client.isActive ? "pass" : "skipped"} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(client.id, client.isActive)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {client.isActive ? "Deactivate" : "Activate"}
                    </button>
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
