import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import type { PasscodeEntity } from "@/lib/passcode-session";

export const PASSCODE_ACCESS_TTL_MS = 30 * 60 * 1000;

interface PasscodeAccessPayload {
  entity: PasscodeEntity;
  slug: string;
  expiresAt: number;
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function sameValue(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function encodePayload(payload: PasscodeAccessPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as
      | PasscodeAccessPayload
      | null;
  } catch {
    return null;
  }
}

function parseCookieHeader(header: string) {
  const cookies = new Map<string, string>();

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!name) continue;

    cookies.set(name, value);
  }

  return cookies;
}

export function passcodeAccessCookieName(
  entity: PasscodeEntity,
  slug: string,
) {
  return `saathi_${entity}_passcode_${digest(
    `${entity}:${normalizeSlug(slug)}`,
  ).slice(0, 32)}`;
}

export function createPasscodeAccessToken(
  entity: PasscodeEntity,
  slug: string,
  passwordHash: string,
) {
  const payload = encodePayload({
    entity,
    slug: normalizeSlug(slug),
    expiresAt: Date.now() + PASSCODE_ACCESS_TTL_MS,
  });

  return `${payload}.${sign(payload, passwordHash)}`;
}

export function verifyPasscodeAccessToken(
  token: string,
  entity: PasscodeEntity,
  slug: string,
  passwordHash: string,
) {
  const [payloadPart, signature, extra] = token.split(".");
  if (!payloadPart || !signature || extra) return false;

  const expectedSignature = sign(payloadPart, passwordHash);
  if (!sameValue(signature, expectedSignature)) return false;

  const payload = decodePayload(payloadPart);
  if (!payload) return false;

  return (
    payload.entity === entity &&
    payload.slug === normalizeSlug(slug) &&
    Number.isFinite(payload.expiresAt) &&
    payload.expiresAt > Date.now()
  );
}

export function passcodeAccessTokenFromRequest(
  request: Request,
  entity: PasscodeEntity,
  slug: string,
) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return "";

  return (
    parseCookieHeader(cookieHeader).get(passcodeAccessCookieName(entity, slug)) ||
    ""
  );
}

export function setPasscodeAccessCookie(
  response: NextResponse,
  entity: PasscodeEntity,
  slug: string,
  passwordHash: string,
) {
  response.cookies.set(
    passcodeAccessCookieName(entity, slug),
    createPasscodeAccessToken(entity, slug, passwordHash),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(PASSCODE_ACCESS_TTL_MS / 1000),
    },
  );
}
