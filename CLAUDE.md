# SignInSentinel

Electron desktop app. Reads client lists from Excel (UNC shares), authenticates via MSAL client credentials per tenant, fetches `/auditLogs/signIns` from Microsoft Graph API, stores in PGLite, exports JSON. Replaces legacy `PSRunThruO365LoginData.ps1`.

## Monorepo (npm workspaces)

```
packages/shared   (@signin-sentinel/shared)   — Types + constants. CJS output. Build first.
packages/backend  (@signin-sentinel/backend)  — Electron main + Express + PGLite. CJS.
packages/frontend (@signin-sentinel/frontend) — React SPA via Vite. Builds → backend/dist/renderer/.
```

## Commands

`npm run build:all` — build everything (shared→backend→frontend)
`npm run build:shared` / `build:backend` / `build:frontend` — individual
`npm run dev` — backend dev (tsc --watch + electron)
`npm run dev:frontend` — Vite dev server :5173
`npm run dist` — electron-builder (run from root or packages/backend)

## Key Files

- `backend/src/main.ts` — Electron bootstrap (safeStorage, DB init, Express, prechecks, window)
- `backend/src/server.ts` — Express setup (CORS, CSP, routes)
- `backend/src/database/schema.ts` — Drizzle schema (7 tables: config, clients, credentials, job_runs, job_items, sign_in_logs, precheck_results)
- `backend/src/database/connection.ts` — PGLite init + migration
- `backend/src/services/` — config, encryption, excel, file-access, graph-auth, graph-signin, job-queue, export, precheck
- `backend/src/routes/` — config, clients, credentials, prechecks, jobs, graph, events (SSE)
- `shared/src/constants/` — defaults, graph endpoints, precheck definitions
- `shared/src/types/` — all shared TypeScript interfaces
- `frontend/src/pages/` — Dashboard, ClientList, JobRunner, JobDetail, JobHistory, Settings, SetupWizard
- `frontend/src/hooks/` — useConfig, useJobs, usePrechecks, useSSE
- `frontend/src/services/api.ts` — API client (base URL from Electron IPC or fallback :3001)

## API Endpoints (`/api/*`)

`GET /health` · `GET|PUT|DELETE /config/:key` · `GET /clients` · `PATCH /clients/:id` · `POST /clients/sync` · `GET /credentials` · `PUT /credentials/:id/graph-config` · `GET|POST /prechecks` · `GET|POST /jobs` · `POST /jobs/:id/cancel` · `POST /jobs/:id/export` · `GET /jobs/status` · `POST /graph/test-connection` · `GET /events` (SSE)

## Prechecks (dependency chain)

`env-file` → `base-folder-access` → `companies-file` → `companies-file-parse`
`env-file` → `admin-emails-file` → `admin-emails-parse`
`graph-config-exists` → `graph-api-connection`
`database-health` (independent)
Failed deps skip dependents. First-run failures redirect to `/setup`.

## Conventions

- Backend + Shared = CommonJS, Frontend = ESM (Vite bundles)
- Express on ephemeral port, exposed via IPC `get-server-port`
- Vite dev proxies `/api` → `http://127.0.0.1:3001`; production uses `base: "./"` for Electron file://
- HashRouter required (Electron file:// protocol)
- Passwords always redacted in API responses (`hasPassword: boolean`)
- SSE via `eventBus` EventEmitter in `backend/src/utils/event-bus.ts`
- Route pattern: `async (req, res, next) => { try { ... } catch (err) { next(err); } }`
- Config: `.env` provides fallbacks, DB `config` table overrides. Keys: `baseFolder`, `companiesFilename`, `adminEmailsFile`
- Excel: companies.xlsx worksheet "Companies", cols Abbrv/Group (filter Group="SLG", always include "BT"); Admin Emails.xlsx cols Client/Email/Password
- Job queue: sequential (one client at a time), AbortController for cancellation
- Encryption: AES-256-GCM via Electron safeStorage

## Packaging

`npm run dist` — output in `release/`. electron-builder v26+ required (v25 ENOENT on Git Bash). Use `cmd.exe` on Windows if Git Bash fails. Electron pinned at 33.4.11. Icon must be 256x256+ for Windows NSIS.
