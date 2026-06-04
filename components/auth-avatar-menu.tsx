"use client";

import { useRouter } from "next/navigation";
import { Bookmark, LogOut, Palette, Settings, Upload } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

interface AuthAvatarMenuProps {
  className?: string;
}

function fallbackLabel(email?: string | null) {
  return email?.trim()?.[0]?.toUpperCase() || "U";
}

export function AuthAvatarMenu({ className = "" }: AuthAvatarMenuProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  if (!user) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      window.location.replace("/login");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-zinc-800 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 ${className}`}
          aria-label="Account menu"
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-zinc-100 text-sm font-semibold text-zinc-800">
              {fallbackLabel(user.email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-1rem)]">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
            Signed in
          </p>
          <p className="truncate text-sm font-medium text-zinc-950">
            {user.email}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/presets")}>
          <Palette className="mr-2 h-4 w-4" />
          Preset Marketplace
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/presets/my")}>
          <Bookmark className="mr-2 h-4 w-4" />
          My Presets
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/presets/upload")}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Preset
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
