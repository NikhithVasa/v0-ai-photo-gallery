"use client";

import useSWR from "swr";
import { PersonCard } from "./person-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Person } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PeopleGridProps {
  onPersonClick: (person: Person) => void;
}

export function PeopleGrid({ onPersonClick }: PeopleGridProps) {
  const { data, error, isLoading, mutate } = useSWR<{ people: Person[] }>(
    "/api/people",
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
      await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newName }),
      });
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
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground">
        No people found. Make sure your database has people data.
      </div>
    );
  }

  const people = [...data.people].sort((a, b) => {
    const aName = a.displayName || a.defaultName;
    const bName = b.displayName || b.defaultName;
    return aName.localeCompare(bName, undefined, { sensitivity: "base" });
  });

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
            onClick={() => onPersonClick(person)}
            onRename={(newName) => handleRename(person, newName)}
          />
        ))}
      </div>
    </div>
  );
}
