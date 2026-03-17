import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description:
    `Read the simple privacy policy for ${SITE_NAME}, a public image compression web app.`,
};

const LAST_UPDATED = "March 18, 2026";

const SECTIONS = [
  {
    heading: "What this tool does",
    body: `${SITE_NAME} helps you compress images online and convert PNG, JPG, and WebP files into smaller WebP downloads.`,
  },
  {
    heading: "How uploads are processed",
    body: "When you upload an image, the file is used only to process compression and generate the download you request.",
  },
  {
    heading: "File storage",
    body: "Files are processed instantly and are not permanently stored by the app after processing is complete.",
  },
  {
    heading: "Analytics and improvement",
    body: "We may collect basic analytics, such as page visits and download actions, to understand usage and improve the product.",
  },
  {
    heading: "Technical information",
    body: "Standard technical information like browser, device, IP or request data may be collected for security, abuse protection, reliability, and diagnostics.",
  },
  {
    heading: "Policy updates",
    body: "This Privacy Policy may be updated over time. If it changes, the latest version will always be posted on this page.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <main className="content-page">
      <div className="content-page-card">
        <p className="content-page-eyebrow">Privacy</p>
        <h1>Privacy Policy</h1>
        <p className="content-page-updated">Last updated: {LAST_UPDATED}</p>
        <p className="content-page-intro">
          We keep privacy simple. This page explains what {SITE_NAME} does with your
          uploads and what limited information may be collected to keep the site
          secure and useful.
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
