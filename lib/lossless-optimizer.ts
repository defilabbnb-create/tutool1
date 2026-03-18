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
} as const;

const ENABLE_PNGQUANT_NEAR_LOSSLESS =
  process.env.ENABLE_PNGQUANT_NEAR_LOSSLESS === "true";

type ToolName = keyof typeof TOOL_BINARIES;

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

let toolAvailabilityPromise: Promise<Record<ToolName, boolean>> | undefined;

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

async function cloneFile(sourcePath: string, targetPath: string) {
  await fs.copyFile(sourcePath, targetPath);
  return targetPath;
}

async function runTool(binary: string, args: string[]) {
  await execFileAsync(binary, args);
}

async function safelyReadCandidate(
  filePath: string,
  expectedFormat: "jpeg" | "png" | "webp",
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
  expectedFormat: "jpeg" | "png" | "webp",
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
