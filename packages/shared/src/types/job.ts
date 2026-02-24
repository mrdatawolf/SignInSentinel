export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface JobRun {
  id: number;
  status: JobStatus;
  startedAt: string | null;
  completedAt: string | null;
  totalClients: number;
  completedClients: number;
  failedClients: number;
  createdAt: string;
}

export interface JobItem {
  id: number;
  jobRunId: number;
  clientId: number;
  credentialId: number | null;
  status: JobStatus;
  signInCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateJobRequest {
  clientIds?: number[];
  dateFrom: string;
  dateTo: string;
}
