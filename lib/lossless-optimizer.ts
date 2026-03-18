import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

const TOOL_BINARIES = {
  exiftool: process.env.EXIFTOOL_BINARY || "exiftool",
  jpegoptim: process.env.JPEGOPTIM_BINARY || "jpegoptim",
  jpegtran: process.env.JPEGTRAN_BINARY || "jpegtran",
  optipng: process.env.OPTIPNG_BINARY || "optipng",
  pngcrush: process.env.PNGCRUSH_BINARY || "pngcrush",
  pngout: process.env.PNGOUT_BINARY || "pngout",
  pngquant: process.env.PNGQUANT_BINARY || "pngquant",
  cwebp: process.env.CWEBP_BINARY || "cwebp",
  avifenc: process.env.AVIFENC_BINARY || "avifenc",
} as const;

const ENABLE_PNGQUANT_NEAR_LOSSLESS =
  process.env.ENABLE_PNGQUANT_NEAR_LOSSLESS === "true";

type ToolName = keyof typeof TOOL_BINARIES;
export type OutputFormat = "png" | "jpeg" | "webp" | "avif";
export type InputMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/avif";

type OptimizationCandidate = {
  buffer: Buffer;
  size: number;
  width: number;
  height: number;
  toolchain: string[];
};

export type LosslessOptimizationResult = {
  buffer: Buffer;
  size: number;
  width: number;
  height: number;
  toolchain: string[];
  message: string;
};

export type WebpConversionResult = {
  buffer: Buffer;
  size: number;
  width: number;
  height: number;
  toolchain: string[];
  message: string;
};

export type GenericCompressionResult = {
  buffer: Buffer;
  size: number;
  width: number;
  height: number;
  mimeType: InputMimeType;
  methodUsed: string;
  message: string;
  usedOriginal: boolean;
};

export type LossyPreviewOption = {
  quality: 80 | 60 | 50;
  buffer: Buffer;
  size: number;
  width: number;
  height: number;
  mimeType: "image/webp" | "image/avif";
  methodUsed: string;
  message: string;
  isRecommended: boolean;
};

export type CompressionCapabilities = {
  binaries: Record<ToolName, boolean>;
  sharp: {
    webp: boolean;
    avif: boolean;
  };
};

const LOSSY_PREVIEW_QUALITIES = [80, 60, 50] as const;
const LOSSY_SUGGESTION_THRESHOLD_BYTES = 500 * 1024;

let toolAvailabilityPromise: Promise<Record<ToolName, boolean>> | undefined;
let sharpCapabilitiesPromise: Promise<CompressionCapabilities["sharp"]> | undefined;

async function detectToolAvailability() {
  if (!toolAvailabilityPromise) {
    toolAvailabilityPromise = Promise.all(
      Object.entries(TOOL_BINARIES).map(async ([tool, binary]) => {
        try {
          await execFileAsync("which", [binary]);
          return [tool as ToolName, true] as const;
        } catch {
          return [tool as ToolName, false] as const;
        }
      })
    ).then((entries) => Object.fromEntries(entries) as Record<ToolName, boolean>);
  }

  return toolAvailabilityPromise;
}

async function detectSharpCapabilities() {
  if (!sharpCapabilitiesPromise) {
    sharpCapabilitiesPromise = Promise.all([
      sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: "#fff",
        },
      })
        .webp({ lossless: true })
        .toBuffer()
        .then(() => true)
        .catch(() => false),
      sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: "#fff",
        },
      })
        .avif({ lossless: true })
        .toBuffer()
        .then(() => true)
        .catch(() => false),
    ]).then(([webp, avif]) => ({ webp, avif }));
  }

  return sharpCapabilitiesPromise;
}

export async function getCompressionCapabilities() {
  const [binaries, sharp] = await Promise.all([
    detectToolAvailability(),
    detectSharpCapabilities(),
  ]);

  return {
    binaries,
    sharp,
  } satisfies CompressionCapabilities;
}

async function cloneFile(sourcePath: string, targetPath: string) {
  await fs.copyFile(sourcePath, targetPath);
  return targetPath;
}

async function runTool(binary: string, args: string[]) {
  await execFileAsync(binary, args);
}

async function safelyReadCandidate(
  filePath: string,
  expectedFormat: "jpeg" | "png" | "webp" | "avif",
  toolchain: string[]
) {
  try {
    return await readCandidate(filePath, expectedFormat, toolchain);
  } catch {
    return null;
  }
}

