"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  CalendarDays,
  HardDrive,
  ImageUp,
  Images,
  Lock,
  Loader2,
  Plus,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumPasscodeManager } from "@/components/album-passcode-manager";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { toast } from "@/hooks/use-toast";
import { usePasscodeVerification } from "@/hooks/use-passcode-verification";
import { customerPublicUrl, normalizeHost } from "@/lib/customer-host";
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

interface CustomerCostsResponse {
  costs: {
    estimatedMonthlyUsd: number;
    s3: {
      bytes: number;
      objectCount: number;
      estimatedMonthlyUsd: number;
    };
    rds: {
      bytes: number;
      rowCount: number;
      estimatedMonthlyUsd: number;
    };
  };
}

interface CustomerAlbumsPageProps {
  customerSlug: string;
}

function formatStorageBytes(bytes?: number | null) {
  const value = Math.max(0, bytes ?? 0);
  if (value < 1024) return `${value} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[unitIndex]}`;
}

function formatUsd(value?: number | null) {
  const amount = Math.max(0, value ?? 0);
  if (amount > 0 && amount < 0.01) return "<$0.01";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount < 10 ? 2 : 0,
    maximumFractionDigits: amount < 10 ? 2 : 0,
  }).format(amount);
}

function formatMonthlyCost(value?: number | null) {
  const amount = Math.max(0, value ?? 0);
  if (amount > 0 && amount < 0.01) return "<$0.01/mo";
  return `${formatUsd(amount)}/mo`;
}

function formatCount(value?: number | null) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, value ?? 0));
}

export function CustomerAlbumsPage({ customerSlug }: CustomerAlbumsPageProps) {
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const {
    isVerified: isPasswordVerified,
    markVerified: markPasswordVerified,
  } = usePasscodeVerification("customer", customerSlug);
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
  const [currentHost, setCurrentHost] = useState("");
  const [wasJustCreated, setWasJustCreated] = useState(false);
  const [isUrlHintDismissed, setIsUrlHintDismissed] = useState(false);
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
  const shouldLoadCosts = Boolean(data?.customer) &&
    (!data?.customer?.passwordRequired || isPasswordVerified);
  const { data: costsData, error: costsError, isLoading: costsLoading } =
    useSWR<CustomerCostsResponse>(
      shouldLoadCosts ? `/api/customers/${encodeURIComponent(customerSlug)}/costs` : null,
      fetcher,
      {
        dedupingInterval: 5 * 60 * 1000,
        revalidateOnFocus: false,
      },
    );

  const customerName = data?.customer?.name ?? "Customer";
  const customerShareUrl = data?.customer?.slug
    ? customerPublicUrl(data.customer.slug)
    : "";
  const isAdmin = Boolean(accessData?.isAdmin);
  const customerShareHost = customerShareUrl
    ? new URL(customerShareUrl).host.toLowerCase()
    : "";
  const isOnCustomerHost =
    Boolean(currentHost && customerShareHost) &&
    (currentHost === customerShareHost ||
      currentHost === `www.${customerShareHost}`);
  const showCustomerUrlHint =
    wasJustCreated &&
    Boolean(customerShareUrl) &&
    !isOnCustomerHost &&
    !isUrlHintDismissed;
  const costs = costsData?.costs;
  const costsSummaryTitle = costs
    ? `Estimated monthly storage for ${customerName}: S3 ${formatStorageBytes(costs.s3.bytes)} across ${formatCount(costs.s3.objectCount)} objects (${formatMonthlyCost(costs.s3.estimatedMonthlyUsd)}), RDS table data ${formatStorageBytes(costs.rds.bytes)} across ${formatCount(costs.rds.rowCount)} rows (${formatMonthlyCost(costs.rds.estimatedMonthlyUsd)}). Excludes requests, transfer, CloudFront, Lambda, database indexes, free-tier credits, and backups.`
    : "Estimated customer storage cost";

  useEffect(() => {
    setCurrentHost(normalizeHost(window.location.host));
    setWasJustCreated(new URLSearchParams(window.location.search).has("created"));
  }, []);

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

      markPasswordVerified();
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
            <div className="relative mx-auto mb-6 hidden aspect-[4/3] w-full overflow-hidden rounded-lg bg-zinc-100 md:block">
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
                <>
                  <Image
                    src={data.customer.coverPhotoUrl}
                    alt={customerName}
                    fill
                    sizes="112px"
                    className="hidden object-cover md:block"
                    unoptimized
                  />
                  <span className="flex h-full w-full items-center justify-center md:hidden">
                    <Users className="h-8 w-8" strokeWidth={1.5} />
                  </span>
                </>
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

        {shouldLoadCosts && (
          <section
            className="mb-6 grid gap-3 sm:grid-cols-3"
            aria-label="Customer cost summary"
            title={costsError ? "Customer cost unavailable" : costsSummaryTitle}
          >
            {costsLoading && !costs ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-lg" />
              ))
            ) : costsError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700 sm:col-span-3">
                Customer cost unavailable.
              </div>
            ) : costs ? (
              <>
                <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                    <HardDrive className="h-4 w-4" />
                    Estimated cost
                  </div>
                  <p className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950">
                    {formatMonthlyCost(costs.estimatedMonthlyUsd)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">S3 + RDS storage</p>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                    <Images className="h-4 w-4" />
                    S3 storage
                  </div>
                  <p className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950">
                    {formatStorageBytes(costs.s3.bytes)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatCount(costs.s3.objectCount)} objects · {formatMonthlyCost(costs.s3.estimatedMonthlyUsd)}
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                    <Users className="h-4 w-4" />
                    RDS table data
                  </div>
                  <p className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950">
                    {formatStorageBytes(costs.rds.bytes)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatCount(costs.rds.rowCount)} rows · {formatMonthlyCost(costs.rds.estimatedMonthlyUsd)}
                  </p>
                </div>
              </>
            ) : null}
          </section>
        )}

        {showCustomerUrlHint && (
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between">
            <p>
              You can use{" "}
              <a
                href={customerShareUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline-offset-2 hover:underline"
              >
                {customerShareHost}
              </a>{" "}
              for this customer.
            </p>
            <button
              type="button"
              onClick={() => setIsUrlHintDismissed(true)}
              className="inline-flex h-8 w-fit shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
              aria-label="Dismiss customer URL suggestion"
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </div>
        )}

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
                    <>
                      <Image
                        src={album.coverPhotoUrl}
                        alt={album.name}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="hidden object-cover transition duration-300 group-hover:scale-[1.02] md:block"
                        unoptimized
                        priority={album.photoCount > 0}
                      />
                      <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-400 md:hidden">
                        <Images className="h-10 w-10" strokeWidth={1.5} />
                      </div>
                    </>
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
