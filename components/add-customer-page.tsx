"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate as mutateSWR } from "swr";
import {
  ArrowLeft,
  AtSign,
  Check,
  Loader2,
  NotebookText,
  Phone,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AuthAvatarMenu } from "@/components/auth-avatar-menu";
import { customerPublicUrl } from "@/lib/customer-host";

interface CreatedCustomer {
  id: string;
  slug: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export function AddCustomerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canCreate = Boolean(name.trim() && !isCreating);
  const previewSlug = name.trim()
    ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
      "customer-slug"
    : "customer-slug";

  const createCustomer = async () => {
    if (!canCreate) return;

    setIsCreating(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        customer?: CreatedCustomer;
      };

      if (!response.ok || !payload.customer) {
        throw new Error(payload.error || "Could not create customer");
      }

      toast({
        title: "Customer created",
        description: `${payload.customer.name} is ready for albums.`,
      });

      await mutateSWR("/api/customers");
      router.push(
        `/customers/${encodeURIComponent(payload.customer.slug)}?created=1`,
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Customer creation failed",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-[#f7f6f2]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/customers"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              aria-label="Back to customers"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
                Admin
              </p>
              <h1 className="truncate text-lg font-semibold sm:text-xl">
                New customer
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={createCustomer}
              disabled={!canCreate}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Create Customer</span>
              <span className="sm:hidden">Create</span>
            </button>
            <AuthAvatarMenu />
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid min-h-[520px] max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:px-8">
          <div className="min-w-0 flex flex-col justify-center">
            <div className="max-w-3xl min-w-0">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm font-medium text-zinc-500 shadow-sm">
                <Sparkles className="h-4 w-4 text-[#4457ff]" />
                Customer workspace
              </p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Customer name"
                aria-label="Customer name"
                className="w-full min-w-0 border-0 bg-transparent text-5xl font-bold tracking-normal text-zinc-900 outline-none placeholder:text-zinc-300 sm:text-7xl"
              />
              <p className="mt-6 max-w-2xl text-xl leading-tight text-zinc-500 sm:text-2xl">
                Client workspace for albums, events, covers, and photo delivery.
              </p>
            </div>
          </div>

          <div className="flex min-h-[420px] flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-950 p-6 text-white shadow-[0_24px_80px_rgba(24,24,27,0.18)]">
            <div>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15">
                <UserRound className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium uppercase tracking-[0.12em] text-white/45">
                Preview
              </p>
              <h2 className="mt-3 break-words text-4xl font-semibold tracking-normal">
                {name.trim() || "New Customer"}
              </h2>
              <p className="mt-3 text-sm text-white/45">
                {customerPublicUrl(previewSlug).replace("https://", "")}
              </p>
            </div>

            <div className="grid gap-0 text-sm">
              <div className="border-t border-white/10 py-4">
                <p className="text-white/45">Albums</p>
                <p className="mt-1 text-2xl font-semibold">0</p>
              </div>
              <div className="border-t border-white/10 py-4">
                <p className="text-white/45">Next step</p>
                <p className="mt-1 font-medium">Create first album</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-zinc-950">Contact details</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">
                <AtSign className="h-3.5 w-3.5" />
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="client@example.com"
                className="h-12 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-base outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">
                <Phone className="h-3.5 w-3.5" />
                Phone
              </span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 555 000 0000"
                className="h-12 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-base outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">
              <NotebookText className="h-3.5 w-3.5" />
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              placeholder="Internal notes, preferences, or handoff details"
              className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200"
            />
          </label>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-zinc-950">Workspace</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
                  0
                </span>
                Albums
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500">
                  0
                </span>
                Events
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500">
                  0
                </span>
                Photos
              </div>
            </div>
          </div>

          <Link
            href={`/albums/new?customerName=${encodeURIComponent(name.trim())}`}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-sm font-semibold shadow-sm transition ${
              name.trim()
                ? "text-zinc-900 hover:bg-zinc-50"
                : "pointer-events-none text-zinc-300"
            }`}
          >
            <Plus className="h-4 w-4" />
            Add First Album
          </Link>

          {errorMessage && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
