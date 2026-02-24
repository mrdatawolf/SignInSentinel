import { Router } from "express";
import { eq } from "drizzle-orm";
import { credentials } from "../database/schema";
import { getDb } from "../database/connection";
import { testGraphConnection } from "../services/graph-auth.service";

const router = Router();

// POST /api/graph/test-connection - Test Graph API connection for a credential
router.post("/graph/test-connection", async (req, res, next) => {
  try {
    const { credentialId } = req.body;

    if (!credentialId) {
      res.status(400).json({ error: "credentialId is required." });
      return;
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(credentials)
      .where(eq(credentials.id, parseInt(credentialId)))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Credential not found." });
      return;
    }

    const cred = rows[0];
    if (!cred.tenantId || !cred.clientAppId || !cred.clientSecret) {
      res.status(400).json({
        error: "Credential is missing Graph API configuration (tenantId, clientAppId, or clientSecret).",
      });
      return;
    }

    const result = await testGraphConnection({
      tenantId: cred.tenantId,
      clientAppId: cred.clientAppId,
      clientSecret: cred.clientSecret,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
