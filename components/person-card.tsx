"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Check, Pencil, User, X } from "lucide-react";
import type { AlbumEvent, Person } from "@/lib/types";

interface PersonCardProps {
  person: Person;
  events: AlbumEvent[];
  selectedEventSlug: string | null;
  onClick: () => void;
  onRename: (newName: string) => void;
}

export function PersonCard({
  person,
  events,
  selectedEventSlug,
  onClick,
  onRename,
}: PersonCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(person.displayName || person.defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setName(person.displayName || person.defaultName);
    }
  }, [isEditing, person.defaultName, person.displayName]);

  const handleSave = () => {
    if (name.trim() && name.trim() !== (person.displayName || person.defaultName)) {
      onRename(name.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(person.displayName || person.defaultName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const displayName = person.displayName || person.defaultName;
  const photoLabel = `${person.photoCount} ${
    person.photoCount === 1 ? "photo" : "photos"
  }`;
  const eventStats = events.map((event) => {
    const stat = person.eventStats?.find((item) => item.eventSlug === event.slug);
    return {
      event,
      photoCount: stat?.photoCount ?? 0,
    };
  });

  return (
    <div className="group flex min-w-0 flex-col items-center gap-3">
      <div className="relative">
        <button
          onClick={onClick}
          className="relative h-32 w-32 overflow-hidden rounded-full bg-muted shadow-lg ring-1 ring-border transition duration-200 hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-4 focus:ring-offset-background sm:h-36 sm:w-36"
          aria-label={`Open ${displayName}`}
        >
          {person.coverFaceUrl ? (
            <Image
              src={person.coverFaceUrl}
              alt={displayName}
              fill
              sizes="(min-width: 640px) 144px, 128px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary">
              <User className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </button>

        {!isEditing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-md backdrop-blur transition hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
            aria-label={`Rename ${displayName}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex min-w-0 max-w-[160px] flex-col items-center gap-1 text-center">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-28 px-2 text-center text-sm"
            />
            <button
              type="button"
              onClick={handleSave}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
              aria-label="Save name"
            >
              <Check className="h-4 w-4 text-primary" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
              aria-label="Cancel rename"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClick}
            className="max-w-full truncate text-base font-semibold text-foreground hover:text-primary focus:outline-none focus:underline"
          >
            {displayName}
          </button>
        )}
        <span className="text-sm text-muted-foreground">
          {photoLabel}
        </span>
        {eventStats.length > 0 && (
          <div className="mt-1 flex max-w-full justify-center gap-1.5">
            {eventStats.map(({ event, photoCount }) => (
              <span
                key={event.id}
                className={`h-1.5 w-5 rounded-full ${
                  selectedEventSlug === event.slug
                    ? "bg-zinc-950"
                    : photoCount > 0
                      ? "bg-zinc-400"
                      : "bg-zinc-200"
                }`}
                title={`${event.name}: ${photoCount} photos`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
