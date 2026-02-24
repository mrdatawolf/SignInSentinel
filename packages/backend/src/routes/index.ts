import { Router } from "express";
import configRoutes from "./config.routes";
import clientsRoutes from "./clients.routes";
import credentialsRoutes from "./credentials.routes";
import prechecksRoutes from "./prechecks.routes";
import jobsRoutes from "./jobs.routes";
import graphRoutes from "./graph.routes";
import eventsRoutes from "./events.routes";

const router = Router();

router.use(configRoutes);
router.use(clientsRoutes);
router.use(credentialsRoutes);
router.use(prechecksRoutes);
router.use(jobsRoutes);
router.use(graphRoutes);
router.use(eventsRoutes);

// Health check
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
