import crypto from "node:crypto";

/**
 * Criptografia AES-256-GCM para credenciais de provider (tokens de
 * acesso, API keys) armazenadas na coluna `credentials` de
 * WhatsAppInstance. Nunca gravamos essas credenciais em texto puro,
 * mesmo confiando no isolamento por RLS — é uma segunda camada:
 * mesmo um dump de banco vazado não expõe os tokens diretamente.
 *
 * A chave (`CREDENTIALS_ENCRYPTION_KEY`) deve ter 32 bytes, gerada
 * uma vez por ambiente e nunca commitada — vive em secret manager
 * na infra (não em .env versionado).
 */
function getKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key) throw new Error("CREDENTIALS_ENCRYPTION_KEY não configurada");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY deve ter 32 bytes em hex (64 caracteres)");
  }
  return buf;
}

export function encryptCredentials(data: object): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // formato: iv:authTag:ciphertext, tudo em base64
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(":");
}

export function decryptCredentials<T>(payload: string): T {
  const [ivB64, authTagB64, dataB64] = payload.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
