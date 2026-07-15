"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  Globe,
  Instagram,
  Mail,
  Phone,
  Save,
  UserRound,
} from "lucide-react";

interface PhotographerCardProfile {
  name: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  website: string;
  instagram: string;
}

interface PhotographerCardPageProps {
  photographerSlug: string;
  initialProfile: PhotographerCardProfile;
  canEdit: boolean;
}

function formatWebsiteUrl(value: string) {
  if (!value.trim()) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function PhotographerCardPage({
  photographerSlug,
  initialProfile,
  canEdit,
}: PhotographerCardPageProps) {
  const storageKey = useMemo(
    () => `photographer-card:${photographerSlug}`,
    [photographerSlug],
  );
  const [profile, setProfile] = useState(initialProfile);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!canEdit || typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<PhotographerCardProfile>;
      setProfile((current) => ({ ...current, ...parsed }));
    } catch {
      // Ignore malformed local storage and keep defaults.
    }
  }, [canEdit, storageKey]);

  const onChange =
    (field: keyof PhotographerCardProfile) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setProfile((current) => ({ ...current, [field]: nextValue }));
    };

  const onSave = () => {
    if (!canEdit || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(profile));
    setIsEditing(false);
  };

  const websiteUrl = formatWebsiteUrl(profile.website);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f3ee] px-4 py-8 text-[#1a1a1a] sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(210,170,120,0.22),transparent_38%),radial-gradient(circle_at_85%_15%,rgba(38,93,85,0.16),transparent_32%),linear-gradient(160deg,#f7f3ee_0%,#efe6da_58%,#f9f6f1_100%)]" />

      <div className="relative mx-auto w-full max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur transition hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to gallery
          </Link>

          <div className="flex items-center gap-2">
            {!canEdit && (
              <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">
                Read only
              </span>
            )}

            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#15423b] px-4 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(21,66,59,0.35)] transition hover:bg-[#0f342f]"
              >
                <Edit3 className="h-4 w-4" />
                Edit card
              </button>
            )}

            {canEdit && isEditing && (
              <button
                type="button"
                onClick={onSave}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#15423b] px-4 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(21,66,59,0.35)] transition hover:bg-[#0f342f]"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            )}
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[30px] border border-[#d7ccbd] bg-[#fffdfa] shadow-[0_30px_80px_rgba(60,30,10,0.18)]">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-[40px] bg-[linear-gradient(140deg,#15423b_0%,#2f6d61_100%)]" />

          <div className="relative grid gap-8 p-6 sm:grid-cols-[1.1fr_1fr] sm:p-10">
            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c6651]">
                Visiting Card
              </p>

              <div className="space-y-3">
                {isEditing ? (
                  <input
                    value={profile.name}
                    onChange={onChange("name")}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-3xl font-semibold tracking-tight outline-none ring-[#15423b]/30 focus:ring"
                    placeholder="Photographer name"
                  />
                ) : (
                  <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-4xl">
                    {profile.name}
                  </h1>
                )}

                {isEditing ? (
                  <input
                    value={profile.role}
                    onChange={onChange("role")}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none ring-[#15423b]/30 focus:ring"
                    placeholder="Role"
                  />
                ) : (
                  <p className="text-sm font-medium text-[#7c6651]">{profile.role}</p>
                )}
              </div>

              <div className="rounded-2xl border border-[#e7dccf] bg-[#faf5ed] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7c6651]">
                  Company
                </p>
                {isEditing ? (
                  <input
                    value={profile.company}
                    onChange={onChange("company")}
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-lg font-semibold text-zinc-900 outline-none ring-[#15423b]/30 focus:ring"
                    placeholder="Company"
                  />
                ) : (
                  <p className="mt-2 text-lg font-semibold text-zinc-900">{profile.company}</p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-black/10 bg-white/75 p-4 backdrop-blur sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Contact
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                  <UserRound className="h-4 w-4 text-[#15423b]" />
                  <span className="truncate text-sm font-medium text-zinc-800">{profile.name}</span>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                  <Mail className="h-4 w-4 text-[#15423b]" />
                  {isEditing ? (
                    <input
                      value={profile.email}
                      onChange={onChange("email")}
                      className="w-full border-0 bg-transparent p-0 text-sm text-zinc-800 outline-none"
                      placeholder="Email"
                    />
                  ) : (
                    <a href={`mailto:${profile.email}`} className="truncate text-sm text-zinc-800 hover:underline">
                      {profile.email}
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                  <Phone className="h-4 w-4 text-[#15423b]" />
                  {isEditing ? (
                    <input
                      value={profile.phone}
                      onChange={onChange("phone")}
                      className="w-full border-0 bg-transparent p-0 text-sm text-zinc-800 outline-none"
                      placeholder="Phone"
                    />
                  ) : (
                    <a href={`tel:${profile.phone}`} className="truncate text-sm text-zinc-800 hover:underline">
                      {profile.phone}
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                  <Instagram className="h-4 w-4 text-[#15423b]" />
                  {isEditing ? (
                    <input
                      value={profile.instagram}
                      onChange={onChange("instagram")}
                      className="w-full border-0 bg-transparent p-0 text-sm text-zinc-800 outline-none"
                      placeholder="Instagram handle"
                    />
                  ) : (
                    <span className="truncate text-sm text-zinc-800">{profile.instagram}</span>
                  )}
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                  <Globe className="h-4 w-4 text-[#15423b]" />
                  {isEditing ? (
                    <input
                      value={profile.website}
                      onChange={onChange("website")}
                      className="w-full border-0 bg-transparent p-0 text-sm text-zinc-800 outline-none"
                      placeholder="Website"
                    />
                  ) : websiteUrl ? (
                    <a href={websiteUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-zinc-800 hover:underline">
                      {profile.website}
                    </a>
                  ) : (
                    <span className="truncate text-sm text-zinc-500">Website not set</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
