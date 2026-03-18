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

## Notify email storage

Notify emails are now stored in Supabase instead of local JSON files so production signups are durable on Vercel.

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Recommended table:

Run the schema in:

- `/Users/v188/Documents/tumvp/supabase/notify_emails.sql`

Local setup:

- open the Supabase SQL Editor
- paste the contents of `/Users/v188/Documents/tumvp/supabase/notify_emails.sql`
- run it to create the table
- add the environment variables to `.env.local`
- restart the Next.js dev server

Vercel setup:

- add `NEXT_PUBLIC_SUPABASE_URL`
- add `SUPABASE_SERVICE_ROLE_KEY`
- redeploy

Notes:

- writes happen only on the server via the service role key
- the frontend still posts to `/api/notify`
- duplicate emails are normalized to lowercase and treated as a successful no-op for UX

Optional local binaries for stronger compression:

```bash
brew install exiftool jpegoptim optipng pngcrush webp libavif
```

Linux example:

```bash
sudo apt-get install libimage-exiftool-perl jpegoptim optipng pngcrush webp libavif-bin
```

## Testing

### Overview

The automated test stack now covers four layers:

- **Unit tests** for compression helpers, routing logic, notify validation, duplicates, filename handling, and preview recommendation logic
- **API integration tests** for `POST /api/compress` and `POST /api/notify`
- **Local Playwright E2E** against a locally started Next.js app
- **Production smoke tests** against the live site at [https://tutool1.vercel.app](https://tutool1.vercel.app)

This setup is now fully active on GitHub Actions and is meant to reduce reliance on manual testing.

Run unit tests:

```bash
npm run test:unit
```

Run API integration tests:

```bash
npm run test:api
```

Run local Playwright E2E tests:

```bash
npm run test:e2e
```

Run Playwright in UI mode:

```bash
npm run test:e2e:ui
```

Run production smoke tests against the live site:

```bash
npm run test:smoke:prod
```

Run the full local validation stack:

```bash
npm run test:all
```

Open the Playwright HTML report after a run:

```bash
npx playwright show-report
```

### GitHub Actions

Automated testing is now active on GitHub.

Current workflows:

- **CI Tests**
  - runs automatically on `push`
  - runs automatically on `pull_request`
  - covers unit tests, API integration tests, build, and local Playwright E2E
- **Production Smoke Tests**
  - runs on `workflow_dispatch`
  - runs daily on a schedule
  - validates the live production site

How to trigger:

- CI runs automatically whenever matching changes are pushed or opened in a pull request
- Production smoke can be triggered manually from the GitHub Actions UI
- Production smoke also runs automatically on its daily schedule

### Reports and artifacts

Both workflows generate and upload test artifacts:

- Playwright HTML report
- Playwright JSON report data
- screenshots on failure
- traces on retry/failure
- retained failure videos when applicable

Each workflow also writes a GitHub Actions summary with:

- total tests
- passed
- failed
- skipped
- key failing scenarios

### Practical maintenance note

This automated setup already proved useful during activation:

- the first production smoke run caught a real smoke-test issue
- the issue was a result-selection bug in the test flow, not a product regression
- the test was fixed and rerun successfully

That is a good sign that the current stack is doing its job: it can catch real workflow issues early and give enough artifacts to debug them quickly.

### Current non-blocking warning

GitHub Actions still shows a non-blocking warning for:

- `actions/upload-artifact@v5`

The warning is about GitHub’s Node.js 20 deprecation path for JavaScript actions. It does **not** currently block CI or production smoke runs, and both workflows are passing. We can revisit this later when GitHub or the action maintainers ship the next fully compatible runtime update.

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

## Deployment notes

- The current app is ready to deploy on Vercel with Sharp-only fallbacks.
- External binaries are optional and usually unavailable in Vercel serverless functions.
- For heavier compression workloads or higher traffic, move the compression layer into a worker or container service and return object-storage URLs instead of large base64 payloads.
- After pushing to GitHub, let Vercel redeploy and then verify:
  - default upload returns `WebP`
  - explicit `PNG` / `JPG` / `WebP` requests stay in the selected format
  - explicit `AVIF` returns `AVIF` when supported or `WebP` with a clear fallback note otherwise
