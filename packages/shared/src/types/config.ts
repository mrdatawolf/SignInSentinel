export interface ConfigEntry {
  id: number;
  key: string;
  value: string | null;
  encrypted: boolean;
  updatedAt: string;
}

export interface ConfigMap {
  baseFolder: string;
  companiesFilename: string;
  adminEmailsFile: string;
  defaultDateRangeDays: string;
  exportOutputDir: string;
  graphPageSize: string;
}

export type ConfigKey = keyof ConfigMap;
