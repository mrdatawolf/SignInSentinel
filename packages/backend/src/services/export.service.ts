import fs from "fs/promises";
import path from "path";
import { eq, and } from "drizzle-orm";
import { getDb } from "../database/connection";
import { signInLogs, jobRuns, jobItems, clients } from "../database/schema";
import { getConfig } from "./config.service";
import { logger } from "../utils/logger";
import { app } from "electron";

interface ExportResult {
  filePath: string;
  recordCount: number;
}

/**
 * Export sign-in logs for a job run as JSON files, one per client.
 * Returns the list of files written.
 */
export async function exportJobRun(jobRunId: number): Promise<ExportResult[]> {
  const db = getDb();

  // Verify job exists and is completed
  const [run] = await db.select().from(jobRuns).where(eq(jobRuns.id, jobRunId)).limit(1);
  if (!run) throw new Error("Job run not found.");
  if (run.status !== "completed" && run.status !== "failed") {
    throw new Error(`Cannot export job run with status "${run.status}". Only completed or failed runs can be exported.`);
  }

  // Determine output directory
  const configDir = await getConfig("exportOutputDir");
  const outputBase = configDir || path.join(app.getPath("documents"), "SignInSentinelExports");
  const runDir = path.join(outputBase, `job-run-${jobRunId}`);

  await fs.mkdir(runDir, { recursive: true });

  // Get completed items for this run
  const items = await db.select().from(jobItems).where(
    and(eq(jobItems.jobRunId, jobRunId), eq(jobItems.status, "completed"))
  );

  const results: ExportResult[] = [];

  for (const item of items) {
    // Get client abbreviation for filename
    const [client] = await db.select().from(clients).where(eq(clients.id, item.clientId)).limit(1);
    const abbrev = client?.abbreviation ?? `client-${item.clientId}`;

    // Fetch all sign-in logs for this job item
    const logs = await db.select().from(signInLogs).where(eq(signInLogs.jobItemId, item.id));

    if (logs.length === 0) continue;

    // Write as JSON array of the raw Graph API responses
    const exportData = logs.map((log) => log.rawJson ?? {
      id: log.graphSignInId,
      createdDateTime: log.createdDateTime,
      userDisplayName: log.userDisplayName,
      userPrincipalName: log.userPrincipalName,
      appDisplayName: log.appDisplayName,
      ipAddress: log.ipAddress,
      clientAppUsed: log.clientAppUsed,
      isInteractive: log.isInteractive,
      conditionalAccessStatus: log.conditionalAccessStatus,
      riskState: log.riskState,
      status: {
        errorCode: log.statusErrorCode,
        failureReason: log.statusFailureReason,
      },
      location: log.location,
      deviceDetail: log.deviceDetail,
    });

    const filePath = path.join(runDir, `${abbrev}-signins.json`);
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), "utf-8");

    results.push({ filePath, recordCount: logs.length });
    logger.info(`Exported ${logs.length} records for ${abbrev} → ${filePath}`);
  }

  logger.info(`Export complete for job run ${jobRunId}: ${results.length} files, ${results.reduce((s, r) => s + r.recordCount, 0)} total records`);
  return results;
}
