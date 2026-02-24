import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { jobRuns, jobItems } from "../database/schema";
import { getDb } from "../database/connection";
import { startJobRun, cancelJobRun, isJobRunning, getActiveJobRunId } from "../services/job-queue.service";
import { exportJobRun } from "../services/export.service";
import type { CreateJobRequest } from "@signin-sentinel/shared";

const router = Router();

// GET /api/jobs - List all job runs (paginated)
router.get("/jobs", async (req, res, next) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const runs = await db
      .select()
      .from(jobRuns)
      .orderBy(desc(jobRuns.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ runs, page, limit, activeJobRunId: getActiveJobRunId() });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/:id - Get job run detail with items
router.get("/jobs/:id", async (req, res, next) => {
  try {
    const db = getDb();
    const runId = parseInt(req.params.id);

    const runs = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.id, runId))
      .limit(1);

    if (runs.length === 0) {
      res.status(404).json({ error: "Job run not found" });
      return;
    }

    const items = await db
      .select()
      .from(jobItems)
      .where(eq(jobItems.jobRunId, runId));

    res.json({ run: runs[0], items });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/status - Check if a job is currently running
router.get("/jobs/status", async (_req, res, next) => {
  try {
    res.json({ running: isJobRunning(), activeJobRunId: getActiveJobRunId() });
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs - Start a new job run
router.post("/jobs", async (req, res, next) => {
  try {
    const { clientIds, dateFrom, dateTo } = req.body as CreateJobRequest;

    if (!dateFrom || !dateTo) {
      res.status(400).json({ error: "dateFrom and dateTo are required." });
      return;
    }

    const result = await startJobRun({ clientIds, dateFrom, dateTo });
    res.status(201).json(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("already running")) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// POST /api/jobs/:id/cancel - Cancel a running job
router.post("/jobs/:id/cancel", async (req, res, next) => {
  try {
    const jobRunId = parseInt(req.params.id);
    await cancelJobRun(jobRunId);
    res.json({ message: "Cancel requested.", jobRunId });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("not found") || err.message.includes("already"))) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// POST /api/jobs/:id/export - Export sign-in logs for a completed job run
router.post("/jobs/:id/export", async (req, res, next) => {
  try {
    const jobRunId = parseInt(req.params.id);
    const results = await exportJobRun(jobRunId);
    res.json({
      jobRunId,
      files: results,
      totalRecords: results.reduce((s, r) => s + r.recordCount, 0),
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("not found") || err.message.includes("Cannot export"))) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
