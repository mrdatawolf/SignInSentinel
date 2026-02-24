import winston from "winston";
import path from "path";

let logDir = ".";

export function setLogDir(dir: string) {
  logDir = dir;
}

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export function addFileTransport(dir: string) {
  logger.add(
    new winston.transports.File({
      filename: path.join(dir, "error.log"),
      level: "error",
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(dir, "app.log"),
    })
  );
}
