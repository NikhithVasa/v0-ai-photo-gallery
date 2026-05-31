"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { Check, GitMerge, Images, Loader2, Users, X } from "lucide-react";
import { PersonCard } from "./person-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlbumEvent, Person } from "@/lib/types";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

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
    useState<PeopleSelectionMode>("all");
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeCoverPersonId, setMergeCoverPersonId] = useState("");
  const [isMergingPeople, setIsMergingPeople] = useState(false);
  const [mergeError, setMergeError] = useState("");

  const people = data?.people ?? [];

  const selectedPeople = useMemo(() => {
    const selectedIds = new Set(selectedPersonIds);
    return people.filter((person) => selectedIds.has(person.id));
  }, [people, selectedPersonIds]);

  const selectedIdSet = useMemo(
    () => new Set(selectedPersonIds),
    [selectedPersonIds]
  );

  useEffect(() => {
    if (!isMergeDialogOpen) return;
    if (selectedPeople.some((person) => person.id === mergeCoverPersonId)) {
      return;
    }

    setMergeCoverPersonId(selectedPeople[0]?.id ?? "");
  }, [isMergeDialogOpen, mergeCoverPersonId, selectedPeople]);

  const resetSelection = () => {
    setIsSelectionMode(false);
    setSelectedPersonIds([]);
    setSelectionMode("all");
    setIsMergeDialogOpen(false);
    setMergeCoverPersonId("");
    setMergeError("");
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

  const openMergeDialog = () => {
    if (selectedPeople.length < 2) return;
    setMergeCoverPersonId(selectedPeople[0].id);
    setMergeError("");
    setIsMergeDialogOpen(true);
  };

  const mergeSelectedPeople = async () => {
    if (selectedPeople.length < 2 || isMergingPeople) return;

    const targetPerson =
      selectedPeople.find((person) => person.id === mergeCoverPersonId) ??
      selectedPeople[0];
    const sourcePeople = selectedPeople.filter(
      (person) => person.id !== targetPerson.id
    );

    if (!sourcePeople.length) return;

    setIsMergingPeople(true);
    setMergeError("");

    try {
      const response = await fetch(
        `/api/albums/${encodeURIComponent(albumSlug)}/people/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetPersonId: targetPerson.id,
            sourcePersonIds: sourcePeople.map((person) => person.id),
            coverPersonId: mergeCoverPersonId || targetPerson.id,
          }),
        }
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not merge people");
      }

      resetSelection();
      await mutate();
    } catch (error) {
      setMergeError(
        error instanceof Error ? error.message : "Could not merge people"
      );
    } finally {
      setIsMergingPeople(false);
    }
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
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">People</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              {people.length}
            </span>
          </div>

          {!isSelectionMode && (
            <p className="mt-1 text-sm text-zinc-500">
              Open one person, or select multiple people to filter photos.
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {isSelectionMode ? (
            <button
              type="button"
              onClick={resetSelection}
              className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-600 shadow-sm transition hover:text-zinc-950 sm:w-auto"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSelectionMode(true)}
              className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-zinc-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 sm:w-auto"
            >
              <Users className="h-4 w-4" />
              Select / merge faces
            </button>
          )}
        </div>
      </div>

      {isSelectionMode && (
        <div className="sticky top-[112px] z-20 w-full max-w-full overflow-hidden rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur-md sm:top-[132px]">
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    : "Select people"}
                </p>
                <p className="text-xs text-zinc-500">
                  Choose how photos should match.
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

              <button
                type="button"
                onClick={openMergeDialog}
                disabled={selectedPeople.length < 2}
                className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                <GitMerge className="h-4 w-4" />
                Merge faces
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

      {isMergeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-faces-title"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h3
                  id="merge-faces-title"
                  className="text-lg font-semibold text-zinc-950"
                >
                  Merge faces
                </h3>
                <p className="text-sm text-zinc-500">
                  Pick the face photo that should stay in the People list.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeDialogOpen(false)}
                disabled={isMergingPeople}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                aria-label="Close merge dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[56vh] space-y-2 overflow-y-auto p-4">
              {selectedPeople.map((person) => {
                const displayName = person.displayName || person.defaultName;
                const isSelected = mergeCoverPersonId === person.id;

                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setMergeCoverPersonId(person.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                      {person.coverFaceUrl ? (
                        <Image
                          src={person.coverFaceUrl}
                          alt={displayName}
                          fill
                          sizes="56px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500">
                          {displayName.slice(0, 1)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-950">
                        {displayName}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {isSelected
                          ? "This face stays"
                          : `${person.photoCount} photos move here`}
                      </span>
                    </span>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-300"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {mergeError && (
              <div className="mx-4 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {mergeError}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsMergeDialogOpen(false)}
                disabled={isMergingPeople}
                className="h-9 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={mergeSelectedPeople}
                disabled={isMergingPeople || !mergeCoverPersonId}
                className="flex h-9 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {isMergingPeople ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitMerge className="h-4 w-4" />
                )}
                Merge faces
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
