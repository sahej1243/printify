import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";

function encryptionKey(trackingToken: string) {
  return createHash("sha256").update("printify-collection-code-v1:").update(trackingToken).digest();
}

export function createCollectionCode() {
  return randomInt(0, 100_000_000).toString().padStart(8, "0");
}

export function hashCollectionCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function encryptCollectionCode(code: string, trackingToken: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(trackingToken), iv);
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptCollectionCode(payload: string, trackingToken: string) {
  const [ivText, tagText, ciphertextText] = payload.split(".");
  if (!ivText || !tagText || !ciphertextText) throw new Error("Invalid collection code envelope.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(trackingToken), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}
