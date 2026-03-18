import { LandingClient } from "@/components/landing-client";
import { JXL_UPLOAD_ENABLED } from "@/lib/upload-rules";

export function HomeClient() {
  const featurePoints = [
    "Choose PNG, JPG, WebP, or AVIF output in one quick step",
    "Default to WebP for smaller files and faster pages",
    JXL_UPLOAD_ENABLED
      ? "Download in PNG, WebP, or JPEG-XL when available"
      : "Fall back automatically when advanced compression tools are unavailable",
  ];

  const faqs = [
    {
      question: "Which image formats can I upload?",
      answer: JXL_UPLOAD_ENABLED
        ? "You can upload PNG, JPG, JPEG, WebP, and JXL images."
        : "You can upload PNG, JPG, JPEG, and WebP images.",
    },
    {
      question: "What format do I get back?",
      answer: JXL_UPLOAD_ENABLED
        ? "Choose PNG, JPG, WebP, or AVIF output before upload. JXL uploads can still be downloaded as PNG or JPG."
        : "Choose PNG, JPG, WebP, or AVIF before upload. WebP is the default because it usually gives the smallest files.",
    },
    {
      question: "Are my files stored?",
      answer: "Files are processed instantly for download and are not stored by the app.",
    },
  ];

  return (
    <LandingClient
      title="Make Your Images Lighter in Seconds"
      subtitle="Compress, convert, and optimize PNG, JPG, WebP, and AVIF images for the web — instantly."
      intro="PixelPress keeps image cleanup simple. Upload once, choose the format you want back, and download lighter files that are ready for the web."
      featurePoints={featurePoints}
      benefitTitle="Why PixelPress?"
      benefits={[
        "Keep pages fast with lighter images that are easier to ship and share.",
        "Start with WebP by default, or switch to PNG, JPG, or AVIF when compatibility matters.",
        "Download single files or a ZIP bundle once optimization is complete.",
      ]}
      faqs={faqs}
      relatedLinks={[
        { href: "/jpg-to-webp", label: "JPG to WebP" },
        { href: "/png-to-webp", label: "PNG to WebP" },
        { href: "/compress-images-online", label: "Compress Images Online" },
      ]}
      trackHomepageVisit
      enableRetention
    />
  );
}
