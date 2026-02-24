import { Router } from "express";
import { eq } from "drizzle-orm";
import { credentials } from "../database/schema";
import { getDb } from "../database/connection";

const router = Router();

// GET /api/credentials - List credentials (passwords redacted)
router.get("/credentials", async (_req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.select().from(credentials);
    const safe = rows.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      email: row.email,
      tenantId: row.tenantId,
      clientAppId: row.clientAppId,
      hasPassword: !!row.encryptedPassword,
      hasClientSecret: !!row.clientSecret,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
    res.json({ credentials: safe });
  } catch (err) {
    next(err);
  }
});

// GET /api/credentials/:clientId - Get credentials for a specific client
router.get("/credentials/:clientId", async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(credentials)
      .where(eq(credentials.clientId, parseInt(req.params.clientId)));
    const safe = rows.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      email: row.email,
      tenantId: row.tenantId,
      clientAppId: row.clientAppId,
      hasPassword: !!row.encryptedPassword,
      hasClientSecret: !!row.clientSecret,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
    res.json({ credentials: safe });
  } catch (err) {
    next(err);
  }
});

// PUT /api/credentials/:id/graph-config - Set Azure AD app config
router.put("/credentials/:id/graph-config", async (req, res, next) => {
  try {
    const db = getDb();
    const { tenantId, clientAppId, clientSecret } = req.body;
    const updated = await db
      .update(credentials)
      .set({
        tenantId,
        clientAppId,
        clientSecret,
        updatedAt: new Date(),
      })
      .where(eq(credentials.id, parseInt(req.params.id)))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "Credential not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
