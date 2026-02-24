import crypto from "crypto";
import { logger } from "../utils/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let masterKey: Buffer | null = null;

/**
 * Initialize the encryption service with a master key derived from
 * Electron safeStorage. Call this once during app bootstrap.
 *
 * In Electron: pass the result of safeStorage.encryptString("o365-master")
 *   then derive a 256-bit key from it via SHA-256.
 * For dev/testing without Electron: pass a static secret string.
 */
export function initEncryption(secret: Buffer | string): void {
  // Derive a 256-bit key from the secret material
  const material = typeof secret === "string" ? Buffer.from(secret, "utf-8") : secret;
  masterKey = crypto.createHash("sha256").update(material).digest();
  logger.info("Encryption service initialized.");
}

function getKey(): Buffer {
  if (!masterKey) {
    throw new Error("Encryption not initialized. Call initEncryption() first.");
  }
  return masterKey;
}

/**
 * Encrypt a plaintext string. Returns a combined string:
 *   base64(iv):base64(authTag):base64(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a string produced by encrypt().
 */
export function decrypt(encryptedStr: string): string {
  const key = getKey();
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted string format.");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}

/**
 * Check whether the encryption service has been initialized.
 */
export function isEncryptionReady(): boolean {
  return masterKey !== null;
}
