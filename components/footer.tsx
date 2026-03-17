"use client";

import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="site-footer" aria-label="Site footer">
      <div className="site-footer-inner">
        <div className="site-footer-copy">
          <p className="site-footer-name">{SITE_NAME}</p>
          <p className="site-footer-tagline">{SITE_TAGLINE}</p>
          <p className="site-footer-note">
            Files are processed instantly and not stored.
          </p>
        </div>
        <nav className="site-footer-nav" aria-label="Footer links">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="site-footer-link">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
