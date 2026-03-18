export function getOutputExtension(fileName: string, mimeType: string) {
  const lowerFileName = fileName.toLowerCase();

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  if (mimeType === "image/avif") {
    return ".avif";
  }

  if (mimeType === "image/jxl") {
    return ".jxl";
  }

  if (lowerFileName.endsWith(".jpeg")) {
    return ".jpeg";
  }

  return ".jpg";
}

export function getFormattedOutputName(
  originalName: string,
  mimeType = "image/webp",
  suffix?: string
) {
  const trimmedName = originalName.trim();
  const fallbackName = "compressed";
  const nameWithoutExt =
    trimmedName.length > 0
      ? trimmedName.replace(/\.[^/.]+$/, "")
      : fallbackName;

  const baseName = suffix ? `${nameWithoutExt}-${suffix}` : nameWithoutExt;
  return `${baseName}${getOutputExtension(trimmedName, mimeType)}`;
}
