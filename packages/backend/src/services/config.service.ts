import dotenv from "dotenv";
import path from "path";
import { eq } from "drizzle-orm";
import { config } from "../database/schema";
import { getDb } from "../database/connection";
import { decrypt, isEncryptionReady } from "./encryption.service";
import { logger } from "../utils/logger";
import type { ConfigKey, ConfigMap } from "@signin-sentinel/shared";
import { DEFAULT_CONFIG } from "@signin-sentinel/shared";

// Load .env from project root (two levels up from dist/)
let envLoaded = false;
let envValues: Record<string, string> = {};

function loadEnv(): void {
  if (envLoaded) return;
  const envPath = path.resolve(process.cwd(), ".env");
  const result = dotenv.config({ path: envPath });
  if (result.parsed) {
    envValues = result.parsed;
  }
  envLoaded = true;
}

/**
 * Get a single config value. Priority: DB → .env → defaults.
 */
export async function getConfig(key: ConfigKey): Promise<string | null> {
  // 1. Check DB
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(config)
      .where(eq(config.key, key))
      .limit(1);

    if (rows.length > 0 && rows[0].value !== null) {
      const row = rows[0];
      if (row.encrypted && isEncryptionReady()) {
        return decrypt(row.value!).trim();
      }
      return row.value!.trim();
    }
  } catch (err) {
    logger.warn(`Failed to read config key "${key}" from DB, falling back to .env`, err);
  }

  // 2. Check .env
  loadEnv();
  if (envValues[key]) {
    return envValues[key].trim();
  }

  // Also check process.env (covers system env vars)
  if (process.env[key]) {
    return process.env[key]!.trim();
  }

  // 3. Check defaults
  const defaults = DEFAULT_CONFIG as Record<string, string>;
  if (defaults[key]) {
    return defaults[key];
  }

  return null;
}

/**
 * Get all config values with .env and default fallbacks applied.
 */
export async function getAllConfig(): Promise<Partial<ConfigMap>> {
  const allKeys: ConfigKey[] = [
    "baseFolder",
    "companiesFilename",
    "adminEmailsFile",
    "defaultDateRangeDays",
    "exportOutputDir",
    "graphPageSize",
  ];

  const result: Partial<ConfigMap> = {};
  for (const key of allKeys) {
    const value = await getConfig(key);
    if (value !== null) {
      (result as Record<string, string>)[key] = value;
    }
  }
  return result;
}

/**
 * Set a config value in the DB (upsert).
 */
export async function setConfig(
  key: ConfigKey,
  value: string,
  encrypted = false
): Promise<void> {
  const db = getDb();
  await db
    .insert(config)
    .values({
      key,
      value,
      encrypted,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: config.key,
      set: { value, encrypted, updatedAt: new Date() },
    });
  logger.info(`Config "${key}" updated.`);
}

/**
 * Delete a config override from the DB (reverts to .env fallback).
 */
export async function deleteConfig(key: ConfigKey): Promise<void> {
  const db = getDb();
  await db.delete(config).where(eq(config.key, key));
  logger.info(`Config "${key}" deleted from DB.`);
}
