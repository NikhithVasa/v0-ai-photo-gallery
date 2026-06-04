"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

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
}

interface CustomerUser {
  id: string;
  email: string;
  role: string;
}

function CustomerAccessManager({ customer }: { customer: CustomerSummary }) {
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"owner" | "member">("member");
  const [isAdding, setIsAdding] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<{ users: CustomerUser[] }>(
    `/api/customers/${encodeURIComponent(customer.slug)}/users`,
    fetcher,
    { dedupingInterval: 0, revalidateOnFocus: false },
  );

  const addUser = async () => {
    const email = newUserEmail.trim();
    if (!email || isAdding) return;

    setIsAdding(true);
    try {
      const response = await fetch(
        `/api/customers/${encodeURIComponent(customer.slug)}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role: newUserRole }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not add user");

      setNewUserEmail("");
      setNewUserRole("member");
      await mutate();
      toast({
        title: "User added",
        description: `${email} can now access ${customer.name}.`,
      });
    } catch (addError) {
      toast({
        title: "Add user failed",
        description:
          addError instanceof Error ? addError.message : "Could not add user",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const removeUser = async (email: string) => {
    if (!window.confirm(`Remove ${email} from ${customer.name}?`)) return;

    try {
      const response = await fetch(
        `/api/customers/${encodeURIComponent(customer.slug)}/users`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not remove user");

      await mutate();
      toast({
        title: "User removed",
        description: `${email} no longer has access to ${customer.name}.`,
      });
    } catch (removeError) {
      toast({
        title: "Remove user failed",
        description:
          removeError instanceof Error
            ? removeError.message
            : "Could not remove user",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
          Customer
        </p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-950">
          {customer.name}
        </h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
        <input
          type="email"
          value={newUserEmail}
          onChange={(event) => setNewUserEmail(event.target.value)}
          placeholder="person@email.com"
          className="h-10 min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
        />
        <select
          value={newUserRole}
          onChange={(event) =>
            setNewUserRole(event.target.value === "owner" ? "owner" : "member")
          }
          className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
        >
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
        <button
          type="button"
          onClick={addUser}
          disabled={!newUserEmail.trim() || isAdding}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add user
        </button>
      </div>

      {isLoading && <Skeleton className="mt-4 h-16 rounded-lg" />}

      {error && (
        <p className="mt-4 text-sm text-rose-600">
          Customer users could not be loaded.
        </p>
      )}

      {!!data?.users.length && (
        <div className="mt-4 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
          {data.users.map((customerUser) => (
            <div
              key={customerUser.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-950">
                  {customerUser.email}
                </p>
                <p className="text-xs capitalize text-zinc-500">
                  {customerUser.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeUser(customerUser.email)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AccountSettingsPage() {
  const { user } = useAuth();
  const { data: accessData, isLoading: accessLoading } = useSWR<{
    isAdmin: boolean;
  }>("/api/auth/access", fetcher, { dedupingInterval: 0, revalidateOnFocus: false });
  const { data: customersData, isLoading: customersLoading } = useSWR<{
    customers: CustomerSummary[];
  }>("/api/customers", fetcher, { dedupingInterval: 0, revalidateOnFocus: false });

  const isAdmin = Boolean(accessData?.isAdmin);

  return (
    <main className="min-h-screen bg-[#fbfaf8] text-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/customers"
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              aria-label="Back to galleries"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-sm font-medium text-zinc-500">Account</p>
              <h1 className="text-3xl font-semibold sm:text-5xl">Settings</h1>
              <p className="mt-2 text-sm text-zinc-500">{user?.email}</p>
            </div>
          </div>
          <AuthAvatarMenu />
        </header>

        <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
              <Users className="h-5 w-5 text-zinc-600" />
            </span>
            <div>
              <h2 className="font-semibold">Customer users</h2>
              <p className="text-sm text-zinc-500">
                Emails listed here can access the selected customer after Supabase login.
              </p>
            </div>
          </div>
        </section>

        {(accessLoading || customersLoading) && (
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        )}

        {!accessLoading && !isAdmin && (
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-500">
            Customer user management is available to account administrators.
          </div>
        )}

        {isAdmin && (
          <div className="space-y-4">
            {customersData?.customers.map((customer) => (
              <CustomerAccessManager key={customer.id} customer={customer} />
            ))}
            {!customersLoading && !customersData?.customers.length && (
              <div className="rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-500">
                No customers are available to manage.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
