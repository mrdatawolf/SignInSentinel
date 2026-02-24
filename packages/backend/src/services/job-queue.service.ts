import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../database/connection";
import { jobRuns, jobItems, clients, credentials } from "../database/schema";
import { fetchSignInLogs } from "./graph-signin.service";
import { getConfig } from "./config.service";
import { emitSSE } from "../utils/event-bus";
import { logger } from "../utils/logger";
import type { CreateJobRequest } from "@signin-sentinel/shared";

// Only one job runs at a time
let activeAbortController: AbortController | null = null;
let activeJobRunId: number | null = null;

/**
 * Create a new job run, build job items for each active client with
 * Graph credentials, then process them sequentially.
 */
export async function startJobRun(request: CreateJobRequest): Promise<{ jobRunId: number }> {
  if (activeJobRunId !== null) {
    throw new Error(`A job is already running (ID: ${activeJobRunId}). Cancel it first or wait for completion.`);
  }

  const db = getDb();

  // Resolve date range
  const dateTo = request.dateTo || new Date().toISOString();
  let dateFrom = request.dateFrom;
  if (!dateFrom) {
    const daysStr = await getConfig("defaultDateRangeDays");
    const days = parseInt(daysStr ?? "7", 10);
    const from = new Date();
    from.setDate(from.getDate() - days);
    dateFrom = from.toISOString();
  }

  // Get eligible clients (active, with Graph credentials)
  let clientFilter = eq(clients.isActive, true);
  const activeClients = await db.select().from(clients).where(clientFilter);

  // If specific clientIds were requested, filter to those
  const targetClients = request.clientIds
    ? activeClients.filter((c) => request.clientIds!.includes(c.id))
    : activeClients;

  if (targetClients.length === 0) {
    throw new Error("No active clients found to process.");
  }

  // Find credentials with Graph config for these clients
  const clientIds = targetClients.map((c) => c.id);
  const allCredentials = await db.select().from(credentials);
  const credentialMap = new Map<number, typeof allCredentials[0]>();
  for (const cred of allCredentials) {
    if (cred.clientId && clientIds.includes(cred.clientId) && cred.tenantId && cred.clientAppId && cred.clientSecret) {
      credentialMap.set(cred.clientId, cred);
    }
  }

  const eligibleClients = targetClients.filter((c) => credentialMap.has(c.id));
  if (eligibleClients.length === 0) {
    throw new Error("No clients have Graph API credentials configured. Set up credentials first.");
  }

  // Create the job run
  const [run] = await db.insert(jobRuns).values({
    status: "pending",
    totalClients: eligibleClients.length,
    completedClients: 0,
    failedClients: 0,
  }).returning();

  // Create job items
  for (const client of eligibleClients) {
    const cred = credentialMap.get(client.id)!;
    await db.insert(jobItems).values({
      jobRunId: run.id,
      clientId: client.id,
      credentialId: cred.id,
      status: "pending",
    });
  }

  // Start processing in background (don't await)
  processJobRun(run.id, dateFrom, dateTo).catch((err) => {
    logger.error(`Job run ${run.id} failed unexpectedly:`, err);
  });

  return { jobRunId: run.id };
}

/**
 * Cancel a running job. The current in-flight fetch will be aborted.
 */
export async function cancelJobRun(jobRunId: number): Promise<void> {
  if (activeJobRunId !== jobRunId) {
    // Maybe it's already finished — just mark it cancelled if still pending/running
    const db = getDb();
    const [run] = await db.select().from(jobRuns).where(eq(jobRuns.id, jobRunId)).limit(1);
    if (!run) throw new Error("Job run not found.");
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      throw new Error(`Job run is already ${run.status}.`);
    }
    // Mark as cancelled
    await db.update(jobRuns).set({ status: "cancelled", completedAt: new Date() }).where(eq(jobRuns.id, jobRunId));
    await db.update(jobItems).set({ status: "cancelled" }).where(
      and(eq(jobItems.jobRunId, jobRunId), eq(jobItems.status, "pending"))
    );
    emitSSE("job:cancelled", { jobRunId });
    return;
  }

  // Active job — signal abort
  activeAbortController?.abort();
  logger.info(`Cancel requested for job run ${jobRunId}`);
}

/**
 * Process all items in a job run sequentially.
 */
