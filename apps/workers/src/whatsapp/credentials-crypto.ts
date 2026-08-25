import crypto from "node:crypto";

function getKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key) throw new Error("CREDENTIALS_ENCRYPTION_KEY não configurada");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY deve ter 32 bytes em hex");
  return buf;
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
