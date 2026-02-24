import express from "express";
import cors from "cors";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { logger } from "./utils/logger";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: true }));
  app.use(express.json());

  // CSP — allow self + local API + inline styles (Tailwind) + Graph/MSAL endpoints
  app.use((_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' http://127.0.0.1:* https://graph.microsoft.com https://login.microsoftonline.com",
        "img-src 'self' data:",
        "font-src 'self'",
      ].join("; ")
    );
    next();
  });

  // Request logging
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // API routes
  app.use("/api", apiRoutes);

  // Error handling
  app.use(errorHandler);

  return app;
}

export async function startServer(
  port: number = 0
): Promise<{ port: number; close: () => void }> {
  const app = createServer();

  return new Promise((resolve) => {
    const server = app.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const assignedPort = typeof addr === "object" && addr ? addr.port : port;
      logger.info(`Express server listening on http://127.0.0.1:${assignedPort}`);
      resolve({
        port: assignedPort,
        close: () => server.close(),
      });
    });
  });
}
