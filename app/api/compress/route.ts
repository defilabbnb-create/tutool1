import { NextRequest, NextResponse } from "next/server";
import {
  EMPTY_UPLOAD_MESSAGE,
  getUploadValidationError,
  INVALID_IMAGE_CONTENT_MESSAGE,
  JXL_UPLOAD_ENABLED,
  MAX_FILES_PER_UPLOAD,
  OUTPUT_FORMAT_OPTIONS,
  OutputFormatOption,
  TOO_MANY_FILES_MESSAGE,
} from "@/lib/upload-rules";
import {
  compressWithStrategy,
  createLossyPreviewOptions,
  GenericCompressionResult,
  getCompressionCapabilities,
  LossyPreviewOption,
  outputFormatToMimeType,
} from "@/lib/lossless-optimizer";
import {
  getFormattedOutputName,
  getOutputExtension,
} from "@/lib/compress-route-utils";
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

type PreviewOptionResponse = {
  label: string;
  quality: number;
  outputName: string;
  compressedSize: number;
  savedPercent: number;
  width: number;
  height: number;
  mimeType: string;
  base64: string;
  methodUsed: string;
  isRecommended: boolean;
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
  methodUsed: string;
  variants: VariantResponse[];
  formatExports: FormatExportResponse[];
  previewOptions: PreviewOptionResponse[];
  formatMessage?: string;
};

function createError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isMultipartFormRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("multipart/form-data");
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

function getRequestedOutputFormat(value: FormDataEntryValue | null): OutputFormatOption {
  if (typeof value !== "string") {
    return "webp";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "jpg") {
    return "jpeg";
  }

  if (
    OUTPUT_FORMAT_OPTIONS.includes(normalized as OutputFormatOption)
  ) {
    return normalized as OutputFormatOption;
  }

  if (normalized === "true" || normalized === "1") {
    return "webp";
  }

  return "webp";
}

function shouldGenerateLossyPreviews(
  requestedFormat: OutputFormatOption,
  originalSize: number
): requestedFormat is "webp" | "avif" {
  return (
    originalSize > 0 &&
    (requestedFormat === "webp" || requestedFormat === "avif")
  );
}

function isJxlUpload(fileName: string, mimeType: string) {
  return (
    normalizeMimeType(mimeType) === JXL_MIME_TYPE ||
    fileName.toLowerCase().endsWith(".jxl")
  );
}

