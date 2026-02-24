export type SSEEventType =
  | "precheck:started"
  | "precheck:result"
  | "precheck:completed"
  | "job:started"
  | "job:item:started"
  | "job:item:progress"
  | "job:item:completed"
  | "job:item:failed"
  | "job:completed"
  | "job:cancelled"
  | "sync:started"
  | "sync:completed";

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  timestamp: string;
  payload: T;
}

export interface JobItemProgressPayload {
  jobRunId: number;
  jobItemId: number;
  clientAbbreviation: string;
  recordsFetched: number;
  pagesProcessed: number;
}

export interface JobItemCompletedPayload {
  jobRunId: number;
  jobItemId: number;
  clientAbbreviation: string;
  signInCount: number;
}

export interface JobItemFailedPayload {
  jobRunId: number;
  jobItemId: number;
  clientAbbreviation: string;
  error: string;
}

export interface JobCompletedPayload {
  jobRunId: number;
  totalClients: number;
  completedClients: number;
  failedClients: number;
  totalRecords: number;
  durationMs: number;
}
