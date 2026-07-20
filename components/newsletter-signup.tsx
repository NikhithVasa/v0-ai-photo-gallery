"use client";

import { FormEvent, useState } from "react";
import styles from "./newsletter-signup.module.css";

type SubmitState =
  | { status: "idle"; message: "" }
  | { status: "submitting"; message: "" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function NewsletterSignup() {
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
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          website: formData.get("website"),
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "We could not subscribe you.");
      }

      form.reset();
      setSubmitState({
        status: "success",
        message: "You’re on the list.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "We could not subscribe you. Please try again.",
      });
    }
  }

  const isSubmitting = submitState.status === "submitting";

  return (
    <section className={styles.section} aria-labelledby="newsletter-heading">
      <div className={styles.container}>
        <div className={styles.outer}>
          <div className={styles.inner}>
            <div className={styles.copy}>
              <h2 id="newsletter-heading">Sign up to our newsletter</h2>
              <p>Weekly product updates and art world news straight to your inbox</p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <label className={styles.srOnly} htmlFor="newsletter-email">Email address</label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Email address*"
                required
                disabled={isSubmitting}
              />
              <input
                className={styles.honeypot}
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <button
                type="submit"
                aria-label="Subscribe to the newsletter"
                aria-busy={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className={styles.spinner} aria-hidden="true" />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10h11M10.75 5.75 15 10l-4.25 4.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <p
                className={`${styles.message} ${submitState.status === "error" ? styles.error : ""}`}
                role={submitState.status === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                {submitState.message}
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
