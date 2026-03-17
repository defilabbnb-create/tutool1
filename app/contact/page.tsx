import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact | ${SITE_NAME}`,
  description: `Get in touch with ${SITE_NAME} for support, bug reports, or feedback.`,
};

const CONTACT_EMAIL = "hello@example.com";

export default function ContactPage() {
  return (
    <main className="content-page">
      <div className="content-page-card">
        <p className="content-page-eyebrow">Contact</p>
        <h1>Contact</h1>
        <p className="content-page-intro">
          Have a question or spotted an issue? You can reach out for support,
          bug reports, or feedback.
        </p>

        <section className="policy-section" aria-label="Contact method">
          <h2>Email</h2>
          <p>
            Contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="content-page-link">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <p>
            If you are reporting a problem, include the file type and a short
            note about what happened.
          </p>
        </section>

        <Link href="/" className="content-page-link">
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
