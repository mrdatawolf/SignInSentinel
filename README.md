# SignInSentinel

A desktop application for automatically fetching Microsoft Entra (Azure AD) sign-in logs across multiple client tenants. Built with Electron.

SignInSentinel replaces the manual PowerShell-based workflow (`PSRunThruO365LoginData.ps1`) with a guided UI that handles authentication, data retrieval, and export automatically.

## What It Does

1. **Reads client lists** from a shared Excel file (`companies.xlsx`) on your network
2. **Authenticates** to each client's Microsoft Entra tenant using Azure AD app registrations (client credentials flow)
3. **Fetches sign-in logs** from the Microsoft Graph API (`/auditLogs/signIns`)
4. **Stores results** locally in an embedded database
5. **Exports data** as JSON files, one per client

## Prerequisites

- **Node.js** 18 or later
- **Network access** to the UNC share containing `companies.xlsx` and `Admin Emails.xlsx`
- **Azure AD app registrations** configured with `AuditLog.Read.All` permission for each client tenant

## Quick Start

### Install dependencies

```bash
npm install
```

### Configure environment

Copy the example config and fill in your paths:

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable             | Description                                          |
|----------------------|------------------------------------------------------|
| `baseFolder`         | UNC path to the shared folder (e.g. `\\server\share`) |
| `companiesFilename`  | Name of the companies Excel file (default: `companies.xlsx`) |
| `adminEmailsFile`    | Full UNC path to the Admin Emails Excel file         |

### Run in development

```bash
npm run build:all    # Build all packages
npm run dev          # Start the Electron app with hot reload
```

In a separate terminal (optional, for frontend hot reload):

```bash
npm run dev:frontend
```

### Build the installer

```bash
npm run dist
```

The Windows installer will be output to the `release/` folder.

## First Run

When you launch SignInSentinel for the first time, it will run a series of **prechecks** and guide you through the **Setup Wizard** if anything needs attention:

1. **Environment** — Verifies your `.env` file and network paths are accessible
2. **Client data** — Parses the companies Excel file to load your client list
3. **Credentials** — Checks that Graph API credentials (tenant ID, client ID, client secret) are configured
4. **Connectivity** — Tests the Microsoft Graph API connection for each tenant

Once all checks pass, you'll land on the **Dashboard** and can start fetching sign-in logs.

## Usage

1. Go to **New Job** from the sidebar
2. Select a date range for the sign-in logs you want to fetch
3. Click **Start** — the app will process each client sequentially, showing real-time progress
4. When complete, go to the **Job Detail** page to review results and **Export** as JSON files

## Project Structure

```
packages/
  shared/     - Shared TypeScript types and constants
  backend/    - Electron main process, Express API, database, services
  frontend/   - React UI (Dashboard, Clients, Jobs, Settings)
```

## Tech Stack

- **Electron 33** — Desktop shell
- **Express 4** — Local API server
- **PGLite** + **Drizzle ORM** — Embedded PostgreSQL database
- **React 19** + **Vite 6** + **Tailwind CSS 3** — Frontend UI
- **MSAL Node** — Microsoft authentication (client credentials)
- **ExcelJS** — Reading client data from Excel files
