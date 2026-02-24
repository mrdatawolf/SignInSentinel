import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const precheckStatusEnum = pgEnum("precheck_status", [
  "pass",
  "fail",
  "warn",
  "skipped",
]);

// ─── Config ──────────────────────────────────────────────

export const config = pgTable("config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value"),
  encrypted: boolean("encrypted").default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Clients ─────────────────────────────────────────────

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  abbreviation: varchar("abbreviation", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  group: varchar("group", { length: 50 }),
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Credentials ─────────────────────────────────────────

export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  email: varchar("email", { length: 320 }).notNull(),
  encryptedPassword: text("encrypted_password"),
  tenantId: varchar("tenant_id", { length: 100 }),
  clientAppId: varchar("client_app_id", { length: 100 }),
  clientSecret: text("client_secret"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Job Runs ────────────────────────────────────────────

export const jobRuns = pgTable("job_runs", {
  id: serial("id").primaryKey(),
  status: jobStatusEnum("status").default("pending").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalClients: integer("total_clients").default(0),
  completedClients: integer("completed_clients").default(0),
  failedClients: integer("failed_clients").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Job Items ───────────────────────────────────────────

export const jobItems = pgTable("job_items", {
  id: serial("id").primaryKey(),
  jobRunId: integer("job_run_id")
    .references(() => jobRuns.id)
    .notNull(),
  clientId: integer("client_id")
    .references(() => clients.id)
    .notNull(),
  credentialId: integer("credential_id").references(() => credentials.id),
  status: jobStatusEnum("status").default("pending").notNull(),
  signInCount: integer("sign_in_count").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// ─── Sign-In Logs ────────────────────────────────────────

export const signInLogs = pgTable("sign_in_logs", {
  id: serial("id").primaryKey(),
  jobItemId: integer("job_item_id").references(() => jobItems.id),
  clientId: integer("client_id")
    .references(() => clients.id)
    .notNull(),
  graphSignInId: varchar("graph_sign_in_id", { length: 255 }),
  createdDateTime: timestamp("created_date_time"),
  userDisplayName: varchar("user_display_name", { length: 255 }),
  userPrincipalName: varchar("user_principal_name", { length: 320 }),
  appDisplayName: varchar("app_display_name", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  clientAppUsed: varchar("client_app_used", { length: 100 }),
  isInteractive: boolean("is_interactive"),
  conditionalAccessStatus: varchar("conditional_access_status", { length: 50 }),
  riskState: varchar("risk_state", { length: 50 }),
  statusErrorCode: integer("status_error_code"),
  statusFailureReason: text("status_failure_reason"),
  location: jsonb("location"),
  deviceDetail: jsonb("device_detail"),
  rawJson: jsonb("raw_json"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

// ─── Precheck Results ────────────────────────────────────

export const precheckResults = pgTable("precheck_results", {
  id: serial("id").primaryKey(),
  checkName: varchar("check_name", { length: 100 }).notNull(),
  status: precheckStatusEnum("status").notNull(),
  message: text("message"),
  details: jsonb("details"),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});
