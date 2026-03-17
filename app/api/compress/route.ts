import { NextRequest, NextResponse } from "next/server";
import {
  EMPTY_UPLOAD_MESSAGE,
  getUploadValidationError,
  MAX_FILES_PER_UPLOAD,
  TOO_MANY_FILES_MESSAGE,
} from "@/lib/upload-rules";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const MAX_DIMENSION = 2560;
const JXL_MIME_TYPE = "image/jxl";
const DJXL_BINARY = "/opt/homebrew/bin/djxl";
const EXPORT_VARIANTS = [
  { label: "large", maxWidth: 1200 },
  { label: "medium", maxWidth: 800 },
  { label: "small", maxWidth: 400 },
] as const;
const execFileAsync = promisify(execFile);

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

type FormatExportResponse = {
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
  formatExports: FormatExportResponse[];
  formatMessage?: string;
};

function createError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getOutputExtension(fileName: string, mimeType: string) {
  const lowerFileName = fileName.toLowerCase();

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  if (mimeType === JXL_MIME_TYPE) {
    return ".jxl";
  }

  if (lowerFileName.endsWith(".jpeg")) {
    return ".jpeg";
  }

  return ".jpg";
}

function getFormattedOutputName(
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

function getSavedPercent(originalSize: number, compressedSize: number) {
  if (originalSize <= 0) {
    return 0;
  }

  const saved = ((originalSize - compressedSize) / originalSize) * 100;
  return Number(Math.max(0, saved).toFixed(2));
}

function normalizeMimeType(mimeType: string) {
  if (mimeType === "image/jpg") {
    return "image/jpeg";
  }

  return mimeType;
}

function isJxlUpload(fileName: string, mimeType: string) {
  return (
    normalizeMimeType(mimeType) === JXL_MIME_TYPE ||
    fileName.toLowerCase().endsWith(".jxl")
  );
}

function getAlternativeMimeTypes(mimeType: string, jxlSupported: boolean) {
  const options = ["image/png", "image/webp"];

  if (jxlSupported) {
    options.unshift(JXL_MIME_TYPE);
  }

  return options.filter((option) => option !== mimeType);
}

let jxlSupportPromise: Promise<boolean> | undefined;

async function supportsJxl() {
  if (!jxlSupportPromise) {
    jxlSupportPromise = sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: "#ffffff",
      },
    })
      .jxl({ lossless: true })
      .toBuffer()
      .then(() => true)
      .catch(() => false);
  }

  return jxlSupportPromise;
}

async function ensureDjxlAvailable() {
  try {
    await fs.access(DJXL_BINARY);
    return true;
  } catch {
    return false;
  }
}

function getTransformerForFormat(
  image: sharp.Sharp,
  mimeType: string
) {
  if (mimeType === "image/png") {
    return image.png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    });
  }

  if (mimeType === "image/jpeg") {
    return image.jpeg({
      quality: 100,
      progressive: true,
    });
  }

  if (mimeType === JXL_MIME_TYPE) {
    return image.jxl({
      lossless: true,
    });
  }

  return image.webp({
    lossless: true,
  });
}

async function generateCompressedExport(
  inputBuffer: Buffer,
  mimeType: string,
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

  const { data, info } = await getTransformerForFormat(
    image,
    normalizeMimeType(mimeType)
  ).toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    size: info.size,
  };
}

