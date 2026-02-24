import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

export interface FileCheckResult {
  accessible: boolean;
  path: string;
  error?: string;
}

/**
 * Check if a file or directory is accessible (exists and readable).
 */
export async function checkAccess(filePath: string): Promise<FileCheckResult> {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return { accessible: true, path: filePath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`File access check failed for "${filePath}": ${message}`);
    return { accessible: false, path: filePath, error: message };
  }
}

/**
 * Check if a directory exists and is readable.
 */
export async function checkDirectoryAccess(dirPath: string): Promise<FileCheckResult> {
  try {
    await fs.promises.access(dirPath, fs.constants.R_OK);
    const stat = await fs.promises.stat(dirPath);
    if (!stat.isDirectory()) {
      return { accessible: false, path: dirPath, error: "Path exists but is not a directory" };
    }
    return { accessible: true, path: dirPath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Directory access check failed for "${dirPath}": ${message}`);
    return { accessible: false, path: dirPath, error: message };
  }
}

/**
 * Resolve the companies file path from baseFolder + companiesFilename.
 */
export function resolveCompaniesPath(baseFolder: string, companiesFilename: string): string {
  return path.join(baseFolder, companiesFilename);
}
