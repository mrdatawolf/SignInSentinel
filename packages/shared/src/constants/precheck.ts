import type { PrecheckDefinition } from "../types/precheck.js";

export const PRECHECK_DEFINITIONS: PrecheckDefinition[] = [
  { name: "env-file", label: "Environment File", dependsOn: [] },
  { name: "base-folder-access", label: "Base Folder Access", dependsOn: ["env-file"] },
  { name: "companies-file", label: "Companies File", dependsOn: ["base-folder-access"] },
  { name: "companies-file-parse", label: "Companies File Format", dependsOn: ["companies-file"] },
  { name: "admin-emails-file", label: "Admin Emails File", dependsOn: ["env-file"] },
  { name: "admin-emails-parse", label: "Admin Emails Format", dependsOn: ["admin-emails-file"] },
  { name: "graph-config-exists", label: "Graph API Configuration", dependsOn: [] },
  { name: "graph-api-connection", label: "Graph API Connection", dependsOn: ["graph-config-exists"] },
  { name: "database-health", label: "Database Health", dependsOn: [] },
];