async function convertJxlWithCli(
  inputBuffer: Buffer,
  outputExtension: ".png" | ".jpg"
) {
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "pixelpress-jxl-")
  );
  const inputPath = path.join(tempDirectory, "input.jxl");
  const outputPath = path.join(tempDirectory, `output${outputExtension}`);

  try {
    await fs.writeFile(inputPath, inputBuffer);
    await execFileAsync(DJXL_BINARY, [inputPath, outputPath]);
    const buffer = await fs.readFile(outputPath);
    return buffer;
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
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
    const inputIsJxl = isJxlUpload(inputFile.name, inputFile.type);

    if (inputIsJxl) {
      const djxlAvailable = await ensureDjxlAvailable();

      if (!djxlAvailable) {
        return createError(
          "JXL conversion is not available on this server right now.",
          500
        );
      }

      const pngBuffer = await convertJxlWithCli(inputBuffer, ".png");
      const jpgBuffer = await convertJxlWithCli(inputBuffer, ".jpg");
      const pngExport = await generateCompressedExport(
        pngBuffer,
        "image/png",
        MAX_DIMENSION,
        MAX_DIMENSION
      );
      const jpgExport = await generateCompressedExport(
        jpgBuffer,
        "image/jpeg",
        MAX_DIMENSION,
        MAX_DIMENSION
      );
      const variants = await Promise.all(
        EXPORT_VARIANTS.map(async (variant) => {
          const resizedVariant = await generateCompressedExport(
            pngBuffer,
            "image/png",
            variant.maxWidth
          );

          return {
            label: variant.label,
            outputName: getFormattedOutputName(inputFile.name, "image/png", variant.label),
            compressedSize: resizedVariant.size,
            width: resizedVariant.width,
            height: resizedVariant.height,
            mimeType: "image/png",
            base64: resizedVariant.buffer.toString("base64"),
          };
        })
      );

      const response: CompressionResponse = {
        originalName: inputFile.name,
        outputName: getFormattedOutputName(inputFile.name, "image/png"),
        originalSize: inputFile.size,
        compressedSize: pngExport.size,
        savedPercent: getSavedPercent(inputFile.size, pngExport.size),
        mimeType: "image/png",
        base64: pngExport.buffer.toString("base64"),
        width: pngExport.width,
        height: pngExport.height,
        variants,
        formatExports: [
          {
            label: "JPG",
            outputName: getFormattedOutputName(inputFile.name, "image/jpeg"),
            compressedSize: jpgExport.size,
            width: jpgExport.width,
            height: jpgExport.height,
            mimeType: "image/jpeg",
            base64: jpgExport.buffer.toString("base64"),
          },
        ],
        formatMessage:
          "JXL uploads are decoded with djxl and can be downloaded as PNG or JPG.",
      };

      return NextResponse.json(response);
    }

    const outputMimeType = normalizeMimeType(inputFile.type);
    const jxlSupported = await supportsJxl();
    const mainExport = await generateCompressedExport(
      inputBuffer,
      outputMimeType,
      MAX_DIMENSION,
      MAX_DIMENSION
    );
    const outputName = getFormattedOutputName(inputFile.name, outputMimeType);
    const formatExports = await Promise.all(
      getAlternativeMimeTypes(outputMimeType, jxlSupported).map(
        async (formatMimeType) => {
          const alternativeExport = await generateCompressedExport(
            inputBuffer,
            formatMimeType,
            MAX_DIMENSION,
            MAX_DIMENSION
          );

          return {
            label:
              formatMimeType === JXL_MIME_TYPE
                ? "JPEG-XL"
                : formatMimeType === "image/webp"
                  ? "WebP"
                  : "PNG",
            outputName: getFormattedOutputName(inputFile.name, formatMimeType),
            compressedSize: alternativeExport.size,
            width: alternativeExport.width,
            height: alternativeExport.height,
            mimeType: formatMimeType,
            base64: alternativeExport.buffer.toString("base64"),
          };
        }
      )
    );
    const variants = await Promise.all(
      EXPORT_VARIANTS.map(async (variant) => {
        const resizedVariant = await generateCompressedExport(
          inputBuffer,
          outputMimeType,
          variant.maxWidth
        );

        return {
          label: variant.label,
          outputName: getFormattedOutputName(
            inputFile.name,
            outputMimeType,
            variant.label
          ),
          compressedSize: resizedVariant.size,
          width: resizedVariant.width,
          height: resizedVariant.height,
          mimeType: outputMimeType,
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
      mimeType: outputMimeType,
      base64: mainExport.buffer.toString("base64"),
      width: mainExport.width,
      height: mainExport.height,
      variants,
      formatExports,
      formatMessage: jxlSupported
        ? "JPEG-XL is available for download, along with WebP and PNG."
        : "JPEG-XL is not available in this environment yet. WebP and PNG are ready instead.",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Image compression failed.", error);
    return createError("Failed to process image.", 500);
  }
}
