import { NextRequest, NextResponse } from "next/server";
import {
  MAX_FILE_SIZE_BYTES,
  isAllowedUpload,
} from "@/lib/upload-rules";
import sharp from "sharp";

const MAX_DIMENSION = 2560;
const WEBP_QUALITY = 80;

export const runtime = "nodejs";

type CompressionResponse = {
  originalName: string;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  mimeType: string;
  base64: string;
};

function createError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getOutputName(originalName: string) {
  const trimmedName = originalName.trim();
  const fallbackName = "compressed";
  const nameWithoutExt =
    trimmedName.length > 0
      ? trimmedName.replace(/\.[^/.]+$/, "")
      : fallbackName;

  return `${nameWithoutExt}.webp`;
}

function getSavedPercent(originalSize: number, compressedSize: number) {
  if (originalSize <= 0) {
    return 0;
  }

  const saved = ((originalSize - compressedSize) / originalSize) * 100;
  return Number(Math.max(0, saved).toFixed(2));
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileValues = formData.getAll("file");
    const files = fileValues.filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return createError(
        "No file uploaded. Send multipart/form-data with a 'file' field."
      );
    }

    if (files.length > 1) {
      return createError(
        "This endpoint accepts one file per request."
      );
    }

    const inputFile = files[0];

    if (!isAllowedUpload(inputFile.name, inputFile.type)) {
      return createError(
        "Unsupported file type. Allowed types are JPEG/JPG, PNG, and WebP."
      );
    }

    if (inputFile.size > MAX_FILE_SIZE_BYTES) {
      return createError("File is too large. Maximum allowed size is 10MB.");
    }

    const inputBuffer = Buffer.from(await inputFile.arrayBuffer());
    const image = sharp(inputBuffer, { failOn: "error" }).rotate();
    const metadata = await image.metadata();

    const shouldResize =
      (metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION;

    if (shouldResize) {
      image.resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const outputBuffer = await image.webp({ quality: WEBP_QUALITY }).toBuffer();
    const outputName = getOutputName(inputFile.name);

    const response: CompressionResponse = {
      originalName: inputFile.name,
      outputName,
      originalSize: inputFile.size,
      compressedSize: outputBuffer.byteLength,
      savedPercent: getSavedPercent(inputFile.size, outputBuffer.byteLength),
      mimeType: "image/webp",
      base64: outputBuffer.toString("base64"),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Image compression failed.", error);
    return createError("Failed to process image.", 500);
  }
}
