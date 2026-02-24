import { Router } from "express";
import { precheckResults } from "../database/schema";
import { getDb } from "../database/connection";
import { runAllPrechecks } from "../services/precheck.service";

const router = Router();

// GET /api/prechecks - Get last precheck results
router.get("/prechecks", async (_req, res, next) => {
  try {
    const db = getDb();
    const results = await db.select().from(precheckResults);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// POST /api/prechecks/run - Run all prechecks
router.post("/prechecks/run", async (_req, res, next) => {
  try {
    const results = await runAllPrechecks();
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
