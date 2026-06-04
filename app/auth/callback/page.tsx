"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { Spinner } from "@/components/ui/spinner";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();

      // Get the code from the URL
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch (error) {
          console.error("Error exchanging code for session:", error);
        }
      }

      router.replace("/customers");
      router.refresh();
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <Spinner className="h-8 w-8" />
        <p className="text-stone-600">Completing sign in...</p>
      </div>
    </div>
  );
}
