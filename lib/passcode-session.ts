export type PasscodeEntity = "album" | "customer";

export const PASSCODE_VERIFICATION_TTL_MS = 30 * 60 * 1000;

interface PasscodeVerification {
  expiresAt: number;
}

function storageKey(entity: PasscodeEntity, slug: string) {
  return `${entity}:${slug}:verified`;
}

function sessionStorageIsAvailable() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

function notifyPasscodeVerificationChanged() {
  window.dispatchEvent(new Event("passcode-verification-changed"));
}

export function passcodeVerificationRemainingMs(
  entity: PasscodeEntity,
  slug: string,
) {
  if (!slug || !sessionStorageIsAvailable()) return 0;

  const key = storageKey(entity, slug);
  const rawValue = window.sessionStorage.getItem(key);
  if (!rawValue) return 0;

  try {
    const verification = JSON.parse(rawValue) as PasscodeVerification;
    const remaining = verification.expiresAt - Date.now();
    if (Number.isFinite(remaining) && remaining > 0) return remaining;
  } catch {
    // Old non-expiring entries are intentionally invalidated.
  }

  window.sessionStorage.removeItem(key);
  return 0;
}

export function rememberPasscodeVerification(
  entity: PasscodeEntity,
  slug: string,
) {
  if (!slug || !sessionStorageIsAvailable()) return;

  window.sessionStorage.setItem(
    storageKey(entity, slug),
    JSON.stringify({ expiresAt: Date.now() + PASSCODE_VERIFICATION_TTL_MS }),
  );
  notifyPasscodeVerificationChanged();
}

export function clearPasscodeVerification(
  entity: PasscodeEntity,
  slug: string,
) {
  if (!slug || !sessionStorageIsAvailable()) return;
  window.sessionStorage.removeItem(storageKey(entity, slug));
  notifyPasscodeVerificationChanged();
}

export function clearAllPasscodeVerifications() {
  if (!sessionStorageIsAvailable()) return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key && /^(album|customer):.+:verified$/.test(key)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  notifyPasscodeVerificationChanged();
}
