"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { mutate as mutateSWR } from "swr";
import { createClient } from "@/lib/supabase-client";
import { clearAllPasscodeVerifications } from "@/lib/passcode-session";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: "google", next?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const currentUserIdRef = useRef<string | null>(null);

  const clearClientDataCache = () => {
    void mutateSWR(
      (key) => typeof key === "string" && key.startsWith("/api/"),
      undefined,
      { revalidate: false },
    );
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        currentUserIdRef.current = session?.user?.id ?? null;
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (event === "SIGNED_OUT" || currentUserIdRef.current !== nextUserId) {
        clearClientDataCache();
      }
      currentUserIdRef.current = nextUserId;
      setSession(session);
      setUser(session?.user ?? null);
    });

    const refreshAfterHistoryRestore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setLoading(true);
      void supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        currentUserIdRef.current = data.session?.user?.id ?? null;
        setLoading(false);
      });
    };
    window.addEventListener("pageshow", refreshAfterHistoryRestore);

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener("pageshow", refreshAfterHistoryRestore);
    };
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    clearClientDataCache();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setSession(null);
    setUser(null);
    currentUserIdRef.current = null;
    clearClientDataCache();
    clearAllPasscodeVerifications();
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) throw error;
  };

  const signInWithOAuth = async (provider: "google", next = "/customers") => {
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          prompt: "login",
        },
      },
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithOAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