async function createTempWorkspace(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function readCandidate(
  filePath: string,
  expectedFormat: "jpeg" | "png" | "webp" | "avif",
  toolchain: string[]
) {
  const buffer = await fs.readFile(filePath);
  const metadata = await sharp(buffer, { failOn: "error" }).metadata();

  if (
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height
  ) {
    return null;
  }

  return {
    buffer,
    size: buffer.byteLength,
    width: metadata.width,
    height: metadata.height,
    toolchain,
  } satisfies OptimizationCandidate;
}

export function pickSmallestCandidate<T extends { size: number }>(
  candidates: T[]
) {
  return [...candidates].sort((left, right) => left.size - right.size)[0];
}

export function mimeTypeToOutputFormat(mimeType: InputMimeType): OutputFormat {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  if (mimeType === "image/avif") {
    return "avif";
  }

  return "jpeg";
}

export function outputFormatToMimeType(outputFormat: OutputFormat): InputMimeType {
  if (outputFormat === "png") {
    return "image/png";
  }

  if (outputFormat === "webp") {
    return "image/webp";
  }

  if (outputFormat === "avif") {
    return "image/avif";
  }

  return "image/jpeg";
}

function getQualityMethodLabel(outputFormat: "webp" | "avif", quality: number) {
  return `sharp-${outputFormat}-q${quality}`;
}

function chooseRecommendedLossyQuality(
  originalSize: number,
  candidates: Array<{ quality: 80 | 60 | 50; size: number }>
) {
  const byQuality = new Map(candidates.map((candidate) => [candidate.quality, candidate]));
  const q80 = byQuality.get(80);
  const q60 = byQuality.get(60);
  const q50 = byQuality.get(50);

  if (originalSize <= LOSSY_SUGGESTION_THRESHOLD_BYTES) {
    return q80?.quality ?? candidates[0]?.quality ?? 80;
  }

  if (q80 && q80.size <= originalSize * 0.75) {
    return q80.quality;
  }

  if (q60 && q60.size <= originalSize * 0.6) {
    return q60.quality;
  }

  if (q80) {
    return q80.quality;
  }

  if (q60) {
    return q60.quality;
  }

  return q50?.quality ?? 80;
}

async function prepareSourceBuffer(
  buffer: Buffer,
  inputMimeType: InputMimeType,
  maxDimension: number
) {
  const metadata = await sharp(buffer, { failOn: "error" }).metadata();
  const needsResize =
    Boolean(metadata.width && metadata.width > maxDimension) ||
    Boolean(metadata.height && metadata.height > maxDimension);

  if (!needsResize) {
    return {
      buffer,
      mimeType: inputMimeType,
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
    };
  }

  const transformer = sharp(buffer, { failOn: "error" }).rotate().resize({
    width: maxDimension,
    height: maxDimension,
    fit: "inside",
    withoutEnlargement: true,
  });

  const outputFormat = mimeTypeToOutputFormat(inputMimeType);
  const { data, info } =
    outputFormat === "png"
      ? await transformer
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toBuffer({ resolveWithObject: true })
      : outputFormat === "jpeg"
        ? await transformer
            .jpeg({ quality: 100, progressive: true })
            .toBuffer({ resolveWithObject: true })
        : outputFormat === "avif"
          ? await transformer
              .avif({ lossless: true, effort: 6 })
              .toBuffer({ resolveWithObject: true })
          : await transformer
              .webp({ lossless: true })
              .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    mimeType: inputMimeType,
    width: info.width,
    height: info.height,
  };
}

export async function createSharpPngFallback(buffer: Buffer) {
  const { data, info } = await sharp(buffer, { failOn: "error" })
    .rotate()
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    size: info.size,
    width: info.width,
    height: info.height,
    toolchain: ["sharp-fallback"],
  } satisfies OptimizationCandidate;
}

