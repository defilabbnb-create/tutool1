import type { Metadata } from "next";
import { LandingClient } from "@/components/landing-client";

export const metadata: Metadata = {
  title: "PNG to WebP Converter Online",
  description:
    "Convert PNG to WebP online. Upload PNG images, reduce image size, and download compressed WebP files instantly.",
};

export default function PngToWebpPage() {
  return (
    <LandingClient
      title="PNG to WebP Converter"
      subtitle="Upload PNG images, compress them, and download leaner WebP files without extra steps."
      intro="Convert PNG files into smaller WebP images to improve web performance while keeping transparent images easier to ship."
      benefitTitle="Why convert PNG to WebP?"
      benefits={[
        "Reduce large PNG assets before publishing them online.",
        "Create smaller WebP files that work well for modern websites.",
        "Process multiple PNG images in one session and download them fast.",
      ]}
      faqs={[
        {
          question: "Why convert PNG to WebP?",
          answer: "WebP can significantly reduce PNG file size, especially for web delivery.",
        },
        {
          question: "Does this work for transparent PNG files?",
          answer: "Yes. Transparent PNG uploads can be converted into WebP output.",
        },
        {
          question: "Can I process several PNG files at once?",
          answer: "Yes. Upload multiple files and download them individually or as a ZIP.",
        },
      ]}
      relatedLinks={[
        { href: "/", label: "Image Compressor Home" },
        { href: "/jpg-to-webp", label: "JPG to WebP" },
        { href: "/compress-images-online", label: "Compress Images Online" },
      ]}
    />
  );
}
