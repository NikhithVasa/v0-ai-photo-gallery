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
      <div className="text-center py-12 text-muted-foreground">
        Failed to load people. Please check your database connection.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="w-24 h-24 md:w-28 md:h-28 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (!data?.people?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No people found. Make sure your database has people data.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-6">
      {data.people.map((person) => (
        <PersonCard
          key={person.id}
          person={person}
          onClick={() => onPersonClick(person)}
          onRename={(newName) => handleRename(person, newName)}
        />
      ))}
    </div>
  );
}
