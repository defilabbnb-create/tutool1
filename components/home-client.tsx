import { LandingClient } from "@/components/landing-client";

export function HomeClient() {
  return (
    <LandingClient
      title="Make Your Images Lighter in Seconds"
      subtitle="Reduce image size and prepare PNG, JPG, and WebP images for the web — instantly."
      intro="PixelPress keeps image cleanup simple. Upload once, get smaller web-ready files back in the same format, and move on with your site, store, or next launch."
      featurePoints={[
        "Reduce image size without noticeable quality loss",
        "Batch compress multiple images in one quick upload",
        "Download in PNG, WebP, or JPEG-XL when available",
      ]}
      benefitTitle="Why PixelPress?"
      benefits={[
        "Keep pages fast with lighter images that are easier to ship and share.",
        "Convert messy image batches into clean WebP files without extra steps.",
        "Download single files or a ZIP bundle when everything is ready.",
      ]}
      faqs={[
        {
          question: "Which image formats can I upload?",
          answer: "You can upload PNG, JPG, JPEG, WebP, and JXL images.",
        },
        {
          question: "What format do I get back?",
          answer: "Regular uploads stay in the same format, and JXL uploads can be downloaded as PNG or JPG.",
        },
        {
          question: "Are my files stored?",
          answer: "Files are processed instantly for download and are not stored by the app.",
        },
      ]}
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
