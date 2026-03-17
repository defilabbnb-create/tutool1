import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Terms of Use | ${SITE_NAME}`,
  description:
    `Read the simple terms of use for ${SITE_NAME}, a public image compression web app.`,
};

const LAST_UPDATED = "March 18, 2026";

const SECTIONS = [
  {
    heading: "Service provided as-is",
    body: `${SITE_NAME} is provided as a simple public tool for image compression and WebP conversion, without guarantees that it will always be available or error-free.`,
  },
  {
    heading: "Your content",
    body: "Only upload images and other content that you own or have the right to use and process.",
  },
  {
    heading: "Acceptable use",
    body: "Please do not abuse the service, try to overload it, upload harmful content, or use it in ways that interfere with other users.",
  },
  {
    heading: "Changes and availability",
    body: "Limits, features, compression behavior, and site availability may change over time as the product is improved.",
  },
  {
    heading: "Abusive usage",
    body: `${SITE_NAME} may block, limit, or refuse usage that appears abusive, excessive, or harmful to the service.`,
  },
  {
    heading: "Limitation of liability",
    body: "To the extent allowed by law, TuTool is not responsible for losses, damages, or business interruptions resulting from use of the service.",
  },
] as const;

export default function TermsPage() {
  return (
    <main className="content-page">
      <div className="content-page-card">
        <p className="content-page-eyebrow">Terms</p>
        <h1>Terms of Use</h1>
        <p className="content-page-updated">Last updated: {LAST_UPDATED}</p>
        <p className="content-page-intro">
          These terms are meant to be short and easy to understand. By using
          {SITE_NAME}, you agree to use the service responsibly and within these
          simple rules.
        </p>

        <div className="policy-sections">
          {SECTIONS.map((section) => (
            <section key={section.heading} className="policy-section">
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <Link href="/" className="content-page-link">
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
