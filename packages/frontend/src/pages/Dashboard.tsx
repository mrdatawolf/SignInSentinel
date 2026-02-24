import { Link } from "react-router-dom";
import { useJobs } from "../hooks/useJobs";
import { usePrechecks } from "../hooks/usePrechecks";
import StatusBadge from "../components/common/StatusBadge";
import LoadingSpinner from "../components/common/LoadingSpinner";

export default function Dashboard() {
  const { jobs, loading: jobsLoading } = useJobs();
  const { results: prechecks, allPassed, loading: prechecksLoading } = usePrechecks();

  if (jobsLoading || prechecksLoading) {
    return <LoadingSpinner />;
  }

  const recentJobs = jobs.slice(0, 5);
  const failedChecks = prechecks.filter((p) => p.status === "fail");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <Link
          to="/jobs/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start New Run
        </Link>
      </div>

      {/* Precheck Warning */}
      {failedChecks.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800">Setup Incomplete</h3>
          <p className="text-sm text-yellow-700 mt-1">
            {failedChecks.length} precheck(s) failed.{" "}
            <Link to="/settings" className="underline font-medium">
              Go to Settings
            </Link>{" "}
            to resolve.
          </p>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">System Status</p>
          <p className="text-2xl font-bold mt-1">
            {allPassed ? (
              <span className="text-green-600">Ready</span>
            ) : (
              <span className="text-yellow-600">Needs Setup</span>
            )}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Runs</p>
          <p className="text-2xl font-bold mt-1">{jobs.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Last Run</p>
          <p className="text-lg font-bold mt-1">
            {recentJobs.length > 0
              ? new Date(recentJobs[0].createdAt).toLocaleDateString()
              : "Never"}
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-medium">Recent Activity</h3>
        </div>
        {recentJobs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No job runs yet. Start your first run!
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Clients</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link to={`/jobs/${job.id}`} className="text-blue-600 hover:underline">
                      {new Date(job.createdAt).toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {job.completedClients}/{job.totalClients}
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
