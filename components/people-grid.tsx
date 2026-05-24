"use client";

import useSWR from "swr";
import { PersonCard } from "./person-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlbumEvent, Person } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PeopleGridProps {
  albumSlug: string;
  selectedEventSlug: string | null;
  events: AlbumEvent[];
  onPersonClick: (person: Person) => void;
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
}: PeopleGridProps) {
  const { data, error, isLoading, mutate } = useSWR<{ people: Person[] }>(
    peopleUrl(albumSlug, selectedEventSlug),
    fetcher
  );

  const handleRename = async (person: Person, newName: string) => {
    // Optimistic update
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

  const people = data.people;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-xl font-semibold text-foreground">People</h2>
        <span className="text-sm font-medium text-muted-foreground">
          {people.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {people.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            events={events}
            selectedEventSlug={selectedEventSlug}
            onClick={() => onPersonClick(person)}
            onRename={(newName) => handleRename(person, newName)}
          />
        ))}
      </div>
    </div>
  );
}
