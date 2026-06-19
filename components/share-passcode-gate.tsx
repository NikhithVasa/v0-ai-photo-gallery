"use client";

import { useState, type FormEvent } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SharePasscodeGate({
  token,
  albumName,
}: {
  token: string;
  albumName: string;
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
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 text-[#1d1d1f]">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-[24px] border border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)]"
      >
        <div className="space-y-2 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100">
            <Lock className="h-5 w-5 text-zinc-700" />
          </span>
          <h1 className="text-xl font-semibold">{albumName}</h1>
          <p className="text-sm text-zinc-500">
            Enter the share link passcode to view this gallery.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="share-passcode">Passcode</Label>
          <Input
            id="share-passcode"
            type="password"
            value={passcode}
            onChange={(event) => {
              setPasscode(event.target.value);
              if (error) setError("");
            }}
            placeholder="Enter passcode"
            autoComplete="current-password"
            autoFocus
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!passcode || isSubmitting}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          View gallery
        </Button>
      </form>
    </main>
  );
}
