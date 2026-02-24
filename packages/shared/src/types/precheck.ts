export type PrecheckStatus = "pass" | "fail" | "warn" | "skipped";

export interface PrecheckResult {
  id?: number;
  checkName: string;
  status: PrecheckStatus;
  message: string;
  details?: Record<string, unknown>;
  resolution?: string;
  checkedAt?: string;
}

export interface PrecheckDefinition {
  name: string;
  label: string;
  dependsOn: string[];
}
