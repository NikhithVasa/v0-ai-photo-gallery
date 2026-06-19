"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SubmitState =
  | { status: "idle"; message: "" }
  | { status: "submitting"; message: "" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function ContactPage() {
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitState({ status: "submitting", message: "" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          description: formData.get("description"),
          website: formData.get("website"),
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "We could not send your message.");
      }

      form.reset();
      setSubmitState({
        status: "success",
        message: "Your message has been sent. We’ll get back to you soon.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "We could not send your message. Please try again.",
      });
    }
  }

  const isSubmitting = submitState.status === "submitting";

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#1F1B16]">
      <header className="border-b border-[#E8DED2]/80 bg-[#FAF7F2]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#171411] text-[#FAF7F2]">
              <Camera className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="font-serif text-lg text-[#3A2A22]">
              SaathiDesk
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#6F655B] transition hover:text-[#1F1B16]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9A6B42]">
            Contact us
          </p>
          <h1 className="mt-4 max-w-xl font-serif text-4xl leading-tight sm:text-6xl">
            Let’s talk about your gallery.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#6F655B] sm:text-lg">
            Send us a note about SaathiDesk, your photo workflow, or any support
            question. We’ll reply directly to the email you provide.
          </p>

          <div className="mt-10 space-y-5">
            <a
              href="mailto:brunoboy0102@gmail.com"
              className="flex items-start gap-4 rounded-2xl border border-[#E8DED2] bg-white/70 p-5 transition hover:border-[#D6C8B8]"
            >
              <Mail className="mt-0.5 h-5 w-5 text-[#9A6B42]" />
              <span>
                <span className="block text-xs uppercase tracking-[0.14em] text-[#8B8176]">
                  Email
                </span>
                <span className="mt-1 block text-sm font-medium text-[#3A2A22]">
                  brunoboy0102@gmail.com
                </span>
              </span>
            </a>

            <a
              href="tel:+16789040541"
              className="flex items-start gap-4 rounded-2xl border border-[#E8DED2] bg-white/70 p-5 transition hover:border-[#D6C8B8]"
            >
              <Phone className="mt-0.5 h-5 w-5 text-[#9A6B42]" />
              <span>
                <span className="block text-xs uppercase tracking-[0.14em] text-[#8B8176]">
                  Phone
                </span>
                <span className="mt-1 block text-sm font-medium text-[#3A2A22]">
                  (678) 904-0541
                </span>
              </span>
            </a>

            <a
              href="https://www.google.com/maps/search/?api=1&query=1870+The+Exchange+SE%2C+Suite+200%2C+Atlanta%2C+GA+30339"
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-4 rounded-2xl border border-[#E8DED2] bg-white/70 p-5 transition hover:border-[#D6C8B8]"
            >
              <MapPin className="mt-0.5 h-5 w-5 text-[#9A6B42]" />
              <span>
                <span className="block text-xs uppercase tracking-[0.14em] text-[#8B8176]">
                  Address
                </span>
                <span className="mt-1 block text-sm font-medium leading-6 text-[#3A2A22]">
                  1870 The Exchange SE, Suite 200
                  <br />
                  Atlanta, GA 30339
                </span>
              </span>
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-[#E8DED2] bg-white p-6 shadow-[0_24px_80px_rgba(58,42,34,0.08)] sm:p-10">
          <h2 className="font-serif text-3xl">Send a message</h2>
          <p className="mt-2 text-sm leading-6 text-[#7A7066]">
            All fields are required.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
                className="h-12 border-[#D6C8B8] bg-[#FAF7F2]/50"
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  className="h-12 border-[#D6C8B8] bg-[#FAF7F2]/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  minLength={7}
                  maxLength={30}
                  required
                  className="h-12 border-[#D6C8B8] bg-[#FAF7F2]/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                minLength={10}
                maxLength={5000}
                required
                rows={7}
                placeholder="How can we help?"
                className="min-h-40 resize-y border-[#D6C8B8] bg-[#FAF7F2]/50"
              />
            </div>

            <div className="absolute -left-[9999px]" aria-hidden="true">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {submitState.status === "success" && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {submitState.message}
              </p>
            )}

            {submitState.status === "error" && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {submitState.message}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="h-12 w-full rounded-full bg-[#171411] text-[#FAF7F2] hover:bg-[#3A2A22]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send message
                </>
              )}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
