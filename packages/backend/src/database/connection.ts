import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import path from "path";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>>;
let client: PGlite;

export async function initDatabase(dataDir: string): Promise<typeof db> {
  const pgDataPath = path.join(dataDir, "pgdata");
  client = new PGlite(pgDataPath);
  db = drizzle(client, { schema });

  // Run inline migrations (create tables if they don't exist)
  await runMigrations(client);

  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

export function getPgClient() {
  if (!client) throw new Error("PGlite client not initialized.");
  return client;
}

async function runMigrations(pg: PGlite): Promise<void> {
  await pg.exec(`
    -- Enums
    DO $$ BEGIN
      CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE precheck_status AS ENUM ('pass', 'fail', 'warn', 'skipped');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    -- Config table
    CREATE TABLE IF NOT EXISTS config (
      id SERIAL PRIMARY KEY,
      key VARCHAR(255) NOT NULL UNIQUE,
      value TEXT,
      encrypted BOOLEAN DEFAULT false,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Clients table
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      abbreviation VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255),
      "group" VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      last_synced_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Credentials table
    CREATE TABLE IF NOT EXISTS credentials (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      email VARCHAR(320) NOT NULL,
      encrypted_password TEXT,
      tenant_id VARCHAR(100),
      client_app_id VARCHAR(100),
      client_secret TEXT,
      last_used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Job Runs table
    CREATE TABLE IF NOT EXISTS job_runs (
      id SERIAL PRIMARY KEY,
      status job_status DEFAULT 'pending' NOT NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      total_clients INTEGER DEFAULT 0,
      completed_clients INTEGER DEFAULT 0,
      failed_clients INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Job Items table
    CREATE TABLE IF NOT EXISTS job_items (
      id SERIAL PRIMARY KEY,
      job_run_id INTEGER REFERENCES job_runs(id) NOT NULL,
      client_id INTEGER REFERENCES clients(id) NOT NULL,
      credential_id INTEGER REFERENCES credentials(id),
      status job_status DEFAULT 'pending' NOT NULL,
      sign_in_count INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP
    );

    -- Sign-In Logs table
    CREATE TABLE IF NOT EXISTS sign_in_logs (
      id SERIAL PRIMARY KEY,
      job_item_id INTEGER REFERENCES job_items(id),
      client_id INTEGER REFERENCES clients(id) NOT NULL,
      graph_sign_in_id VARCHAR(255),
      created_date_time TIMESTAMP,
      user_display_name VARCHAR(255),
      user_principal_name VARCHAR(320),
      app_display_name VARCHAR(255),
      ip_address VARCHAR(50),
      client_app_used VARCHAR(100),
      is_interactive BOOLEAN,
      conditional_access_status VARCHAR(50),
      risk_state VARCHAR(50),
      status_error_code INTEGER,
      status_failure_reason TEXT,
      location JSONB,
      device_detail JSONB,
      raw_json JSONB,
      fetched_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Precheck Results table
    CREATE TABLE IF NOT EXISTS precheck_results (
      id SERIAL PRIMARY KEY,
      check_name VARCHAR(100) NOT NULL,
      status precheck_status NOT NULL,
      message TEXT,
      details JSONB,
      checked_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
}
