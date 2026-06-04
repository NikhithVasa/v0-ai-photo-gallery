"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  CalendarDays,
  ImageUp,
  Images,
  Lock,
  Loader2,
  Plus,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumPasscodeManager } from "@/components/album-passcode-manager";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { toast } from "@/hooks/use-toast";
import { customerPublicUrl } from "@/lib/customer-host";
import type { AlbumSummary } from "@/lib/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

interface CustomerSummary {
  id: string;
  slug: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  coverPhotoUrl?: string | null;
  passwordRequired?: boolean;
}

interface CustomerAlbumsResponse {
  customer: CustomerSummary;
  albums: AlbumSummary[];
}

interface CustomerAlbumsPageProps {
  customerSlug: string;
}

export function CustomerAlbumsPage({ customerSlug }: CustomerAlbumsPageProps) {
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);
  const [selectedAlbumForPasscode, setSelectedAlbumForPasscode] = useState<{
    slug: string;
    name: string;
  } | null>(null);
  const [isPasscodeManagerOpen, setIsPasscodeManagerOpen] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [deletingAlbumSlugs, setDeletingAlbumSlugs] = useState<string[]>([]);
  const { data, error, isLoading, mutate } = useSWR<CustomerAlbumsResponse>(
    `/api/customers/${encodeURIComponent(customerSlug)}/albums`,
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );
  const { data: accessData } = useSWR<{ isAdmin: boolean }>(
    "/api/auth/access",
    fetcher,
    {
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
    }
  );

  const customerName = data?.customer?.name ?? "Customer";
  const customerShareUrl = data?.customer?.slug
    ? customerPublicUrl(data.customer.slug)
    : "";
  const isAdmin = Boolean(accessData?.isAdmin);

  useEffect(() => {
    setIsPasswordVerified(
      sessionStorage.getItem(`customer:${customerSlug}:verified`) === "true"
    );
  }, [customerSlug]);

  const verifyPassword = async () => {
    if (!password || isCheckingPassword) return;

    setIsCheckingPassword(true);
    setPasswordError("");

    try {
      const response = await fetch(
        `/api/customers/${encodeURIComponent(customerSlug)}/verify-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );
      const payload = (await response.json()) as { ok?: boolean };

      if (!response.ok || !payload.ok) {
        setPasswordError("Wrong code. Please try again.");
        return;
      }

      sessionStorage.setItem(`customer:${customerSlug}:verified`, "true");
      setIsPasswordVerified(true);
    } catch {
      setPasswordError("Could not verify the code. Please try again.");
    } finally {
      setIsCheckingPassword(false);
    }
  };

  const uploadCustomerCover = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((item) =>
      item.type.startsWith("image/")
    );
    if (!file || isUploadingCover) return;

    setIsUploadingCover(true);

    try {
      const response = await fetch(
        `/api/customers/${encodeURIComponent(customerSlug)}/cover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
          }),
        }
      );
      const payload = (await response.json()) as {
        error?: string;
        upload?: { uploadUrl: string; contentType: string };
      };

      if (!response.ok || !payload.upload) {
        throw new Error(payload.error || "Could not prepare cover upload");
      }

      const uploadResponse = await fetch(payload.upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": payload.upload.contentType },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Cover upload failed (${uploadResponse.status})`);
      }

      await mutate();
      toast({
        title: "Cover updated",
        description: `${customerName} cover photo was updated.`,
      });
    } catch (coverError) {
      toast({
        title: "Cover update failed",
        description:
          coverError instanceof Error
            ? coverError.message
            : "Could not update cover photo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const deleteCustomer = async () => {
    if (isDeletingCustomer) return;
    const ok = window.confirm(
      `Delete ${customerName}? This will also hide this customer's albums.`
    );
    if (!ok) return;

    setIsDeletingCustomer(true);

    try {
      const response = await fetch(
        `/api/customers/${encodeURIComponent(customerSlug)}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete customer");
      }

      toast({
        title: "Customer deleted",
        description: `${customerName} was removed.`,
      });
      router.push("/customers");
      router.refresh();
    } catch (deleteError) {
      toast({
        title: "Delete failed",
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Could not delete customer",
        variant: "destructive",
      });
      setIsDeletingCustomer(false);
    }
  };

  const deleteAlbum = async (album: AlbumSummary) => {
    if (deletingAlbumSlugs.includes(album.slug)) return;

    const ok = window.confirm(
      `Delete "${album.name}"? This will hide this album from ${customerName}.`
    );
    if (!ok) return;

    setDeletingAlbumSlugs((current) => [...current, album.slug]);

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(album.slug)}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete album");
      }

      await mutate();
      toast({
        title: "Album deleted",
        description: `${album.name} was removed from ${customerName}.`,
      });
    } catch (deleteError) {
      toast({
        title: "Delete failed",
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Could not delete album",
        variant: "destructive",
      });
    } finally {
      setDeletingAlbumSlugs((current) =>
        current.filter((slug) => slug !== album.slug)
      );
    }
  };

  if (!isLoading && !error && data?.customer?.passwordRequired && !isPasswordVerified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] px-5 text-zinc-950">
        <div className="w-full max-w-sm text-center">
          {data.customer.coverPhotoUrl && (
            <div className="relative mx-auto mb-6 aspect-[4/3] w-full overflow-hidden rounded-lg bg-zinc-100">
              <Image
                src={data.customer.coverPhotoUrl}
                alt={customerName}
                fill
                sizes="384px"
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <h1 className="text-2xl font-semibold">{customerName}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Enter the customer passcode to view albums.
          </p>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") verifyPassword();
            }}
            placeholder="Access code"
            className="mt-6 h-11 w-full rounded-lg border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
          />
          {passwordError && (
            <p className="mt-2 text-left text-sm text-rose-600">{passwordError}</p>
          )}
          <button
            type="button"
            onClick={verifyPassword}
            disabled={!password || isCheckingPassword}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {isCheckingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:mb-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={isUploadingCover || !data?.customer}
              className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60"
              aria-label="Edit customer cover"
            >
              {data?.customer?.coverPhotoUrl ? (
                <Image
                  src={data.customer.coverPhotoUrl}
                  alt={customerName}
                  fill
                  sizes="112px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <Users className="h-8 w-8" strokeWidth={1.5} />
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition hover:bg-black/35 hover:opacity-100">
                {isUploadingCover ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ImageUp className="h-5 w-5" />
                )}
              </span>
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => uploadCustomerCover(event.target.files)}
            />

            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-500">Albums</p>
              <h1 className="truncate text-3xl font-semibold tracking-normal sm:text-5xl">
                {customerName}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {customerShareUrl && (
              <a
                href={customerShareUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <Share2 className="h-4 w-4" />
                Share
              </a>
            )}

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setIsPasscodeManagerOpen(true)}
                  className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <Lock className="h-4 w-4" />
                  Passcode
                </button>

                <button
                  type="button"
                  onClick={deleteCustomer}
                  disabled={isDeletingCustomer}
                  className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-50"
                >
                  {isDeletingCustomer ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </button>
              </>
            )}

            <Link
              href={`/albums/new?customerName=${encodeURIComponent(customerName)}`}
              className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <Plus className="h-4 w-4" />
              Add Album
            </Link>

            <AuthAvatarMenu />
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700">
            Failed to load albums. Please check the database connection.
          </div>
        )}

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && !error && !data?.albums?.length && (
          <div className="rounded-md border border-zinc-200 bg-white px-5 py-12 text-center text-sm text-zinc-500">
            No albums found for this customer yet.
          </div>
        )}

        {!!data?.albums?.length && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.albums.map((album) => (
              <Link
                key={album.id}
                href={`/albums/${album.slug}`}
                className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <div className="relative aspect-[4/3] bg-zinc-100">
                  {(() => {
                    const isDeletingAlbum = deletingAlbumSlugs.includes(album.slug);

                    return (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          deleteAlbum(album);
                        }}
                        disabled={isDeletingAlbum}
                        className="absolute bottom-3 right-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/90 text-rose-600 opacity-0 shadow-sm backdrop-blur transition hover:bg-rose-50 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-70 group-hover:opacity-100"
                        aria-label={`Delete ${album.name}`}
                      >
                        {isDeletingAlbum ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    );
                  })()}

                  {album.coverPhotoUrl ? (
                    <Image
                      src={album.coverPhotoUrl}
                      alt={album.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.02]"
                      unoptimized
                      priority={album.photoCount > 0}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-400">
                      <Images className="h-10 w-10" strokeWidth={1.5} />
                    </div>
                  )}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedAlbumForPasscode({
                          slug: album.slug,
                          name: album.name,
                        });
                      }}
                      className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur ${
                        album.passwordRequired ? "text-zinc-800" : "text-zinc-400"
                      }`}
                      aria-label={`Manage ${album.name} passcode`}
                    >
                      <Lock className="h-4 w-4" />
                    </button>

                    {album.isExpired && (
                      <div className="absolute left-3 top-3 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-white shadow-sm">
                        Expired
                      </div>
                    )}
                  </div>

                <div className="space-y-3 p-4">
                  <div>
                      <h2 className="truncate text-lg font-semibold">
                        {album.name}
                      </h2>
                      <p className="text-sm text-zinc-500">
                        {album.albumDate || album.slug}
                      </p>
                    </div>

                  <div className="flex flex-wrap gap-3 text-sm text-zinc-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Images className="h-4 w-4" />
                      {album.photoCount}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      {album.peopleCount}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      {album.eventCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {isPasscodeManagerOpen && (
        <AlbumPasscodeManager
          albumSlug={customerSlug}
          albumName={customerName}
          entityType="customer"
          onChanged={() => mutate()}
          onClose={() => setIsPasscodeManagerOpen(false)}
        />
      )}

      {selectedAlbumForPasscode && (
        <AlbumPasscodeManager
          albumSlug={selectedAlbumForPasscode.slug}
          albumName={selectedAlbumForPasscode.name}
          onChanged={() => mutate()}
          onClose={() => setSelectedAlbumForPasscode(null)}
        />
      )}
    </main>
  );
}
