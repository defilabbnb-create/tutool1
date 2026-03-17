import { NextRequest, NextResponse } from "next/server";
import {
  EMPTY_UPLOAD_MESSAGE,
  getUploadValidationError,
  MAX_FILES_PER_UPLOAD,
  TOO_MANY_FILES_MESSAGE,
} from "@/lib/upload-rules";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import sharp from "sharp";

const MAX_DIMENSION = 2560;
const WEBP_QUALITY = 80;
const EXPORT_VARIANTS = [
  { label: "large", maxWidth: 1200 },
  { label: "medium", maxWidth: 800 },
  { label: "small", maxWidth: 400 },
] as const;

export const runtime = "nodejs";

type VariantResponse = {
  label: string;
  outputName: string;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
  base64: string;
};

type CompressionResponse = {
  originalName: string;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  mimeType: string;
  base64: string;
  width: number;
  height: number;
  variants: VariantResponse[];
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

function getVariantOutputName(originalName: string, label: string) {
  const trimmedName = originalName.trim();
  const fallbackName = "compressed";
  const nameWithoutExt =
    trimmedName.length > 0
      ? trimmedName.replace(/\.[^/.]+$/, "")
      : fallbackName;

  return `${nameWithoutExt}-${label}.webp`;
}

function getSavedPercent(originalSize: number, compressedSize: number) {
  if (originalSize <= 0) {
    return 0;
  }

  const saved = ((originalSize - compressedSize) / originalSize) * 100;
  return Number(Math.max(0, saved).toFixed(2));
}

async function generateWebpExport(
  inputBuffer: Buffer,
  maxWidth: number,
  maxHeight?: number
) {
  const image = sharp(inputBuffer, { failOn: "error" }).rotate();

  image.resize({
    width: maxWidth,
    height: maxHeight,
    fit: "inside",
    withoutEnlargement: true,
  });

  const { data, info } = await image
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    size: info.size,
  };
}

export async function POST(request: NextRequest) {
  try {
    const clientIdentifier = getClientIdentifier(request.headers);
    const rateLimit = checkRateLimit(clientIdentifier);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many requests. Please wait a moment and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const formData = await request.formData();
    const fileValues = formData.getAll("file");
    const files = fileValues.filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return createError(
        EMPTY_UPLOAD_MESSAGE
      );
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      return createError(TOO_MANY_FILES_MESSAGE);
    }

    if (files.length > 1) {
      return createError("Please upload one image at a time.");
    }

    const inputFile = files[0];

    const validationError = getUploadValidationError({
      name: inputFile.name,
      type: inputFile.type,
      size: inputFile.size,
    });

    if (validationError) {
      return createError(validationError);
    }

    const inputBuffer = Buffer.from(await inputFile.arrayBuffer());
    const mainExport = await generateWebpExport(
      inputBuffer,
      MAX_DIMENSION,
      MAX_DIMENSION
    );
    const outputName = getOutputName(inputFile.name);
    const variants = await Promise.all(
      EXPORT_VARIANTS.map(async (variant) => {
        const resizedVariant = await generateWebpExport(
          inputBuffer,
          variant.maxWidth
        );

        return {
          label: variant.label,
          outputName: getVariantOutputName(inputFile.name, variant.label),
          compressedSize: resizedVariant.size,
          width: resizedVariant.width,
          height: resizedVariant.height,
          mimeType: "image/webp",
          base64: resizedVariant.buffer.toString("base64"),
        };
      })
    );

    const response: CompressionResponse = {
      originalName: inputFile.name,
      outputName,
      originalSize: inputFile.size,
      compressedSize: mainExport.size,
      savedPercent: getSavedPercent(inputFile.size, mainExport.size),
      mimeType: "image/webp",
      base64: mainExport.buffer.toString("base64"),
      width: mainExport.width,
      height: mainExport.height,
      variants,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Image compression failed.", error);
    return createError("Failed to process image.", 500);
  }
}
