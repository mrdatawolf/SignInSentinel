import { eq } from "drizzle-orm";
import { getDb } from "../database/connection";
import { getPgClient } from "../database/connection";
import { precheckResults, credentials } from "../database/schema";
import { getConfig } from "./config.service";
import { checkAccess, checkDirectoryAccess, resolveCompaniesPath } from "./file-access.service";
import { readCompaniesFile, readAdminEmailsFile } from "./excel.service";
import { testGraphConnection } from "./graph-auth.service";
import { emitSSE } from "../utils/event-bus";
import { logger } from "../utils/logger";
import { PRECHECK_DEFINITIONS } from "@signin-sentinel/shared";
import type { PrecheckResult, PrecheckStatus } from "@signin-sentinel/shared";

type CheckFn = () => Promise<PrecheckResult>;

function makeResult(
  checkName: string,
  status: PrecheckStatus,
  message: string,
  details?: Record<string, unknown>
): PrecheckResult {
  return { checkName, status, message, details, checkedAt: new Date().toISOString() };
}

// ─── Individual Check Implementations ────────────────────────

async function checkEnvFile(): Promise<PrecheckResult> {
  const baseFolder = await getConfig("baseFolder");
  const companiesFilename = await getConfig("companiesFilename");

  if (!baseFolder) {
    return makeResult("env-file", "fail", "baseFolder is not configured.", {
      resolution: "Set baseFolder in .env or via Settings.",
    });
  }
  if (!companiesFilename) {
    return makeResult("env-file", "fail", "companiesFilename is not configured.", {
      resolution: "Set companiesFilename in .env or via Settings.",
    });
  }

  return makeResult("env-file", "pass", "Required configuration values are present.", {
    baseFolder,
    companiesFilename,
  });
}

async function checkBaseFolderAccess(): Promise<PrecheckResult> {
  const baseFolder = await getConfig("baseFolder");
  if (!baseFolder) {
    return makeResult("base-folder-access", "fail", "baseFolder not configured.");
  }

  const result = await checkDirectoryAccess(baseFolder);
  if (!result.accessible) {
    return makeResult("base-folder-access", "fail", `Cannot access base folder: ${result.error}`, {
      path: baseFolder,
      resolution: "Verify the UNC path is reachable and you have read access.",
    });
  }

  return makeResult("base-folder-access", "pass", "Base folder is accessible.", {
    path: baseFolder,
  });
}

async function checkCompaniesFile(): Promise<PrecheckResult> {
  const baseFolder = await getConfig("baseFolder");
  const companiesFilename = await getConfig("companiesFilename");
  if (!baseFolder || !companiesFilename) {
    return makeResult("companies-file", "fail", "File path configuration missing.");
  }

  const filePath = resolveCompaniesPath(baseFolder, companiesFilename);
  const result = await checkAccess(filePath);
  if (!result.accessible) {
    return makeResult("companies-file", "fail", `Cannot access companies file: ${result.error}`, {
      path: filePath,
      resolution: "Verify the file exists at the configured path.",
    });
  }

  return makeResult("companies-file", "pass", "Companies file is accessible.", {
    path: filePath,
  });
}

