import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";
import { logger } from "../utils/logger";
import { GRAPH_SCOPES, GRAPH_AUTHORITY_BASE } from "@signin-sentinel/shared";

// Cache MSAL app instances by tenantId to reuse token caches
const msalCache = new Map<string, ConfidentialClientApplication>();

interface GraphCredentials {
  tenantId: string;
  clientAppId: string;
  clientSecret: string;
}

/**
 * Get or create a ConfidentialClientApplication for a given tenant.
 * Instances are cached so token caches persist across calls.
 */
function getMsalApp(creds: GraphCredentials): ConfidentialClientApplication {
  const existing = msalCache.get(creds.tenantId);
  if (existing) return existing;

  const config: Configuration = {
    auth: {
      clientId: creds.clientAppId,
      authority: `${GRAPH_AUTHORITY_BASE}/${creds.tenantId}`,
      clientSecret: creds.clientSecret,
    },
  };

  const app = new ConfidentialClientApplication(config);
  msalCache.set(creds.tenantId, app);
  return app;
}

/**
 * Acquire an access token for Microsoft Graph using client credentials flow.
 */
export async function acquireGraphToken(creds: GraphCredentials): Promise<string> {
  const app = getMsalApp(creds);
  const result = await app.acquireTokenByClientCredential({
    scopes: GRAPH_SCOPES,
  });

  if (!result || !result.accessToken) {
    throw new Error("MSAL returned no access token.");
  }

  logger.info(`Acquired Graph token for tenant ${creds.tenantId} (expires: ${result.expiresOn})`);
  return result.accessToken;
}

/**
 * Test Graph API connectivity by acquiring a token and making a lightweight
 * request to the /organization endpoint.
 */
export async function testGraphConnection(creds: GraphCredentials): Promise<{
  success: boolean;
  tenantName?: string;
  error?: string;
}> {
  try {
    const token = await acquireGraphToken(creds);

    // Lightweight check: fetch org info
    const res = await fetch("https://graph.microsoft.com/v1.0/organization", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `Graph API returned ${res.status}: ${body}` };
    }

    const data = (await res.json()) as { value: Array<{ displayName: string }> };
    const tenantName = data.value?.[0]?.displayName ?? "Unknown";

    return { success: true, tenantName };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Graph connection test failed for tenant ${creds.tenantId}: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Clear the cached MSAL app for a tenant (e.g. when credentials change).
 */
export function clearMsalCache(tenantId?: string): void {
  if (tenantId) {
    msalCache.delete(tenantId);
  } else {
    msalCache.clear();
  }
}
