"use client";

import { useEffect, useState } from "react";
import { Copy, Lock, Loader2, Trash2, RefreshCw, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PasscodeManagerProps {
  albumSlug: string;
  albumName: string;
  onClose: () => void;
  entityType?: "album" | "customer";
  onChanged?: () => void;
}

export function AlbumPasscodeManager({
  albumSlug,
  albumName,
  onClose,
  entityType = "album",
  onChanged,
}: PasscodeManagerProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const endpoint = `/${entityType === "album" ? "albums" : "customers"}/${encodeURIComponent(
    albumSlug
  )}`;
  const label = entityType === "album" ? "album" : "customer";

  useEffect(() => {
    void loadPasscodeStatus();
  }, [endpoint]);

  async function loadPasscodeStatus() {
    try {
      const response = await fetch(`/api${endpoint}/password`);
      const data = (await response.json()) as {
        passwordRequired?: boolean;
        hasPassword?: boolean;
      };

      if (data.passwordRequired && data.hasPassword) {
        setCurrentPassword("••••••");
      } else {
        setCurrentPassword("");
      }
    } catch (err) {
      console.error("Failed to load passcode status:", err);
    }
  }

  const generateNewPasscode = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api${endpoint}/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generateNew: true }),
        }
      );

      const data = (await response.json()) as {
        success?: boolean;
        password?: string;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate passcode");
      }

      setNewPassword(data.password || "");
      setCurrentPassword(data.password || "");
      onChanged?.();
      toast({
        title: "Passcode generated",
        description: `New passcode for ${albumName}: ${data.password}`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to generate passcode";
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removePasscode = async () => {
    if (!confirm(`Remove passcode from this ${label}?`)) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api${endpoint}/password`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to remove passcode");
      }

      setCurrentPassword("");
      setNewPassword("");
      onChanged?.();
      toast({
        title: "Passcode removed",
        description: `${albumName} ${label} page is now open to visitors.`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to remove passcode";
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (currentPassword && currentPassword !== "••••••") {
      navigator.clipboard.writeText(currentPassword);
      toast({
        title: "Copied",
        description: "Passcode copied to clipboard.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-zinc-700" />
            <h2 className="text-lg font-semibold text-zinc-950">{albumName}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">
              Current Passcode
            </p>
            <div className="flex items-center gap-2">
              <input
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                readOnly
                className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-950"
                placeholder="No passcode set"
              />
              {currentPassword && currentPassword !== "••••••" && (
                <button
                  onClick={copyToClipboard}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
                  aria-label="Copy passcode"
                >
                  <Copy className="h-4 w-4" />
                </button>
              )}
              {currentPassword && (
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
                  aria-label={showPassword ? "Hide passcode" : "Show passcode"}
                >
                  <span className="text-xs font-semibold">
                    {showPassword ? "Hide" : "Show"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={generateNewPasscode}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Generate Passcode
            </button>

            {currentPassword && (
              <button
                onClick={removePasscode}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Remove Passcode
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