async function checkCompaniesFileParse(): Promise<PrecheckResult> {
  const baseFolder = await getConfig("baseFolder");
  const companiesFilename = await getConfig("companiesFilename");
  if (!baseFolder || !companiesFilename) {
    return makeResult("companies-file-parse", "fail", "File path configuration missing.");
  }

  const filePath = resolveCompaniesPath(baseFolder, companiesFilename);
  try {
    const clients = await readCompaniesFile(filePath);
    if (clients.length === 0) {
      return makeResult("companies-file-parse", "warn", "Companies file parsed but no SLG clients found.", {
        path: filePath,
        clientCount: 0,
      });
    }
    return makeResult("companies-file-parse", "pass", `Parsed ${clients.length} client abbreviations.`, {
      path: filePath,
      clientCount: clients.length,
      sample: clients.slice(0, 5).map((c) => c.abbreviation),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return makeResult("companies-file-parse", "fail", `Failed to parse companies file: ${message}`, {
      path: filePath,
      resolution: 'Verify the file has a "Companies" worksheet with "Abbrv" and "Group" columns.',
    });
  }
}

async function checkAdminEmailsFile(): Promise<PrecheckResult> {
  const adminEmailsFile = await getConfig("adminEmailsFile");
  if (!adminEmailsFile) {
    return makeResult("admin-emails-file", "warn", "adminEmailsFile is not configured. Credentials sync will be skipped.", {
      resolution: "Set adminEmailsFile in .env or via Settings to enable credential sync.",
    });
  }

  const result = await checkAccess(adminEmailsFile);
  if (!result.accessible) {
    return makeResult("admin-emails-file", "fail", `Cannot access admin emails file: ${result.error}`, {
      path: adminEmailsFile,
      resolution: "Verify the UNC path is reachable and you have read access.",
    });
  }

  return makeResult("admin-emails-file", "pass", "Admin emails file is accessible.", {
    path: adminEmailsFile,
  });
}

async function checkAdminEmailsParse(): Promise<PrecheckResult> {
  const adminEmailsFile = await getConfig("adminEmailsFile");
  if (!adminEmailsFile) {
    return makeResult("admin-emails-parse", "warn", "adminEmailsFile not configured.");
  }

  try {
    // Parse with a dummy abbreviation list to validate file structure
    const rows = await readAdminEmailsFile(adminEmailsFile, []);
    // Even though we pass empty abbreviations (so rows will be 0),
    // the file structure validation happens before filtering.
    return makeResult("admin-emails-parse", "pass", "Admin emails file structure is valid.", {
      path: adminEmailsFile,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return makeResult("admin-emails-parse", "fail", `Failed to parse admin emails file: ${message}`, {
      path: adminEmailsFile,
      resolution: 'Verify the file has "Client", "Email", and "Password" columns.',
    });
  }
}

async function checkGraphConfigExists(): Promise<PrecheckResult> {
  try {
    const db = getDb();
    const rows = await db.select().from(credentials);
    const configured = rows.filter((r) => r.tenantId && r.clientAppId && r.clientSecret);

    if (configured.length === 0) {
      return makeResult("graph-config-exists", "warn", "No credentials have Graph API configuration set.", {
        totalCredentials: rows.length,
        resolution: "Use the Settings page to configure Azure AD app registration for at least one credential.",
      });
    }

    return makeResult("graph-config-exists", "pass", `${configured.length} credential(s) have Graph API configuration.`, {
      configuredCount: configured.length,
      totalCount: rows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return makeResult("graph-config-exists", "fail", `Failed to check Graph config: ${message}`);
  }
}

async function checkGraphApiConnection(): Promise<PrecheckResult> {
  try {
    const db = getDb();
    const rows = await db.select().from(credentials);
    const configured = rows.filter((r) => r.tenantId && r.clientAppId && r.clientSecret);

    if (configured.length === 0) {
      return makeResult("graph-api-connection", "warn", "No credentials with Graph config to test.");
    }

    // Test the first configured credential
    const cred = configured[0];
    const result = await testGraphConnection({
      tenantId: cred.tenantId!,
      clientAppId: cred.clientAppId!,
      clientSecret: cred.clientSecret!,
    });

    if (!result.success) {
      return makeResult("graph-api-connection", "fail", `Graph API connection failed: ${result.error}`, {
        tenantId: cred.tenantId,
        resolution: "Verify the Azure AD app registration credentials are correct and have the required permissions.",
      });
    }

    return makeResult("graph-api-connection", "pass", `Connected to Graph API (tenant: ${result.tenantName}).`, {
      tenantId: cred.tenantId,
      tenantName: result.tenantName,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return makeResult("graph-api-connection", "fail", `Graph API connection test error: ${message}`);
  }
}

async function checkDatabaseHealth(): Promise<PrecheckResult> {
  try {
    const pg = getPgClient();
    const result = await pg.query("SELECT 1 AS ok");
    if (result.rows.length > 0 && (result.rows[0] as Record<string, unknown>).ok === 1) {
      return makeResult("database-health", "pass", "Database is healthy.");
    }
    return makeResult("database-health", "fail", "Database query returned unexpected result.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return makeResult("database-health", "fail", `Database health check failed: ${message}`);
  }
}

// ─── Check Registry ──────────────────────────────────────────

const CHECK_FUNCTIONS: Record<string, CheckFn> = {
  "env-file": checkEnvFile,
  "base-folder-access": checkBaseFolderAccess,
  "companies-file": checkCompaniesFile,
  "companies-file-parse": checkCompaniesFileParse,
  "admin-emails-file": checkAdminEmailsFile,
  "admin-emails-parse": checkAdminEmailsParse,
  "graph-config-exists": checkGraphConfigExists,
  "graph-api-connection": checkGraphApiConnection,
  "database-health": checkDatabaseHealth,
};

// ─── Runner with Dependency Resolution ───────────────────────

/**
 * Run all prechecks in order, respecting dependency chains.
 * If a check's dependencies have failed, the check is skipped.
 * Results are persisted to the precheck_results table.
 */
export async function runAllPrechecks(): Promise<PrecheckResult[]> {
  logger.info("Running prechecks...");
  emitSSE("precheck:started", {});

  const results: PrecheckResult[] = [];
  const resultMap = new Map<string, PrecheckResult>();

  for (const def of PRECHECK_DEFINITIONS) {
    const checkFn = CHECK_FUNCTIONS[def.name];
    if (!checkFn) {
      const result = makeResult(def.name, "fail", `No implementation found for check "${def.name}".`);
      results.push(result);
      resultMap.set(def.name, result);
      continue;
    }

    // Check if any dependency failed
    const depFailed = def.dependsOn.some((dep) => {
      const depResult = resultMap.get(dep);
      return !depResult || depResult.status === "fail";
    });

    if (depFailed) {
      const failedDeps = def.dependsOn
        .filter((dep) => {
          const r = resultMap.get(dep);
          return !r || r.status === "fail";
        })
        .join(", ");
      const result = makeResult(
        def.name,
        "skipped",
        `Skipped because dependency check(s) failed: ${failedDeps}.`
      );
      results.push(result);
      resultMap.set(def.name, result);
      emitSSE("precheck:result", result);
      continue;
    }

    // Run the check
    try {
      const result = await checkFn();
      results.push(result);
      resultMap.set(def.name, result);
      emitSSE("precheck:result", result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const result = makeResult(def.name, "fail", `Unexpected error: ${message}`);
      results.push(result);
      resultMap.set(def.name, result);
      emitSSE("precheck:result", result);
    }
  }

  // Persist results to DB (replace all previous results)
  try {
    const db = getDb();
    await db.delete(precheckResults);
    for (const r of results) {
      await db.insert(precheckResults).values({
        checkName: r.checkName,
        status: r.status,
        message: r.message,
        details: r.details ?? null,
      });
    }
  } catch (err) {
    logger.error("Failed to persist precheck results:", err);
  }

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const skipCount = results.filter((r) => r.status === "skipped").length;

  logger.info(`Prechecks complete: ${passCount} pass, ${failCount} fail, ${warnCount} warn, ${skipCount} skipped.`);
  emitSSE("precheck:completed", { passCount, failCount, warnCount, skipCount });

  return results;
}
