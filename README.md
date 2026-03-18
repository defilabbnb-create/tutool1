# PixelPress

Minimal image compression web app built with Next.js, TypeScript, and the App Router.

## Supported formats

- Uploads: `PNG`, `JPG`, `WebP`, `AVIF`
- Optional upload support: `JXL`
- Output selection: `PNG`, `JPG`, `WebP`, `AVIF`

The UI defaults to `WebP` because it usually gives the smallest files while staying broadly compatible.

For `WebP` and `AVIF`, the app now also generates preview downloads at quality `80`, `60`, and `50`, then recommends the best tradeoff automatically. Large uploads above `500KB` get an explicit preview note so users can compare size and clarity before downloading.

## Local development

```bash
nvm use 22
npm install
npm run dev
```

Open `http://localhost:3000`.

Optional local binaries for stronger compression:

```bash
brew install exiftool jpegoptim optipng pngcrush webp libavif
```

Linux example:

```bash
sudo apt-get install libimage-exiftool-perl jpegoptim optipng pngcrush webp libavif-bin
```

## Testing

Run unit tests:

```bash
npm run test:unit
```

Run Playwright E2E tests:

```bash
npx playwright test
```

Run the local format-selection E2E flow against a dev server:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/upload-workflow.spec.ts
```

## Production validation

The production site is deployed at [https://tutool1.vercel.app](https://tutool1.vercel.app).

Verified production behavior:

- Default uploads return `WebP`.
- Explicit `PNG`, `JPG`, `WebP`, and `AVIF` requests are honoured when the environment supports them.
- Non-image files are rejected with a friendly error.
- Responses include:
  - `outputName`
  - `mimeType`
  - `compressedSize`
  - `savedPercent`
  - `methodUsed`
  - `previewOptions` for lossy `WebP` / `AVIF` comparisons

## Production fallback behavior

The app is designed to use external tools when they are available:

- `ExifTool`
- `JPEGoptim`
- `OptiPNG`
- `pngcrush`
- `cwebp`
- `avifenc`

On Vercel, these binaries are typically not available. In that environment the app falls back to built-in `sharp` processing:

- `PNG` uses a lossless Sharp fallback when external PNG tools are unavailable.
- `JPG` uses Sharp fallback when external JPEG tooling is unavailable.
- `WebP` output falls back to Sharp WebP when `cwebp` is unavailable.
- `AVIF` output falls back to Sharp AVIF when `avifenc` is unavailable.
- If AVIF is not safely available at all, the API returns WebP instead and explains the fallback in the response.
- If a requested format cannot be produced, the original file is returned with `methodUsed: original-preserved`.

This keeps production uploads working reliably without breaking the current frontend flow.

## Compression strategy

- `PNG` target:
  - Prefer `ExifTool` + `OptiPNG` / `pngcrush`
  - Fall back to Sharp lossless PNG
- `JPG` target:
  - Prefer `ExifTool` + `JPEGoptim` / `jpegtran`
  - Fall back to Sharp JPEG output
- `WebP` target:
  - Prefer `cwebp`
  - Fall back to Sharp WebP
- `AVIF` target:
  - Prefer `avifenc`
  - Fall back to Sharp AVIF

For `WebP` and `AVIF`, the backend also:

- runs multiple preview qualities: `80`, `60`, and `50`
- recommends one option automatically based on original size and resulting file sizes
- uses that recommended option as the main downloadable result
- keeps the full preview set available in the UI for visual comparison

The API compares candidates when possible and reports the chosen method in the response.

## CI

GitHub Actions runs two Playwright checks:

- local E2E validation against a local Next.js server
- production format validation against the live Vercel deployment after Vercel reports the deployment complete

## Deployment notes

- The current app is ready to deploy on Vercel with Sharp-only fallbacks.
- External binaries are optional and usually unavailable in Vercel serverless functions.
- For heavier compression workloads or higher traffic, move the compression layer into a worker or container service and return object-storage URLs instead of large base64 payloads.
- After pushing to GitHub, let Vercel redeploy and then verify:
  - default upload returns `WebP`
  - explicit `PNG` / `JPG` / `WebP` requests stay in the selected format
  - explicit `AVIF` returns `AVIF` when supported or `WebP` with a clear fallback note otherwise
