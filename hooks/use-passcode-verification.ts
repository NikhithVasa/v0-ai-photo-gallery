"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearPasscodeVerification,
  passcodeVerificationRemainingMs,
  rememberPasscodeVerification,
  type PasscodeEntity,
} from "@/lib/passcode-session";

export function usePasscodeVerification(
  entity: PasscodeEntity,
  slug: string,
) {
  const [isVerified, setIsVerified] = useState(false);

  const refreshVerification = useCallback(() => {
    const remaining = passcodeVerificationRemainingMs(entity, slug);
    setIsVerified(remaining > 0);
    return remaining;
  }, [entity, slug]);

  useEffect(() => {
    const remaining = refreshVerification();
    const handleVerificationChanged = () => refreshVerification();
    window.addEventListener(
      "passcode-verification-changed",
      handleVerificationChanged,
    );

    const timeout = remaining
      ? window.setTimeout(() => setIsVerified(false), remaining)
      : undefined;

    return () => {
      window.removeEventListener(
        "passcode-verification-changed",
        handleVerificationChanged,
      );
      if (timeout) window.clearTimeout(timeout);
    };
  }, [isVerified, refreshVerification]);

  const markVerified = useCallback(() => {
    rememberPasscodeVerification(entity, slug);
    setIsVerified(true);
  }, [entity, slug]);

  const clearVerification = useCallback(() => {
    clearPasscodeVerification(entity, slug);
    setIsVerified(false);
  }, [entity, slug]);

  return { isVerified, markVerified, clearVerification };
}
