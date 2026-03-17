export const MAX_FILES_PER_UPLOAD = 20;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_EXTENSIONS = [".jpeg", ".jpg", ".png", ".webp"] as const;

export function formatAllowedTypesLabel() {
  return "JPG, JPEG, PNG, or WebP";
}

export function isAllowedUpload(fileName: string, mimeType: string) {
  const normalizedType = mimeType.toLowerCase();

  if (
    ALLOWED_MIME_TYPES.includes(
      normalizedType as (typeof ALLOWED_MIME_TYPES)[number]
    )
  ) {
    return true;
  }

  const normalizedName = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension)
  );
}
