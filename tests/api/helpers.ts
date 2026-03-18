import sharp from "sharp";

export async function createApiPngFile(
  name: string,
  width = 200,
  height = 200
) {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 80, g: 155, b: 255, alpha: 1 },
    },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();

  return new File([buffer], name, { type: "image/png" });
}

export async function createApiJpgFile(
  name: string,
  width = 260,
  height = 180
) {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 220, g: 170, b: 120 },
    },
  })
    .jpeg({ quality: 92 })
    .toBuffer();

  return new File([buffer], name, { type: "image/jpeg" });
}

export function createApiTextFile(name: string, contents = "not an image") {
  return new File([Buffer.from(contents, "utf8")], name, {
    type: "text/plain",
  });
}
