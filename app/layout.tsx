import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compress Images in Seconds",
  description:
    "Free online image compressor. Upload PNG, JPG, or WebP, reduce file size, and download instantly.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Compress Images in Seconds",
    description:
      "Free online image compressor. Upload PNG, JPG, or WebP, reduce file size, and download instantly.",
    type: "website",
  },
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