async function processJobRun(jobRunId: number, dateFrom: string, dateTo: string): Promise<void> {
  const db = getDb();
  const startTime = Date.now();

  activeAbortController = new AbortController();
  activeJobRunId = jobRunId;

  try {
    // Mark run as running
    await db.update(jobRuns).set({ status: "running", startedAt: new Date() }).where(eq(jobRuns.id, jobRunId));

    // Load items with client + credential info
    const items = await db.select().from(jobItems).where(eq(jobItems.jobRunId, jobRunId));

    emitSSE("job:started", { jobRunId, totalItems: items.length });

    let completedCount = 0;
    let failedCount = 0;
    let totalRecords = 0;

    for (const item of items) {
      if (activeAbortController.signal.aborted) {
        // Mark remaining items as cancelled
        await db.update(jobItems).set({ status: "cancelled" }).where(
          and(eq(jobItems.jobRunId, jobRunId), eq(jobItems.status, "pending"))
        );
        break;
      }

      // Load client and credential for this item
      const [client] = await db.select().from(clients).where(eq(clients.id, item.clientId)).limit(1);
      if (!client) {
        await markItemFailed(item.id, "Client not found");
        failedCount++;
        continue;
      }

      if (!item.credentialId) {
        await markItemFailed(item.id, "No credential assigned");
        failedCount++;
        emitSSE("job:item:failed", {
          jobRunId, jobItemId: item.id,
          clientAbbreviation: client.abbreviation,
          error: "No credential assigned",
        });
        continue;
      }

      const [cred] = await db.select().from(credentials).where(eq(credentials.id, item.credentialId)).limit(1);
      if (!cred || !cred.tenantId || !cred.clientAppId || !cred.clientSecret) {
        await markItemFailed(item.id, "Credential missing Graph API configuration");
        failedCount++;
        emitSSE("job:item:failed", {
          jobRunId, jobItemId: item.id,
          clientAbbreviation: client.abbreviation,
          error: "Credential missing Graph API configuration",
        });
        continue;
      }

      // Mark item as running
      await db.update(jobItems).set({ status: "running", startedAt: new Date() }).where(eq(jobItems.id, item.id));
      emitSSE("job:item:started", {
        jobRunId, jobItemId: item.id,
        clientAbbreviation: client.abbreviation,
      });

      try {
        const result = await fetchSignInLogs({
          tenantId: cred.tenantId,
          clientAppId: cred.clientAppId,
          clientSecret: cred.clientSecret,
          clientId: client.id,
          jobItemId: item.id,
          dateFrom,
          dateTo,
          signal: activeAbortController.signal,
        });

        // Mark item completed
        await db.update(jobItems).set({
          status: "completed",
          signInCount: result.totalRecords,
          completedAt: new Date(),
        }).where(eq(jobItems.id, item.id));

        completedCount++;
        totalRecords += result.totalRecords;

        emitSSE("job:item:completed", {
          jobRunId, jobItemId: item.id,
          clientAbbreviation: client.abbreviation,
          signInCount: result.totalRecords,
        });

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);

        if (message === "Aborted") {
          // Job was cancelled mid-flight
          await db.update(jobItems).set({ status: "cancelled", completedAt: new Date() }).where(eq(jobItems.id, item.id));
          break;
        }

        await markItemFailed(item.id, message);
        failedCount++;

        emitSSE("job:item:failed", {
          jobRunId, jobItemId: item.id,
          clientAbbreviation: client.abbreviation,
          error: message,
        });
      }

      // Update run counts after each item
      await db.update(jobRuns).set({
        completedClients: completedCount,
        failedClients: failedCount,
      }).where(eq(jobRuns.id, jobRunId));
    }

    // Finalize job run
    const finalStatus = activeAbortController.signal.aborted ? "cancelled" : (failedCount === items.length ? "failed" : "completed");
    await db.update(jobRuns).set({
      status: finalStatus,
      completedClients: completedCount,
      failedClients: failedCount,
      completedAt: new Date(),
    }).where(eq(jobRuns.id, jobRunId));

    const eventType = finalStatus === "cancelled" ? "job:cancelled" : "job:completed";
    emitSSE(eventType, {
      jobRunId,
      totalClients: items.length,
      completedClients: completedCount,
      failedClients: failedCount,
      totalRecords,
      durationMs: Date.now() - startTime,
    } as Record<string, unknown>);

    logger.info(`Job run ${jobRunId} ${finalStatus}: ${completedCount} completed, ${failedCount} failed, ${totalRecords} records`);

  } finally {
    activeAbortController = null;
    activeJobRunId = null;
  }
}

async function markItemFailed(itemId: number, errorMessage: string): Promise<void> {
  const db = getDb();
  await db.update(jobItems).set({
    status: "failed",
    errorMessage,
    completedAt: new Date(),
  }).where(eq(jobItems.id, itemId));
}

/** Check if a job is currently running. */
export function isJobRunning(): boolean {
  return activeJobRunId !== null;
}

/** Get the currently active job run ID, if any. */
export function getActiveJobRunId(): number | null {
  return activeJobRunId;
}
