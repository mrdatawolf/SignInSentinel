import { acquireGraphToken } from "./graph-auth.service";
import { getDb } from "../database/connection";
import { signInLogs } from "../database/schema";
import { emitSSE } from "../utils/event-bus";
import { logger } from "../utils/logger";
import { GRAPH_SIGNIN_ENDPOINT } from "@signin-sentinel/shared";
import type { GraphSignIn, GraphSignInsResponse } from "@signin-sentinel/shared";

interface FetchSignInsParams {
  tenantId: string;
  clientAppId: string;
  clientSecret: string;
  clientId: number;       // DB client ID
  jobItemId: number;      // DB job item ID
  dateFrom: string;       // ISO date string
  dateTo: string;         // ISO date string
  pageSize?: number;
  signal?: AbortSignal;   // For cancellation
}

interface FetchSignInsResult {
  totalRecords: number;
  pagesProcessed: number;
}

const DEFAULT_PAGE_SIZE = 500;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Fetch sign-in logs from Microsoft Graph for a single tenant/credential,
 * handling pagination (@odata.nextLink) and HTTP 429 rate limiting.
 * Inserts records into the sign_in_logs table as they arrive.
 */
export async function fetchSignInLogs(params: FetchSignInsParams): Promise<FetchSignInsResult> {
  const {
    tenantId, clientAppId, clientSecret,
    clientId, jobItemId,
    dateFrom, dateTo,
    pageSize = DEFAULT_PAGE_SIZE,
    signal,
  } = params;

  const token = await acquireGraphToken({ tenantId, clientAppId, clientSecret });

  // Build initial URL with $filter for date range
  const filter = `createdDateTime ge ${dateFrom} and createdDateTime le ${dateTo}`;
  const url = new URL(GRAPH_SIGNIN_ENDPOINT);
  url.searchParams.set("$filter", filter);
  url.searchParams.set("$top", String(pageSize));
  url.searchParams.set("$orderby", "createdDateTime desc");

  let nextLink: string | undefined = url.toString();
  let totalRecords = 0;
  let pagesProcessed = 0;

  while (nextLink) {
    if (signal?.aborted) {
      logger.info(`Fetch cancelled for client ${clientId}, job item ${jobItemId}`);
      break;
    }

    const data = await fetchPageWithRetry(nextLink, token, signal);

    if (data.value.length > 0) {
      await insertSignInBatch(data.value, clientId, jobItemId);
      totalRecords += data.value.length;
    }

    pagesProcessed++;
    nextLink = data["@odata.nextLink"];

    emitSSE("job:item:progress", {
      jobItemId,
      clientId,
      recordsFetched: totalRecords,
      pagesProcessed,
    });
  }

  logger.info(`Fetched ${totalRecords} sign-in records (${pagesProcessed} pages) for client ${clientId}`);
  return { totalRecords, pagesProcessed };
}

/**
 * Fetch a single page from Graph API with exponential backoff on 429/5xx.
 */
async function fetchPageWithRetry(
  url: string,
  token: string,
  signal?: AbortSignal
): Promise<GraphSignInsResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("Aborted");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });

    if (res.ok) {
      return (await res.json()) as GraphSignInsResponse;
    }

    // Rate limited — use Retry-After header if present
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "", 10);
      const waitMs = (retryAfter > 0 ? retryAfter * 1000 : INITIAL_BACKOFF_MS * Math.pow(2, attempt));
      logger.warn(`Graph API 429 rate limited. Waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(waitMs, signal);
      continue;
    }

    // Server errors — retry with backoff
    if (res.status >= 500) {
      const waitMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      logger.warn(`Graph API ${res.status}. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(waitMs, signal);
      continue;
    }

    // Client errors (4xx other than 429) — don't retry
    const body = await res.text();
    throw new Error(`Graph API error ${res.status}: ${body}`);
  }

  throw lastError ?? new Error(`Failed after ${MAX_RETRIES} retries`);
}

/**
 * Batch insert sign-in records into the database.
 */
async function insertSignInBatch(records: GraphSignIn[], clientId: number, jobItemId: number): Promise<void> {
  const db = getDb();

  const rows = records.map((r) => ({
    jobItemId,
    clientId,
    graphSignInId: r.id,
    createdDateTime: new Date(r.createdDateTime),
    userDisplayName: r.userDisplayName,
    userPrincipalName: r.userPrincipalName,
    appDisplayName: r.appDisplayName,
    ipAddress: r.ipAddress,
    clientAppUsed: r.clientAppUsed,
    isInteractive: r.isInteractive,
    conditionalAccessStatus: r.conditionalAccessStatus,
    riskState: r.riskState,
    statusErrorCode: r.status?.errorCode ?? null,
    statusFailureReason: r.status?.failureReason ?? null,
    location: r.location ?? null,
    deviceDetail: r.deviceDetail ?? null,
    rawJson: r as unknown,
  }));

  // Insert in chunks to avoid overly large queries
  const CHUNK_SIZE = 100;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await db.insert(signInLogs).values(chunk);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    }, { once: true });
  });
}
