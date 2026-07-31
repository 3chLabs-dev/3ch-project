const crypto = require("crypto");

function getEncryptionKey() {
  const raw = process.env.BILLING_ENCRYPTION_KEY;
  if (!raw) throw new Error("BILLING_ENCRYPTION_KEY is not configured");

  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new Error("BILLING_ENCRYPTION_KEY must be 32 bytes (base64) or 64 hex characters");
  }
  return decoded;
}

function encryptBillingKey(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptBillingKey(value) {
  const [ivValue, tagValue, encryptedValue] = String(value || "").split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted billing key");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { encryptBillingKey, decryptBillingKey };
