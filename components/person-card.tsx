"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Pencil, User, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RetryableAvatarImage } from "@/components/retryable-avatar-image";
import type { AlbumEvent, Person } from "@/lib/types";

interface PersonCardProps {
  person: Person;
  events: AlbumEvent[];
  selectedEventSlug: string | null;
  onClick: () => void;
  onRename: (newName: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelectToggle?: () => void;
  readOnly?: boolean;
}

export function PersonCard({
  person,
  events,
  selectedEventSlug,
  onClick,
  onRename,
  isSelectionMode = false,
  isSelected = false,
  onSelectToggle,
  readOnly = false,
}: PersonCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(person.displayName || person.defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = person.displayName || person.defaultName;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setName(displayName);
    }
  }, [displayName, isEditing]);

  useEffect(() => {
    if (isSelectionMode && isEditing) {
      setIsEditing(false);
    }
  }, [isSelectionMode, isEditing]);

  const handleSave = () => {
    const trimmedName = name.trim();

    if (!readOnly && trimmedName && trimmedName !== displayName) {
      onRename(trimmedName);
    }

    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(displayName);
    setIsEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSave();
    }

    if (event.key === "Escape") {
      handleCancel();
    }
  };

  const photoLabel = `${person.photoCount ?? 0} ${
    person.photoCount === 1 ? "photo" : "photos"
  }`;

  const eventStats = events.map((event) => {
    const stat = person.eventStats?.find(
      (item) => item.eventSlug === event.slug
    );

    return {
      event,
      photoCount: stat?.photoCount ?? 0,
    };
  });

  return (
    <div className="group flex min-w-0 flex-col items-center gap-3">
      <div className="relative">
        <button
          type="button"
          onClick={onClick}
          className={`relative h-32 w-32 cursor-pointer overflow-hidden rounded-full bg-muted shadow-lg transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-4 focus:ring-offset-background sm:h-36 sm:w-36 ${
            isSelected
              ? "ring-4 ring-zinc-950 ring-offset-4 ring-offset-background"
              : "ring-1 ring-border hover:shadow-xl"
          }`}
          aria-label={
            isSelectionMode
              ? `${isSelected ? "Unselect" : "Select"} ${displayName}`
              : `Open ${displayName}`
          }
          aria-pressed={isSelectionMode ? isSelected : undefined}
	        >
	          <div className="flex h-full w-full items-center justify-center bg-secondary">
	            <User className="h-12 w-12 text-muted-foreground" />
	          </div>
	          {person.coverFaceUrl ? (
	            <RetryableAvatarImage
	              src={person.coverFaceUrl}
	              alt={displayName}
	              className="absolute inset-0 h-full w-full object-cover"
	            />
	          ) : null}

          {isSelectionMode && (
            <span
              className={`absolute inset-0 flex items-center justify-center transition ${
                isSelected ? "bg-black/25" : "bg-black/0 group-hover:bg-black/10"
              }`}
            >
              <span
                className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border shadow-md transition ${
                  isSelected
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-white/80 bg-white/80 text-zinc-500"
                }`}
              >
                {isSelected && <Check className="h-4 w-4" />}
              </span>
            </span>
          )}
        </button>

        {!isEditing && !isSelectionMode && !readOnly && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsEditing(true);
            }}
            className="absolute bottom-1 right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-md backdrop-blur transition hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover:opacity-100"
            aria-label={`Rename ${displayName}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex min-w-0 max-w-[160px] flex-col items-center gap-1 text-center">
        {isEditing ? (
          <div className="flex max-w-full items-center gap-1">
            <Input
              ref={inputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-20 px-2 text-center text-sm sm:w-28"
            />

            <button
              type="button"
              onClick={handleSave}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-accent"
              aria-label="Save name"
            >
              <Check className="h-4 w-4 text-primary" />
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-accent"
              aria-label="Cancel rename"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (isSelectionMode) {
                onSelectToggle?.();
                return;
              }

              onClick();
            }}
            className={`max-w-full cursor-pointer truncate text-base font-semibold focus:outline-none focus:underline ${
              isSelected
                ? "text-zinc-950"
                : "text-foreground hover:text-primary"
            }`}
          >
            {displayName}
          </button>
        )}

        <span className="text-sm text-muted-foreground">{photoLabel}</span>

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
