"use client";

import { useState } from "react";
import { Users, Images, Sparkles } from "lucide-react";
import { PeopleGrid } from "@/components/people-grid";
import { PhotosGrid } from "@/components/photos-grid";
import { PersonView } from "@/components/person-view";
import { FloatingSearchButton } from "@/components/search-panel";
import type { Person } from "@/lib/types";

type Tab = "people" | "photos";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("people");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  if (selectedPerson) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <PersonView
            person={selectedPerson}
            onBack={() => setSelectedPerson(null)}
          />
        </div>
        <FloatingSearchButton />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                AI Photo Gallery
              </h1>
              <p className="text-sm text-muted-foreground">
                Browse, search, and explore your photos with AI
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "people"}
              onClick={() => setActiveTab("people")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "people"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Users className="w-4 h-4" />
              People
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "photos"}
              onClick={() => setActiveTab("photos")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "photos"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Images className="w-4 h-4" />
              All Photos
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === "people" && (
          <section>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">People</h2>
              <p className="text-sm text-muted-foreground">
                Click on a person to see all their photos. Click the pencil icon to rename.
              </p>
            </div>
            <PeopleGrid onPersonClick={setSelectedPerson} />
          </section>
        )}

        {activeTab === "photos" && (
          <section>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">All Photos</h2>
              <p className="text-sm text-muted-foreground">
                Click on a photo to view it in full size. Use the download button to save.
              </p>
            </div>
            <PhotosGrid />
          </section>
        )}
      </div>

      {/* Floating Search Button */}
      <FloatingSearchButton />
    </main>
  );
}