function getAlternativeMimeTypes(mimeType: string, jxlSupported: boolean) {
  const options = ["image/png", "image/jpeg", "image/webp", "image/avif"];

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

  if (mimeType === "image/avif") {
    return image.avif({
      lossless: true,
      effort: 6,
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

async function validateRasterImage(
  inputBuffer: Buffer,
  expectedMimeType: string
) {
  try {
    const metadata = await sharp(inputBuffer, { failOn: "error" }).metadata();

    if (!metadata.width || !metadata.height || !metadata.format) {
      return false;
    }

    if (expectedMimeType === "image/png") {
      return metadata.format === "png";
    }

    if (expectedMimeType === "image/webp") {
      return metadata.format === "webp";
    }

    if (expectedMimeType === "image/avif") {
      return metadata.format === "heif" || metadata.format === "avif";
    }

    if (expectedMimeType === "image/jpeg") {
      return metadata.format === "jpeg";
    }

    return false;
  } catch {
    return false;
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

    if (!isMultipartFormRequest(request)) {
      return createError("Please upload a valid image file.");
    }

    console.info("Compression request started", {
      clientIdentifier,
    });

    const formData = await request.formData();
    const requestedFormat = getRequestedOutputFormat(formData.get("format"));
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

    if (inputBuffer.length === 0) {
      return createError(EMPTY_UPLOAD_MESSAGE);
    }
    const inputIsJxl =
      JXL_UPLOAD_ENABLED && isJxlUpload(inputFile.name, inputFile.type);

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
      const pngIsValid = await validateRasterImage(pngBuffer, "image/png");
      const jpgIsValid = await validateRasterImage(jpgBuffer, "image/jpeg");

      if (!pngIsValid || !jpgIsValid) {
        return createError(INVALID_IMAGE_CONTENT_MESSAGE);
      }

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
        methodUsed: "djxl → sharp-png",
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
        previewOptions: [],
        formatMessage:
          "JXL uploads are decoded with djxl and can be downloaded as PNG or JPG.",
      };

      return NextResponse.json(response);
    }

    const outputMimeType = normalizeMimeType(inputFile.type) as
      | "image/png"
      | "image/jpeg"
      | "image/webp"
      | "image/avif";
    const isValidImage = await validateRasterImage(inputBuffer, outputMimeType);

    if (!isValidImage) {
      return createError(INVALID_IMAGE_CONTENT_MESSAGE);
    }

    const jxlSupported = await supportsJxl();
    const capabilities = await getCompressionCapabilities();
    const mainExport = await compressWithStrategy({
      inputBuffer,
      inputMimeType: outputMimeType,
      targetFormat: requestedFormat,
      originalName: inputFile.name,
      maxDimension: MAX_DIMENSION,
    });
    const previewOptions: LossyPreviewOption[] =
      shouldGenerateLossyPreviews(requestedFormat, inputFile.size)
        ? await createLossyPreviewOptions({
            buffer: inputBuffer,
            fileName: inputFile.name,
            targetFormat: requestedFormat,
            originalSize: inputFile.size,
          })
        : [];
    const recommendedPreview = previewOptions.find((option) => option.isRecommended);
    const responseBaseExport: GenericCompressionResult = recommendedPreview
        ? {
            buffer: recommendedPreview.buffer,
            size: recommendedPreview.size,
            width: recommendedPreview.width,
            height: recommendedPreview.height,
            mimeType: recommendedPreview.mimeType,
            methodUsed: recommendedPreview.methodUsed,
            message:
              inputFile.size > 500 * 1024
                ? `Large image detected, so ${requestedFormat.toUpperCase()} preview qualities 80, 60, and 50 were compared and the recommended tradeoff was selected.`
                : `Preview qualities 80, 60, and 50 were compared and the recommended tradeoff was selected.`,
            usedOriginal: false,
          }
      : mainExport;
    const responseMimeType = responseBaseExport.mimeType;
    const responseOutputName = getFormattedOutputName(inputFile.name, responseMimeType);
    const formatExports = await Promise.all(
      getAlternativeMimeTypes(responseMimeType, jxlSupported)
        .filter((formatMimeType) => {
          if (formatMimeType === JXL_MIME_TYPE) {
            return false;
          }

          const candidateFormatMime = formatMimeType;
          return candidateFormatMime !== responseMimeType;
        })
        .map(
        async (formatMimeType) => {
          const formatMime =
            formatMimeType === "image/png"
              ? "png"
              : formatMimeType === "image/jpeg"
                ? "jpeg"
                : formatMimeType === "image/avif"
                  ? "avif"
                  : "webp";
          const alternativeExport = await compressWithStrategy({
            inputBuffer,
            inputMimeType: outputMimeType,
            targetFormat: formatMime,
            originalName: inputFile.name,
            maxDimension: MAX_DIMENSION,
          });

          return {
            label:
              formatMimeType === JXL_MIME_TYPE
                ? "JPEG-XL"
                : formatMimeType === "image/avif"
                  ? "AVIF"
                : formatMimeType === "image/webp"
                  ? "WebP"
                  : formatMimeType === "image/jpeg"
                    ? "JPG"
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
          outputFormatToMimeType(requestedFormat),
          variant.maxWidth
        );

        return {
          label: variant.label,
          outputName: getFormattedOutputName(
            inputFile.name,
            outputFormatToMimeType(requestedFormat),
            variant.label
          ),
          compressedSize: resizedVariant.size,
          width: resizedVariant.width,
          height: resizedVariant.height,
          mimeType: outputFormatToMimeType(requestedFormat),
          base64: resizedVariant.buffer.toString("base64"),
        };
      })
    );

    const response: CompressionResponse = {
      originalName: inputFile.name,
      outputName: responseOutputName,
      originalSize: inputFile.size,
      compressedSize: responseBaseExport.size,
      savedPercent: getSavedPercent(inputFile.size, responseBaseExport.size),
      mimeType: responseMimeType,
      base64: responseBaseExport.buffer.toString("base64"),
      width: responseBaseExport.width,
      height: responseBaseExport.height,
      methodUsed: responseBaseExport.methodUsed,
      variants,
      formatExports,
      previewOptions: previewOptions.map((option) => ({
        label: `Quality ${option.quality}`,
        quality: option.quality,
        outputName: getFormattedOutputName(inputFile.name, option.mimeType, `q${option.quality}`),
        compressedSize: option.size,
        savedPercent: getSavedPercent(inputFile.size, option.size),
        width: option.width,
        height: option.height,
        mimeType: option.mimeType,
        base64: option.buffer.toString("base64"),
        methodUsed: option.methodUsed,
        isRecommended: option.isRecommended,
      })),
      formatMessage: [
        responseBaseExport.message,
        previewOptions.length > 0
          ? inputFile.size > 500 * 1024
            ? "Large image detected: preview qualities 80, 60, and 50 are shown so you can compare size and clarity before downloading."
            : "Preview qualities 80, 60, and 50 are shown so you can compare size and clarity before downloading."
          : "",
        capabilities.binaries.cwebp || capabilities.binaries.avifenc
          ? "System binaries are available for part of the compression pipeline."
          : "System binaries are not available here, so built-in fallbacks are used when needed.",
        jxlSupported
          ? "JPEG-XL is available for download when supported."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    };

    console.info("Compression completed", {
      input: inputFile.name,
      inputMimeType: outputMimeType,
      requestedFormat,
      outputMimeType: responseMimeType,
      methodUsed: responseBaseExport.methodUsed,
      originalSize: inputFile.size,
      compressedSize: responseBaseExport.size,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Image compression failed.", error);
    return createError("Oops, something went wrong. Please try again later.", 500);
  }
}