async function buildJpegCandidates(
  inputPath: string,
  availability: Record<ToolName, boolean>
) {
  const candidates: OptimizationCandidate[] = [];
  const strippedPath = `${inputPath}.stripped.jpg`;

  await cloneFile(inputPath, strippedPath);

  if (availability.exiftool) {
    try {
      await runTool(TOOL_BINARIES.exiftool, ["-all=", "-overwrite_original", strippedPath]);
      const strippedCandidate = await safelyReadCandidate(strippedPath, "jpeg", ["exiftool"]);
      if (strippedCandidate) {
        candidates.push(strippedCandidate);
      }
    } catch {
      // Ignore tool failures and continue with the next candidate.
    }
  }

  if (availability.jpegoptim) {
    try {
      const jpegoptimPath = `${inputPath}.jpegoptim.jpg`;
      await cloneFile(strippedPath, jpegoptimPath);
      await runTool(TOOL_BINARIES.jpegoptim, [
        "--strip-all",
        "--all-progressive",
        "--preserve",
        jpegoptimPath,
      ]);
      const jpegoptimCandidate = await safelyReadCandidate(jpegoptimPath, "jpeg", [
        ...(availability.exiftool ? ["exiftool"] : []),
        "jpegoptim",
      ]);
      if (jpegoptimCandidate) {
        candidates.push(jpegoptimCandidate);
      }
    } catch {
      // Ignore tool failures and continue with the next candidate.
    }
  }

  if (availability.jpegtran) {
    try {
      const jpegtranPath = `${inputPath}.jpegtran.jpg`;
      await runTool(TOOL_BINARIES.jpegtran, [
        "-copy",
        "none",
        "-optimize",
        "-progressive",
        "-outfile",
        jpegtranPath,
        strippedPath,
      ]);
      const jpegtranCandidate = await safelyReadCandidate(jpegtranPath, "jpeg", [
        ...(availability.exiftool ? ["exiftool"] : []),
        "jpegtran",
      ]);
      if (jpegtranCandidate) {
        candidates.push(jpegtranCandidate);
      }
    } catch {
      // Ignore tool failures and continue with the next candidate.
    }
  }

  return candidates;
}

async function buildPngCandidates(
  inputPath: string,
  availability: Record<ToolName, boolean>
) {
  const candidates: OptimizationCandidate[] = [];
  const strippedPath = `${inputPath}.stripped.png`;

  await cloneFile(inputPath, strippedPath);

  if (availability.exiftool) {
    try {
      await runTool(TOOL_BINARIES.exiftool, ["-all=", "-overwrite_original", strippedPath]);
      const strippedCandidate = await safelyReadCandidate(strippedPath, "png", ["exiftool"]);
      if (strippedCandidate) {
        candidates.push(strippedCandidate);
      }
    } catch {
      // Ignore tool failures and continue with the next candidate.
    }
  }

  if (availability.optipng) {
    try {
      const optipngPath = `${inputPath}.optipng.png`;
      await cloneFile(strippedPath, optipngPath);
      await runTool(TOOL_BINARIES.optipng, ["-o7", optipngPath]);
      const optipngCandidate = await safelyReadCandidate(optipngPath, "png", [
        ...(availability.exiftool ? ["exiftool"] : []),
        "optipng",
      ]);
      if (optipngCandidate) {
        candidates.push(optipngCandidate);
      }
    } catch {
      // Ignore tool failures and continue with the next candidate.
    }
  }

  if (availability.pngcrush) {
    try {
      const pngcrushPath = `${inputPath}.pngcrush.png`;
      await runTool(TOOL_BINARIES.pngcrush, [
        "-q",
        "-rem",
        "alla",
        "-reduce",
        "-brute",
        strippedPath,
        pngcrushPath,
      ]);
      const pngcrushCandidate = await safelyReadCandidate(pngcrushPath, "png", [
        ...(availability.exiftool ? ["exiftool"] : []),
        "pngcrush",
      ]);
      if (pngcrushCandidate) {
        candidates.push(pngcrushCandidate);
      }
    } catch {
      // Ignore tool failures and continue with the next candidate.
    }
  }

  if (availability.pngout) {
    try {
      const pngoutPath = `${inputPath}.pngout.png`;
      await runTool(TOOL_BINARIES.pngout, [strippedPath, pngoutPath, "/y", "/q"]);
      const pngoutCandidate = await safelyReadCandidate(pngoutPath, "png", [
        ...(availability.exiftool ? ["exiftool"] : []),
        "pngout",
      ]);
      if (pngoutCandidate) {
        candidates.push(pngoutCandidate);
      }
    } catch {
      // Ignore tool failures and continue with the next candidate.
    }
  }

  if (availability.pngquant && ENABLE_PNGQUANT_NEAR_LOSSLESS) {
    try {
      const pngquantPath = `${inputPath}.pngquant.png`;
      await runTool(TOOL_BINARIES.pngquant, [
        "--quality=98-100",
        "--speed",
        "1",
        "--force",
        "--output",
        pngquantPath,
        strippedPath,
      ]);
      const pngquantCandidate = await safelyReadCandidate(pngquantPath, "png", [
        ...(availability.exiftool ? ["exiftool"] : []),
        "pngquant",
      ]);
      if (pngquantCandidate) {
        candidates.push(pngquantCandidate);
      }
    } catch {
      // Ignore tool failures and continue with the next candidate.
    }
  }

  return candidates;
}

