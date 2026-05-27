"use client";

import Link from "next/link";
import useSWR from "swr";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CustomerSummary {
  id: string;
  slug: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  albumCount: number;
  createdAt: string;
}

export function CustomersPage() {
  const { data, error, isLoading } = useSWR<{
    customers: CustomerSummary[];
  }>("/api/customers", fetcher, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 sm:mb-10">
          <p className="text-sm font-medium text-zinc-500">Customers</p>
          <h1 className="text-3xl font-semibold tracking-normal sm:text-5xl">
            Galleries
          </h1>
        </header>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-700">
            Failed to load customers. Please check the database connection.
          </div>
        )}

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-xl" />
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
              <Link
                key={customer.id}
                href={`/customers/${customer.slug}`}
                className="group flex min-h-44 flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <div>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition group-hover:bg-zinc-950 group-hover:text-white">
                    <Users className="h-5 w-5" />
                  </div>

                  <h2 className="text-2xl font-semibold tracking-tight">
                    {customer.name}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {customer.slug}
                  </p>
                </div>

                <div className="mt-6 text-sm font-medium text-zinc-500">
                  {customer.albumCount}{" "}
                  {customer.albumCount === 1 ? "album" : "albums"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}