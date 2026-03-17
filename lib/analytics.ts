declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: {
        props?: Record<string, string | number | boolean | null>;
      }
    ) => void;
  }
}

export const PLAUSIBLE_DOMAIN =
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() ?? "";
export const PLAUSIBLE_API_HOST =
  process.env.NEXT_PUBLIC_PLAUSIBLE_API_HOST?.trim() || "https://plausible.io";

export const analyticsEnabled = PLAUSIBLE_DOMAIN.length > 0;

export const analyticsEvents = {
  homepageVisit: "homepage_visit",
  uploadStarted: "upload_started",
  uploadSuccess: "upload_success",
  uploadFailed: "upload_failed",
  downloadSingle: "single_download_clicked",
  downloadAllZip: "download_all_clicked",
} as const;

export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean | null>
) {
  if (typeof window === "undefined" || !analyticsEnabled) {
    return;
  }

  window.plausible?.(eventName, props ? { props } : undefined);
}
