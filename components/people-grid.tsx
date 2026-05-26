"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { Check, Images, Users, X } from "lucide-react";
import { PersonCard } from "./person-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlbumEvent, Person } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type PeopleSelectionMode = "any" | "all";

interface PeopleGridProps {
  albumSlug: string;
  selectedEventSlug: string | null;
  events: AlbumEvent[];
  onPersonClick: (person: Person) => void;
  onPeopleSelectionApply?: (
    people: Person[],
    mode: PeopleSelectionMode
  ) => void;
}

function peopleUrl(albumSlug: string, selectedEventSlug: string | null) {
  const base = `/api/albums/${encodeURIComponent(albumSlug)}/people`;
  return selectedEventSlug
    ? `${base}?event=${encodeURIComponent(selectedEventSlug)}`
    : base;
}

export function PeopleGrid({
  albumSlug,
  selectedEventSlug,
  events,
  onPersonClick,
  onPeopleSelectionApply,
}: PeopleGridProps) {
  const { data, error, isLoading, mutate } = useSWR<{ people: Person[] }>(
    peopleUrl(albumSlug, selectedEventSlug),
    fetcher
  );

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] =
    useState<PeopleSelectionMode>("any");

  const people = data?.people ?? [];

  const selectedPeople = useMemo(() => {
    const selectedIds = new Set(selectedPersonIds);
    return people.filter((person) => selectedIds.has(person.id));
  }, [people, selectedPersonIds]);

  const selectedIdSet = useMemo(
    () => new Set(selectedPersonIds),
    [selectedPersonIds]
  );

  const resetSelection = () => {
    setIsSelectionMode(false);
    setSelectedPersonIds([]);
    setSelectionMode("any");
  };

  const togglePerson = (personId: string) => {
    setSelectedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  };

  const handleApplySelection = () => {
    if (!selectedPeople.length) return;

    onPeopleSelectionApply?.(selectedPeople, selectionMode);
    resetSelection();
  };

  const handleRename = async (person: Person, newName: string) => {
    if (data) {
      mutate(
        {
          people: data.people.map((p) =>
            p.id === person.id ? { ...p, displayName: newName } : p
          ),
        },
        false
      );
    }

    try {
      await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/people/${encodeURIComponent(
          person.id
        )}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: newName }),
        }
      );
      mutate();
    } catch {
      mutate();
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground">
        Failed to load people. Please check your database connection.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-3">
            <Skeleton className="h-32 w-32 rounded-full sm:h-36 sm:w-36" />
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data?.people?.length) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-6 py-12 text-center text-zinc-500">
        {selectedEventSlug
          ? "No people found in this event yet."
          : "People are still processing for this album."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <h2 className="text-xl font-semibold text-foreground">People</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              {people.length}
            </span>
          </div>

          <p className="mt-1 text-sm text-zinc-500">
            {isSelectionMode
              ? "Select multiple people, then show matching photos."
              : "Open one person, or select multiple people to filter photos."}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {isSelectionMode ? (
            <>
              <button
                type="button"
                onClick={resetSelection}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-600 shadow-sm transition hover:text-zinc-950"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApplySelection}
                disabled={!selectedPeople.length}
                className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                <Images className="h-4 w-4" />
                Show photos
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsSelectionMode(true)}
              className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 sm:w-auto"
            >
              <Users className="h-4 w-4" />
              Select multiple people
            </button>
          )}
        </div>
      </div>
{isSelectionMode && (
  <div className="sticky top-[112px] z-20 w-full max-w-full overflow-hidden rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur-md sm:top-[132px]">  <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
              <div className="flex max-w-[42vw] shrink-0 -space-x-2 overflow-hidden sm:max-w-none">
                {selectedPeople.slice(0, 6).map((person) => {
                  const displayName = person.displayName || person.defaultName;

                  return (
                    <span
                      key={person.id}
                      className="relative h-9 w-9 overflow-hidden rounded-full bg-zinc-100 ring-2 ring-white"
                      title={displayName}
                    >
                      {person.coverFaceUrl ? (
                        <Image
                          src={person.coverFaceUrl}
                          alt={displayName}
                          fill
                          sizes="36px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-500">
                          {displayName.slice(0, 1)}
                        </span>
                      )}
                    </span>
                  );
                })}

                {!selectedPeople.length && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 ring-2 ring-white">
                    <Users className="h-4 w-4" />
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-950">
                  {selectedPeople.length
                    ? `${selectedPeople.length} selected`
                    : "No people selected"}
                </p>
                <p className="text-xs text-zinc-500">
                  Choose how the photo filter should work.
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="grid w-full grid-cols-2 rounded-full bg-zinc-100 p-1 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectionMode("any")}
                  className={`h-8 min-w-0 cursor-pointer rounded-full px-2 text-xs font-medium transition sm:px-3 ${
                    selectionMode === "any"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-500"
                  }`}
                >
                  Any selected
                </button>

                <button
                  type="button"
                  onClick={() => setSelectionMode("all")}
                  className={`h-8 min-w-0 cursor-pointer rounded-full px-2 text-xs font-medium transition sm:px-3 ${
                    selectionMode === "all"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-500"
                  }`}
                >
                  All together
                </button>
              </div>

              <button
                type="button"
                onClick={handleApplySelection}
                disabled={!selectedPeople.length}
                className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                <Images className="h-4 w-4" />
                Show photos
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {people.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            events={events}
            selectedEventSlug={selectedEventSlug}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIdSet.has(person.id)}
            onClick={() => {
              if (isSelectionMode) {
                togglePerson(person.id);
                return;
              }

              onPersonClick(person);
            }}
            onSelectToggle={() => togglePerson(person.id)}
            onRename={(newName) => handleRename(person, newName)}
          />
        ))}
      </div>
    </div>
  );
}