function createResultMessage(
  mimeType: "image/jpeg" | "image/png",
  selected: OptimizationCandidate,
  usedFallback: boolean
) {
  const formatLabel = mimeType === "image/jpeg" ? "JPG" : "PNG";

  if (usedFallback) {
    if (mimeType === "image/jpeg") {
      return `${formatLabel} lossless tooling is not available in this environment, so the original file is preserved to avoid quality loss.`;
    }

    return `${formatLabel} was optimized with the built-in fallback because external lossless tools are not available here.`;
  }

  return `${formatLabel} optimized with ${selected.toolchain.join(" → ")}. The smallest successful result is ready to download.`;
}

export async function optimizeLosslessRasterImage(params: {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png";
  fileName: string;
}) {
  const availability = await detectToolAvailability();
  const workspace = await createTempWorkspace("pixelpress-lossless-");
  const extension = params.mimeType === "image/jpeg" ? ".jpg" : ".png";
  const inputPath = path.join(workspace, `input${extension}`);

  try {
    await fs.writeFile(inputPath, params.buffer);

    const originalCandidate = await readCandidate(
      inputPath,
      params.mimeType === "image/jpeg" ? "jpeg" : "png",
      ["original"]
    );

    if (!originalCandidate) {
      return null;
    }

    let candidates = [originalCandidate];
    let usedFallback = false;

    if (params.mimeType === "image/jpeg") {
      const jpegCandidates = await buildJpegCandidates(inputPath, availability);
      candidates = candidates.concat(jpegCandidates);
    } else {
      const pngCandidates = await buildPngCandidates(inputPath, availability);
      candidates = candidates.concat(pngCandidates);

      if (pngCandidates.length === 0) {
        candidates.push(await createSharpPngFallback(params.buffer));
        usedFallback = true;
      }
    }

    const selected = pickSmallestCandidate(candidates);

    return {
      buffer: selected.buffer,
      size: selected.size,
      width: selected.width,
      height: selected.height,
      toolchain: selected.toolchain,
      message: createResultMessage(params.mimeType, selected, usedFallback),
    } satisfies LosslessOptimizationResult;
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

export async function createWebpExport(params: {
  buffer: Buffer;
  fileName: string;
}) {
  const availability = await detectToolAvailability();
  const workspace = await createTempWorkspace("pixelpress-webp-");
  const inputPath = path.join(workspace, path.basename(params.fileName));
  const outputPath = path.join(workspace, "output.webp");

  try {
    await fs.writeFile(inputPath, params.buffer);

    if (availability.cwebp) {
      await runTool(TOOL_BINARIES.cwebp, [
        "-lossless",
        "-q",
        "100",
        "-metadata",
        "none",
        inputPath,
        "-o",
        outputPath,
      ]);

      const candidate = await readCandidate(outputPath, "webp", ["cwebp"]).catch(
        () => null
      );

      if (candidate) {
        return {
          buffer: candidate.buffer,
          size: candidate.size,
          width: candidate.width,
          height: candidate.height,
          toolchain: candidate.toolchain,
          message: "WebP alternative generated with cwebp.",
        } satisfies WebpConversionResult;
      }
    }

    const { data, info } = await sharp(params.buffer, { failOn: "error" })
      .rotate()
      .webp({ lossless: true })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      size: info.size,
      width: info.width,
      height: info.height,
      toolchain: ["sharp-webp-fallback"],
      message: "WebP alternative generated with the built-in fallback.",
    } satisfies WebpConversionResult;
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

export async function createAvifExport(params: {
  buffer: Buffer;
  fileName: string;
}) {
  const capabilities = await getCompressionCapabilities();
  const workspace = await createTempWorkspace("pixelpress-avif-");
  const inputPath = path.join(workspace, path.basename(params.fileName));
  const sourcePngPath = path.join(workspace, "source.png");
  const outputPath = path.join(workspace, "output.avif");

  try {
    await fs.writeFile(inputPath, params.buffer);

    if (capabilities.binaries.avifenc) {
      try {
        await sharp(params.buffer, { failOn: "error" })
          .rotate()
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toFile(sourcePngPath);

        await runTool(TOOL_BINARIES.avifenc, [
          "--lossless",
          sourcePngPath,
          outputPath,
        ]);

        const candidate = await readCandidate(outputPath, "avif", ["avifenc"]).catch(
          () => null
        );

        if (candidate) {
          return {
            buffer: candidate.buffer,
            size: candidate.size,
            width: candidate.width,
            height: candidate.height,
            toolchain: candidate.toolchain,
            message: "AVIF output generated with avifenc.",
          };
        }
      } catch {
        // fall through to Sharp fallback
      }
    }

    if (!capabilities.sharp.avif) {
      return null;
    }

    const { data, info } = await sharp(params.buffer, { failOn: "error" })
      .rotate()
      .avif({ lossless: true, effort: 6 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      size: info.size,
      width: info.width,
      height: info.height,
      toolchain: ["sharp-avif-fallback"],
      message: "AVIF output generated with the built-in fallback.",
    };
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

export async function createLossyPreviewOptions(params: {
  buffer: Buffer;
  fileName: string;
  targetFormat: "webp" | "avif";
  originalSize: number;
}): Promise<LossyPreviewOption[]> {
  const capabilities = await getCompressionCapabilities();

  if (params.targetFormat === "avif" && !capabilities.sharp.avif) {
    return [];
  }

  if (params.targetFormat === "webp" && !capabilities.sharp.webp) {
    return [];
  }

  const candidates = (
    await Promise.all(
      LOSSY_PREVIEW_QUALITIES.map(async (quality) => {
        try {
      const pipeline = sharp(params.buffer, { failOn: "error" }).rotate();
      const { data, info } =
        params.targetFormat === "webp"
          ? await pipeline
              .webp({ quality, effort: 6 })
              .toBuffer({ resolveWithObject: true })
          : await pipeline
              .avif({ quality, effort: 6 })
              .toBuffer({ resolveWithObject: true });

      return {
        quality,
        buffer: data,
        size: info.size,
        width: info.width,
        height: info.height,
        mimeType:
          params.targetFormat === "webp" ? "image/webp" : "image/avif",
        methodUsed: getQualityMethodLabel(params.targetFormat, quality),
        message:
          quality === 80
            ? "Higher quality with lighter compression."
            : quality === 60
              ? "Balanced quality and file size."
              : "Smallest file with stronger compression.",
        isRecommended: false,
      } satisfies LossyPreviewOption;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as LossyPreviewOption[];

  if (candidates.length === 0) {
    return [];
  }

  const recommendedQuality = chooseRecommendedLossyQuality(
    params.originalSize,
    candidates
  );

  return candidates.map((candidate) => ({
    ...candidate,
    isRecommended: candidate.quality === recommendedQuality,
  }));
}

async function createSharpFormatFallback(
  buffer: Buffer,
  outputFormat: OutputFormat
) {
  const transformer = sharp(buffer, { failOn: "error" }).rotate();

  if (outputFormat === "png") {
    const result = await createSharpPngFallback(buffer);
    return {
      ...result,
      mimeType: "image/png",
      methodUsed: result.toolchain.join(" → "),
      message: "PNG optimized with the built-in fallback.",
      usedOriginal: false,
    } satisfies GenericCompressionResult;
  }

  if (outputFormat === "jpeg") {
    const { data, info } = await transformer
      .jpeg({ quality: 100, progressive: true })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: data,
      size: info.size,
      width: info.width,
      height: info.height,
      mimeType: "image/jpeg",
      methodUsed: "sharp-jpeg-fallback",
      message: "JPG output generated with the built-in fallback.",
      usedOriginal: false,
    } satisfies GenericCompressionResult;
  }

  if (outputFormat === "webp") {
    const result = await createWebpExport({ buffer, fileName: "fallback.webp" });
    return {
      buffer: result.buffer,
      size: result.size,
      width: result.width,
      height: result.height,
      mimeType: "image/webp",
      methodUsed: result.toolchain.join(" → "),
      message: result.message,
      usedOriginal: false,
    } satisfies GenericCompressionResult;
  }

  const avif = await createAvifExport({ buffer, fileName: "fallback.avif" });
  if (!avif) {
    return null;
  }

  return {
    buffer: avif.buffer,
    size: avif.size,
    width: avif.width,
    height: avif.height,
    mimeType: "image/avif",
    methodUsed: avif.toolchain.join(" → "),
    message: avif.message,
    usedOriginal: false,
  } satisfies GenericCompressionResult;
}

export async function compressWithStrategy(params: {
  inputBuffer: Buffer;
  inputMimeType: InputMimeType;
  targetFormat: OutputFormat;
  originalName: string;
  maxDimension: number;
}) {
  const prepared = await prepareSourceBuffer(
    params.inputBuffer,
    params.inputMimeType,
    params.maxDimension
  );
  const preparedBuffer = prepared.buffer;
  const targetMimeType = outputFormatToMimeType(params.targetFormat);

  if (params.targetFormat === "png") {
    const pngSource =
      params.inputMimeType === "image/png"
        ? preparedBuffer
        : await sharp(preparedBuffer, { failOn: "error" })
            .png({ compressionLevel: 9, adaptiveFiltering: true })
            .toBuffer();
    const optimized = await optimizeLosslessRasterImage({
      buffer: pngSource,
      mimeType: "image/png",
      fileName: params.originalName,
    });

    if (optimized) {
      return {
        buffer: optimized.buffer,
        size: optimized.size,
        width: optimized.width,
        height: optimized.height,
        mimeType: targetMimeType,
        methodUsed: optimized.toolchain.join(" → "),
        message: optimized.message,
        usedOriginal: optimized.toolchain.includes("original"),
      } satisfies GenericCompressionResult;
    }
  }

  if (params.targetFormat === "jpeg") {
    const jpegSource =
      params.inputMimeType === "image/jpeg"
        ? preparedBuffer
        : await sharp(preparedBuffer, { failOn: "error" })
            .jpeg({ quality: 100, progressive: true })
            .toBuffer();
    const optimized = await optimizeLosslessRasterImage({
      buffer: jpegSource,
      mimeType: "image/jpeg",
      fileName: params.originalName,
    });

    if (optimized) {
      return {
        buffer: optimized.buffer,
        size: optimized.size,
        width: optimized.width,
        height: optimized.height,
        mimeType: targetMimeType,
        methodUsed: optimized.toolchain.join(" → "),
        message: optimized.message,
        usedOriginal: optimized.toolchain.includes("original"),
      } satisfies GenericCompressionResult;
    }
  }

  if (params.targetFormat === "webp") {
    const webp = await createWebpExport({
      buffer: preparedBuffer,
      fileName: params.originalName,
    });

    return {
      buffer: webp.buffer,
      size: webp.size,
      width: webp.width,
      height: webp.height,
      mimeType: targetMimeType,
      methodUsed: webp.toolchain.join(" → "),
      message: webp.message,
      usedOriginal: false,
    } satisfies GenericCompressionResult;
  }

  if (params.targetFormat === "avif") {
    const avif = await createAvifExport({
      buffer: preparedBuffer,
      fileName: params.originalName,
    });

    if (avif) {
      return {
        buffer: avif.buffer,
        size: avif.size,
        width: avif.width,
        height: avif.height,
        mimeType: targetMimeType,
        methodUsed: avif.toolchain.join(" → "),
        message: avif.message,
        usedOriginal: false,
      } satisfies GenericCompressionResult;
    }

    const webpFallback = await createWebpExport({
      buffer: preparedBuffer,
      fileName: params.originalName,
    });

    return {
      buffer: webpFallback.buffer,
      size: webpFallback.size,
      width: webpFallback.width,
      height: webpFallback.height,
      mimeType: "image/webp",
      methodUsed: `${webpFallback.toolchain.join(" → ")} (avif-fallback)`,
      message:
        "AVIF is not safely available in this environment, so WebP was returned instead.",
      usedOriginal: false,
    } satisfies GenericCompressionResult;
  }

  const fallback = await createSharpFormatFallback(preparedBuffer, params.targetFormat);
  if (fallback) {
    return fallback;
  }

  const metadata = await sharp(preparedBuffer, { failOn: "error" }).metadata();
  return {
    buffer: preparedBuffer,
    size: preparedBuffer.byteLength,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    mimeType: params.inputMimeType,
    methodUsed: "original-preserved",
    message:
      "Requested format is not available in this environment, so the original file was returned.",
    usedOriginal: true,
  } satisfies GenericCompressionResult;
}
