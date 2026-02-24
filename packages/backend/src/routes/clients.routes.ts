import { Router } from "express";
import { eq } from "drizzle-orm";
import { clients, credentials } from "../database/schema";
import { getDb } from "../database/connection";
import { getConfig } from "../services/config.service";
import { readCompaniesFile, readAdminEmailsFile } from "../services/excel.service";
import { resolveCompaniesPath } from "../services/file-access.service";
import { encrypt, isEncryptionReady } from "../services/encryption.service";
import { emitSSE } from "../utils/event-bus";
import { logger } from "../utils/logger";

const router = Router();

// GET /api/clients - List all clients
router.get("/clients", async (_req, res, next) => {
  try {
    const db = getDb();
    const allClients = await db.select().from(clients);
    res.json({ clients: allClients });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clients/:id - Toggle active/inactive
router.patch("/clients/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const { isActive } = req.body;
    const updated = await db
      .update(clients)
      .set({ isActive })
      .where(eq(clients.id, parseInt(req.params.id)))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.json({ client: updated[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/clients/sync - Sync clients & credentials from Excel files
router.post("/clients/sync", async (_req, res, next) => {
  try {
    const db = getDb();
    emitSSE("sync:started", {});

    // 1. Resolve file paths from config
    const baseFolder = await getConfig("baseFolder");
    const companiesFilename = await getConfig("companiesFilename");
    const adminEmailsFile = await getConfig("adminEmailsFile");

    if (!baseFolder || !companiesFilename) {
      res.status(400).json({ error: "baseFolder and companiesFilename must be configured." });
      return;
    }

    const companiesPath = resolveCompaniesPath(baseFolder, companiesFilename);

    // 2. Read companies file
    const abbreviations = await readCompaniesFile(companiesPath);
    logger.info(`Sync: found ${abbreviations.length} client abbreviations.`);

    // 3. Upsert clients into DB
    const now = new Date();
    let syncedCount = 0;
    for (const abbr of abbreviations) {
      await db
        .insert(clients)
        .values({
          abbreviation: abbr.abbreviation,
          name: abbr.name ?? null,
          group: abbr.group,
          isActive: true,
          lastSyncedAt: now,
        })
        .onConflictDoUpdate({
          target: clients.abbreviation,
          set: {
            name: abbr.name ?? null,
            group: abbr.group,
            lastSyncedAt: now,
          },
        });
      syncedCount++;
    }
    logger.info(`Sync: upserted ${syncedCount} clients.`);

    // 4. Read admin emails and upsert credentials (if file is configured)
    let credentialCount = 0;
    if (adminEmailsFile) {
      const abbrvList = abbreviations.map((a) => a.abbreviation);
      const adminRows = await readAdminEmailsFile(adminEmailsFile, abbrvList);

      for (const row of adminRows) {
        // Find the client ID by abbreviation
        const clientRows = await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.abbreviation, row.client))
          .limit(1);

        if (clientRows.length === 0) continue;
        const clientId = clientRows[0].id;

        // Encrypt password if encryption is ready and password exists
        const encryptedPassword =
          row.password && isEncryptionReady()
            ? encrypt(row.password)
            : row.password || null;

        // Upsert: match on clientId + email
        const existing = await db
          .select({ id: credentials.id })
          .from(credentials)
          .where(eq(credentials.clientId, clientId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(credentials)
            .set({
              email: row.email,
              encryptedPassword: encryptedPassword,
              updatedAt: now,
            })
            .where(eq(credentials.id, existing[0].id));
        } else {
          await db.insert(credentials).values({
            clientId,
            email: row.email,
            encryptedPassword: encryptedPassword,
            createdAt: now,
            updatedAt: now,
          });
        }
        credentialCount++;
      }
      logger.info(`Sync: upserted ${credentialCount} credentials.`);
    }

    // 5. Return synced clients
    const allClients = await db.select().from(clients);
    emitSSE("sync:completed", {
      clientCount: syncedCount,
      credentialCount,
    });

    res.json({
      clients: allClients,
      syncedClients: syncedCount,
      syncedCredentials: credentialCount,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
