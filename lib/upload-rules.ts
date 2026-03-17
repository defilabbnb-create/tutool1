export const MAX_FILES_PER_UPLOAD = 20;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_EXTENSIONS = [".jpeg", ".jpg", ".png", ".webp"] as const;
export const EMPTY_UPLOAD_MESSAGE = "No files were uploaded.";
export const TOO_MANY_FILES_MESSAGE = `You can upload up to ${MAX_FILES_PER_UPLOAD} images at a time.`;
export const INVALID_FILE_TYPE_MESSAGE =
  "Only PNG, JPG, and WebP images are supported.";
export const FILE_TOO_LARGE_MESSAGE = "Each file must be 10MB or smaller.";
export const EMPTY_FILE_MESSAGE = "No files were uploaded.";

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

type UploadCandidate = {
  name: string;
  type: string;
  size: number;
};

export function getUploadValidationError(file: UploadCandidate) {
  if (file.size <= 0) {
    return EMPTY_FILE_MESSAGE;
  }

  if (!isAllowedUpload(file.name, file.type)) {
    return INVALID_FILE_TYPE_MESSAGE;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return FILE_TOO_LARGE_MESSAGE;
  }

  return null;
}
