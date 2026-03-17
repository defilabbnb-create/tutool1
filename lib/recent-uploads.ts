export const RECENT_UPLOADS_KEY = "pixelpress-recent-uploads";
const MAX_RECENT_UPLOADS = 5;

export type RecentUpload = {
  id: string;
  originalName: string;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  mimeType: string;
  base64: string;
  width: number;
  height: number;
  createdAt: number;
};

function parseRecentUploads(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as RecentUpload[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        typeof item?.id === "string" &&
        typeof item?.originalName === "string" &&
        typeof item?.outputName === "string" &&
        typeof item?.originalSize === "number" &&
        typeof item?.compressedSize === "number" &&
        typeof item?.savedPercent === "number" &&
        typeof item?.mimeType === "string" &&
        typeof item?.base64 === "string" &&
        typeof item?.width === "number" &&
        typeof item?.height === "number" &&
        typeof item?.createdAt === "number"
    );
  } catch {
    return [];
  }
}

export function loadRecentUploads() {
  if (typeof window === "undefined") {
    return [];
  }

  return parseRecentUploads(window.localStorage.getItem(RECENT_UPLOADS_KEY));
}

export function saveRecentUpload(upload: RecentUpload) {
  if (typeof window === "undefined") {
    return;
  }

  const existing = loadRecentUploads().filter(
    (item) => item.outputName !== upload.outputName
  );
  const nextUploads = [upload, ...existing].slice(0, MAX_RECENT_UPLOADS);

  try {
    window.localStorage.setItem(
      RECENT_UPLOADS_KEY,
      JSON.stringify(nextUploads)
    );
    return;
  } catch {
    const smallerList = nextUploads.slice(0, Math.max(1, nextUploads.length - 1));

    try {
      window.localStorage.setItem(
        RECENT_UPLOADS_KEY,
        JSON.stringify(smallerList)
      );
    } catch {
      window.localStorage.removeItem(RECENT_UPLOADS_KEY);
    }
  }
}
