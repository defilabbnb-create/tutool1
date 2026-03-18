import type { Metadata } from "next";
import { HomeClient } from "@/components/home-client";

export const metadata: Metadata = {
  title: "Free Image Compressor – Reduce PNG, JPG, WebP, AVIF Size Online",
  description:
    "Compress images online with smart optimization. Supports PNG, JPG, WebP, AVIF with best size-quality balance.",
};

export default function HomePage() {
  return <HomeClient />;
}
