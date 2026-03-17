import { LandingClient } from "@/components/landing-client";
import { JXL_UPLOAD_ENABLED } from "@/lib/upload-rules";

export function HomeClient() {
  const featurePoints = [
    "Reduce image size without noticeable quality loss",
    "Batch compress multiple images in one quick upload",
    JXL_UPLOAD_ENABLED
      ? "Download in PNG, WebP, or JPEG-XL when available"
      : "Keep image files lighter without changing their format",
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
        ? "Regular uploads stay in the same format, and JXL uploads can be downloaded as PNG or JPG."
        : "Uploads stay in the same format after compression, so they are ready to use right away.",
    },
    {
      question: "Are my files stored?",
      answer: "Files are processed instantly for download and are not stored by the app.",
    },
  ];

  return (
    <LandingClient
      title="Make Your Images Lighter in Seconds"
      subtitle="Reduce image size and prepare PNG, JPG, and WebP images for the web — instantly."
      intro="PixelPress keeps image cleanup simple. Upload once, get smaller web-ready files back in the same format, and move on with your site, store, or next launch."
      featurePoints={featurePoints}
      benefitTitle="Why PixelPress?"
      benefits={[
        "Keep pages fast with lighter images that are easier to ship and share.",
        "Convert messy image batches into clean WebP files without extra steps.",
        "Download single files or a ZIP bundle when everything is ready.",
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
