"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { Lock, Plus, Trash2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumPasscodeManager } from "@/components/album-passcode-manager";
import { toast } from "@/hooks/use-toast";

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
  albumCount: number;
  createdAt: string;
}

export function CustomersPage() {
  const [selectedCustomerForPasscode, setSelectedCustomerForPasscode] =
    useState<{ slug: string; name: string } | null>(null);
  const [deletingCustomerSlug, setDeletingCustomerSlug] = useState<string | null>(
    null
  );
  const { data, error, isLoading, mutate } = useSWR<{
    customers: CustomerSummary[];
  }>("/api/customers", fetcher, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });

  const deleteCustomer = async (customer: CustomerSummary) => {
    if (deletingCustomerSlug) return;
    const ok = window.confirm(
      `Delete ${customer.name}? This will also hide this customer's albums.`
    );
    if (!ok) return;

    setDeletingCustomerSlug(customer.slug);

    try {
      const response = await fetch(
        `/api/customers/${encodeURIComponent(customer.slug)}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete customer");
      }

      await mutate();
      toast({
        title: "Customer deleted",
        description: `${customer.name} was removed from the customer list.`,
      });
    } catch (deleteError) {
      toast({
        title: "Delete failed",
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Could not delete customer",
        variant: "destructive",
      });
    } finally {
      setDeletingCustomerSlug(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Customers</p>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-5xl">
              Galleries
            </h1>
          </div>

          <Link
            href="/customers/new"
            className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </Link>
        </header>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700">
            Failed to load customers. Please check the database connection.
          </div>
        )}

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && !error && !data?.customers?.length && (
          <div className="rounded-md border border-zinc-200 bg-white px-5 py-12 text-center text-sm text-zinc-500">
            No customers found yet.
          </div>
        )}

        {!!data?.customers?.length && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.customers.map((customer) => (
              <div
                key={customer.id}
                className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link
                  href={`/customers/${customer.slug}`}
                  className="block focus:outline-none focus:ring-2 focus:ring-zinc-400"
                >
                  <div className="relative aspect-[4/3] bg-zinc-100">
                    {customer.coverPhotoUrl ? (
                      <Image
                        src={customer.coverPhotoUrl}
                        alt={customer.name}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-400">
                        <Users className="h-10 w-10" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h2 className="truncate text-2xl font-semibold tracking-tight">
                      {customer.name}
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">{customer.slug}</p>

                    <div className="mt-6 text-sm font-medium text-zinc-500">
                      {customer.albumCount}{" "}
                      {customer.albumCount === 1 ? "album" : "albums"}
                    </div>
                  </div>
                </Link>

                <div className="absolute right-3 top-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCustomerForPasscode({
                        slug: customer.slug,
                        name: customer.name,
                      })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-sm backdrop-blur transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    aria-label={`Manage ${customer.name} passcode`}
                  >
                    <Lock className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteCustomer(customer)}
                    disabled={deletingCustomerSlug === customer.slug}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-rose-600 shadow-sm backdrop-blur transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-50"
                    aria-label={`Delete ${customer.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedCustomerForPasscode && (
        <AlbumPasscodeManager
          albumSlug={selectedCustomerForPasscode.slug}
          albumName={selectedCustomerForPasscode.name}
          entityType="customer"
          onChanged={() => mutate()}
          onClose={() => setSelectedCustomerForPasscode(null)}
        />
      )}
    </main>
  );
}
