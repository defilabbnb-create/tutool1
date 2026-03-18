"use client";

import { FormEvent, useMemo, useState } from "react";

type NotifySignupProps = {
  visible: boolean;
  source?: string;
};

const SUCCESS_MESSAGE =
  "Thanks! We’ll notify you when batch compression is ready.";

export function NotifySignup({
  visible,
  source = "website",
}: NotifySignupProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedEmail = useMemo(() => email.trim(), [email]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedEmail) {
      setError("Please enter your email to get notified.");
      setMessage("");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: trimmedEmail, source }),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Unable to save your email right now. Please try again.");
        return;
      }

      setMessage(data.message ?? SUCCESS_MESSAGE);
      setEmail("");
    } catch {
      setError("Unable to save your email right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <section
      id="notify-section"
      className="notify-signup"
      aria-label="Batch tools updates"
    >
      <p className="notify-signup-title">
        Compressing many images? We’re building batch tools and API access.
      </p>
      <form className="notify-signup-form" onSubmit={handleSubmit}>
        <input
          type="email"
          className="notify-signup-input"
          aria-label="Notify email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          autoComplete="email"
          inputMode="email"
        />
        <button
          type="submit"
          className="notify-signup-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Notify me"}
        </button>
      </form>
      {message ? <p className="notify-signup-success">{message}</p> : null}
      {error ? <p className="notify-signup-error">{error}</p> : null}
    </section>
  );
}
