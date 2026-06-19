"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function SharePasscodeGate({
  token,
  albumName,
  coverPhotoUrl,
}: {
  token: string;
  albumName: string;
  coverPhotoUrl?: string | null;
}) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passcode || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/share/${encodeURIComponent(token)}/verify-passcode`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not verify passcode");
      }

      window.location.reload();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not verify passcode",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-100 text-zinc-950">
      {coverPhotoUrl && (
        <Image
          src={coverPhotoUrl}
          alt={albumName}
          fill
          sizes="100vw"
          className="hidden object-cover md:block"
          priority
          unoptimized
        />
      )}

      <div className="absolute inset-0 bg-white/78 backdrop-blur-[1px]" />

      <div className="relative z-10 flex min-h-screen items-start justify-center px-5 pt-10 sm:pt-12">
        <div className="w-full max-w-[480px] text-center">
          <p className="mb-14 font-serif text-[18px] uppercase tracking-[0.28em] text-zinc-950">
            {albumName}
          </p>

          <h1 className="mb-14 text-[22px] font-semibold uppercase tracking-[0.22em] text-zinc-950">
            Enter code to view this gallery
          </h1>

          <form onSubmit={submit} className="space-y-4">
            <input
              id="share-passcode"
              type="password"
              value={passcode}
              onChange={(event) => {
                setPasscode(event.target.value);
                if (error) setError("");
              }}
              placeholder="Access Code"
              aria-label="Access code"
              aria-invalid={Boolean(error)}
              autoComplete="current-password"
              autoFocus
              className={`h-12 w-full border bg-white/70 px-4 text-[16px] tracking-wide text-zinc-950 outline-none backdrop-blur-sm placeholder:text-zinc-500 focus:border-zinc-950 ${
                error ? "border-red-500" : "border-zinc-300"
              }`}
            />

            {error && (
              <p className="text-left text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!passcode || isSubmitting}
              className="flex h-12 w-full cursor-pointer items-center justify-center bg-zinc-800 text-[13px] font-semibold uppercase tracking-[0.28em] text-white transition hover:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-white/90" />
                  <span className="sr-only">Checking code</span>
                </>
              ) : (
                "Continue"
              )}
            </button>
          </form>

          <div className="mt-20 space-y-4 text-center">
            <p className="text-[15px] tracking-wide text-zinc-950">
              Signed up already?{" "}
              <Link
                href="/login"
                className="text-zinc-950 transition hover:text-[#868686]"
              >
                Login here
              </Link>
            </p>

            <p className="mx-auto max-w-[440px] text-[14px] leading-5 tracking-wide text-zinc-500">
              Click ‘Login here’ if you signed up using your email, Facebook, or
              Google account.
            </p>

            <p className="text-[14px] tracking-wide">
              <Link
                href="/legal/terms-of-service"
                className="text-[#868686] transition hover:text-black"
              >
                Terms of Service
              </Link>{" "}
              <span className="text-[#868686]">and</span>{" "}
              <Link
                href="/legal/privacy-policy"
                className="text-[#868686] transition hover:text-black"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
