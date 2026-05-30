"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithOAuth, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up flow
        const { signUp } = await import("@/lib/auth-context").then((m) => ({
          signUp: async (email: string, password: string) => {
            const { createClient } = await import("@/lib/supabase-client");
            const supabase = createClient();
            const { error } = await supabase.auth.signUp({
              email,
              password,
            });
            if (error) throw error;
          },
        }));
        await signUp(email, password);
        setError(null);
        // Show success message
        alert(
          "Sign up successful! Please check your email to confirm your account."
        );
        setIsSignUp(false);
      } else {
        // Sign in flow
        await signIn(email, password);
        router.push("/customers");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "github") => {
    setError(null);
    setLoading(true);

    try {
      await signInWithOAuth(provider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OAuth sign in failed";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 px-4">
      <Card className="w-full max-w-md">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold text-stone-950 mb-2">
              {isSignUp ? "Create Account" : "Sign In"}
            </h1>
            <p className="text-stone-600">
              {isSignUp
                ? "Join to access your photo gallery"
                : "Welcome back to your gallery"}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-stone-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || authLoading}
                required
                className="border-stone-200"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-stone-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || authLoading}
                  required
                  className="border-stone-200 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700"
                  disabled={loading || authLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || authLoading || !email || !password}
              className="w-full bg-stone-950 hover:bg-stone-800 text-white mt-6"
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </>
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-stone-500">Or continue with</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-2 mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full border-stone-200 hover:bg-stone-50"
              onClick={() => handleOAuthSignIn("google")}
              disabled={loading || authLoading}
            >
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-stone-200 hover:bg-stone-50"
              onClick={() => handleOAuthSignIn("github")}
              disabled={loading || authLoading}
            >
              GitHub
            </Button>
          </div>

          {/* Toggle Sign Up / Sign In */}
          <div className="text-center text-sm text-stone-600">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                  }}
                  className="text-stone-950 font-medium hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                  }}
                  className="text-stone-950 font-medium hover:underline cursor-pointer"
                >
                  Sign up
                </button>
              </>
            )}
          </div>

          {/* Back to home */}
          <div className="mt-6 pt-6 border-t border-stone-200">
            <Link
              href="/"
              className="inline-flex text-sm text-stone-600 hover:text-stone-950"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
