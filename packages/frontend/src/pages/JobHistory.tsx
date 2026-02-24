import { Link } from "react-router-dom";
import { useJobs } from "../hooks/useJobs";
import StatusBadge from "../components/common/StatusBadge";
import LoadingSpinner from "../components/common/LoadingSpinner";

export default function JobHistory() {
  const { jobs, loading } = useJobs();

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Job History</h2>

      <div className="bg-white rounded-lg shadow">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No job runs yet.{" "}
            <Link to="/jobs/new" className="text-blue-600 hover:underline">
              Start your first run
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Completed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Failed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => {
                const duration =
                  job.startedAt && job.completedAt
                    ? Math.round(
                        (new Date(job.completedAt).getTime() -
                          new Date(job.startedAt).getTime()) /
                          1000
                      )
                    : null;
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link to={`/jobs/${job.id}`} className="text-blue-600 hover:underline">
                        #{job.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {job.completedClients}/{job.totalClients}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600">
                      {job.failedClients || 0}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {duration !== null ? `${duration}s` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
