interface StatusBadgeProps {
  status: string;
}

const statusColors: Record<string, string> = {
  pass: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  fail: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
  warn: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800",
  in_progress: "bg-blue-100 text-blue-800",
  pending: "bg-gray-100 text-gray-800",
  skipped: "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const colors = statusColors[status] || "bg-gray-100 text-gray-800";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}
    >
      {status}
    </span>
  );
}
