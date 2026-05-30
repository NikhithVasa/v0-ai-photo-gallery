import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateRandomAccessCode(length: number = 6): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(length);
  let password = "";

  for (let index = 0; index < length; index += 1) {
    password += chars[bytes[index] % chars.length];
  }

  return password;
}

export function hashAccessCode(password: string): string {
  const digest = createHash("sha256").update(password).digest("hex");
  return `sha256:${digest}`;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function accessCodeMatches(password: string, storedHash: string) {
  if (storedHash.startsWith("sha256:")) {
    return safeCompare(hashAccessCode(password), storedHash);
  }

  if (/^[a-f0-9]{32}$/i.test(storedHash)) {
    const digest = createHash("md5").update(password).digest("hex");
    return safeCompare(digest, storedHash.toLowerCase());
  }

  return safeCompare(password, storedHash);
}
