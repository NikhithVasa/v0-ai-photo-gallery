import { hashAccessCode } from "@/lib/access-code";
import {
  passcodeAccessTokenFromRequest,
  verifyPasscodeAccessToken,
} from "@/lib/passcode-access-cookie";

export function sharePasscodeHash(passcode: string) {
  return hashAccessCode(passcode);
}

export function verifySharePasscodeAccessToken(
  accessToken: string,
  shareToken: string,
  passcode: string | null,
) {
  if (!passcode) return true;
  if (!accessToken) return false;

  return verifyPasscodeAccessToken(
    accessToken,
    "share",
    shareToken,
    sharePasscodeHash(passcode),
  );
}

export function hasValidSharePasscodeAccess(
  request: Request,
  shareToken: string,
  passcode: string | null,
) {
  return verifySharePasscodeAccessToken(
    passcodeAccessTokenFromRequest(request, "share", shareToken),
    shareToken,
    passcode,
  );
}
