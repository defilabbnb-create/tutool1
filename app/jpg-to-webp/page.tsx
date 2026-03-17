import type { Metadata } from "next";
import { LandingClient } from "@/components/landing-client";

export const metadata: Metadata = {
  title: "JPG to WebP Converter Online",
  description:
    "Convert JPG to WebP online. Upload JPEG images, reduce file size, and download optimized WebP files instantly.",
};

export default function JpgToWebpPage() {
  return (
    <LandingClient
      title="JPG to WebP Converter"
      subtitle="Upload JPG or JPEG images, compress them, and download smaller WebP files in seconds."
      intro="Turn heavy JPG images into lighter WebP files for faster websites, better loading speed, and simpler image delivery."
      benefitTitle="Why convert JPG to WebP?"
      benefits={[
        "Shrink JPG image size for faster page loads.",
        "Keep the workflow simple with instant browser-based conversion.",
        "Batch process multiple JPEG images and download them quickly.",
      ]}
      faqs={[
        {
          question: "Why convert JPG to WebP?",
          answer: "WebP usually delivers smaller files than JPG, which helps pages load faster.",
        },
        {
          question: "Can I upload multiple JPG files?",
          answer: "Yes. You can upload up to 20 images in one session.",
        },
        {
          question: "Will my JPG files stay online?",
          answer: "No. Files are processed for instant download and are not stored.",
        },
      ]}
      relatedLinks={[
        { href: "/", label: "Image Compressor Home" },
        { href: "/png-to-webp", label: "PNG to WebP" },
        { href: "/compress-images-online", label: "Compress Images Online" },
      ]}
    />
  );
}
