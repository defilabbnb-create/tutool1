import type { Metadata } from "next";
import Script from "next/script";
import { Footer } from "@/components/footer";
import {
  analyticsEnabled,
  PLAUSIBLE_API_HOST,
  PLAUSIBLE_DOMAIN,
} from "@/lib/analytics";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    siteName: SITE_NAME,
  },
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          {children}
          <Footer />
        </div>
        {analyticsEnabled ? (
          <Script
            defer
            data-domain={PLAUSIBLE_DOMAIN}
            src={`${PLAUSIBLE_API_HOST}/js/script.js`}
          />
        ) : null}
      </body>
    </html>
  );
}
