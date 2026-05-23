"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Check, Pencil, User, X } from "lucide-react";
import type { Person } from "@/lib/types";

interface PersonCardProps {
  person: Person;
  onClick: () => void;
  onRename: (newName: string) => void;
}

export function PersonCard({ person, onClick, onRename }: PersonCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(person.displayName || person.defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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

  return (
    <div className="flex flex-col items-center gap-2 group">
      <button
        onClick={onClick}
        className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background bg-muted"
      >
        {person.coverFaceUrl ? (
          <Image
            src={person.coverFaceUrl}
            alt={person.displayName || person.defaultName}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <User className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
      </button>

      <div className="flex flex-col items-center gap-1 min-w-0 w-full max-w-[120px]">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-sm text-center px-2 w-24"
            />
            <button
              onClick={handleSave}
              className="p-1 hover:bg-accent rounded-md transition-colors"
            >
              <Check className="w-4 h-4 text-primary" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 hover:bg-accent rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group/name">
            <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
              {person.displayName || person.defaultName}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-1 opacity-0 group-hover/name:opacity-100 hover:bg-accent rounded-md transition-all"
            >
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        )}
        <span className="text-xs text-muted-foreground">
          {person.photoCount} {person.photoCount === 1 ? "photo" : "photos"}
        </span>
      </div>
    </div>
  );
}
