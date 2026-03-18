import type { Metadata } from "next";
import { LandingClient } from "@/components/landing-client";

export const metadata: Metadata = {
  title: "Compress Images Online for Free",
  description:
    "Compress images online for free. Upload PNG, JPG, or WebP files, reduce file size, and download optimized images instantly.",
};

export default function CompressImagesOnlinePage() {
  return (
    <LandingClient
      title="Compress Images Online"
      subtitle="Upload PNG, JPG, or WebP files, reduce image size, and download optimized results instantly."
      intro="Use this free online image compressor to make images smaller before uploading them to your site, store, blog, or landing page."
      benefitTitle="Why compress images online?"
      benefits={[
        "Reduce image weight before publishing to the web.",
        "Save time with a simple browser-based compression flow.",
        "Optimize multiple images and export them individually or as a ZIP.",
      ]}
      faqs={[
        {
          question: "What image types can I compress?",
          answer: "This tool supports PNG, JPG, JPEG, and WebP uploads.",
        },
        {
          question: "What is the upload limit?",
          answer: "Each file can be up to 10MB, with up to 10 files per upload.",
        },
        {
          question: "What format will I download?",
          answer: "Compressed files are exported as WebP for efficient web use.",
        },
      ]}
      relatedLinks={[
        { href: "/", label: "Image Compressor Home" },
        { href: "/jpg-to-webp", label: "JPG to WebP" },
        { href: "/png-to-webp", label: "PNG to WebP" },
      ]}
    />
  );
}
