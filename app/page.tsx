"use client";

import { useState } from "react";
import { Images, Search, Users } from "lucide-react";
import { PeopleGrid } from "@/components/people-grid";
import { PhotosGrid } from "@/components/photos-grid";
import { PersonView } from "@/components/person-view";
import { FloatingSearchButton } from "@/components/search-panel";
import type { Person } from "@/lib/types";

type Tab = "people" | "photos";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("people");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  if (selectedPerson) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PersonView
            person={selectedPerson}
            onBack={() => setSelectedPerson(null)}
          />
        </div>
        <FloatingSearchButton
          isOpen={isSearchOpen}
          onOpenChange={setIsSearchOpen}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 rounded-full bg-muted p-1" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "people"}
              onClick={() => setActiveTab("people")}
              className={`flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors ${
                activeTab === "people"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-4 h-4" />
              People
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "photos"}
              onClick={() => setActiveTab("photos")}
              className={`flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors ${
                activeTab === "photos"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Images className="w-4 h-4" />
              Library
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "people" && (
          <section className="space-y-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  Albums
                </p>
                <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
                  People & Pets
                </h1>
              </div>
            </div>
            <PeopleGrid onPersonClick={setSelectedPerson} />
          </section>
        )}

        {activeTab === "photos" && (
          <section className="space-y-6">
            <div>
              <p className="mb-1 text-sm font-medium text-muted-foreground">
                Library
              </p>
              <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
                All Photos
              </h1>
            </div>
            <PhotosGrid />
          </section>
        )}
      </div>

      <FloatingSearchButton
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
      />
    </main>
  );
}
