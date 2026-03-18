export const MAX_FILES_PER_UPLOAD = 20;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const JXL_UPLOAD_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_JXL_UPLOAD === "true";

const BASE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const BASE_ALLOWED_EXTENSIONS = [".jpeg", ".jpg", ".png", ".webp", ".avif"] as const;

export const OUTPUT_FORMAT_OPTIONS = ["png", "jpeg", "webp", "avif"] as const;
export type OutputFormatOption = (typeof OUTPUT_FORMAT_OPTIONS)[number];

export const ALLOWED_MIME_TYPES = JXL_UPLOAD_ENABLED
  ? [...BASE_ALLOWED_MIME_TYPES, "image/jxl"]
  : [...BASE_ALLOWED_MIME_TYPES];

export const ALLOWED_EXTENSIONS = JXL_UPLOAD_ENABLED
  ? [...BASE_ALLOWED_EXTENSIONS, ".jxl"]
  : [...BASE_ALLOWED_EXTENSIONS];
export const EMPTY_UPLOAD_MESSAGE = "No files were uploaded.";
export const TOO_MANY_FILES_MESSAGE = `You can upload up to ${MAX_FILES_PER_UPLOAD} images at a time.`;
export const INVALID_FILE_TYPE_MESSAGE =
  JXL_UPLOAD_ENABLED
    ? "Only PNG, JPG, WebP, AVIF, and JXL images are supported."
    : "Only PNG, JPG, WebP, and AVIF images are supported.";
export const FILE_TOO_LARGE_MESSAGE = "Each file must be 10MB or smaller.";
export const EMPTY_FILE_MESSAGE = "No files were uploaded.";
export const INVALID_IMAGE_CONTENT_MESSAGE =
  "This file could not be read as a valid image.";

export function formatAllowedTypesLabel() {
  return JXL_UPLOAD_ENABLED
    ? "JPG, JPEG, PNG, WebP, AVIF, or JXL"
    : "JPG, JPEG, PNG, WebP, or AVIF";
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
