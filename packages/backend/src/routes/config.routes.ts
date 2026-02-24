import { Router } from "express";
import { eq } from "drizzle-orm";
import { config } from "../database/schema";
import { getDb } from "../database/connection";
import { getAllConfig } from "../services/config.service";

const router = Router();

// GET /api/config - Get all config entries
router.get("/config", async (_req, res, next) => {
  try {
    const db = getDb();
    const configs = await db.select().from(config);
    res.json({ configs });
  } catch (err) {
    next(err);
  }
});

// GET /api/config/resolved - Get all config with .env and default fallbacks applied
// Must be defined before /config/:key to avoid "resolved" matching as a :key param
router.get("/config/resolved", async (_req, res, next) => {
  try {
    const resolved = await getAllConfig();
    res.json(resolved);
  } catch (err) {
    next(err);
  }
});

// GET /api/config/:key - Get single config value
router.get("/config/:key", async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(config)
      .where(eq(config.key, req.params.key))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Config key not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/config/:key - Set a config value
router.put("/config/:key", async (req, res, next) => {
  try {
    const db = getDb();
    const { value, encrypted = false } = req.body;

    await db
      .insert(config)
      .values({
        key: req.params.key,
        value,
        encrypted,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: config.key,
        set: { value, encrypted, updatedAt: new Date() },
      });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/config/:key - Delete a config override
router.delete("/config/:key", async (req, res, next) => {
  try {
    const db = getDb();
    await db.delete(config).where(eq(config.key, req.params.key));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
