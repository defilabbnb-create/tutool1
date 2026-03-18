# PixelPress

Minimal image compression web app built with Next.js, TypeScript, and the App Router.

## Local development

```bash
nvm use 22
npm install
npm run dev
```

Open `http://localhost:3000`.

## Testing

Run unit tests:

```bash
npm run test:unit
```

Run Playwright E2E tests:

```bash
npx playwright test
```

Run the local-only WebP flow test against a dev server:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/upload-workflow.spec.ts
```

## Production validation

The production site is deployed at [https://tutool1.vercel.app](https://tutool1.vercel.app).

Verified production behavior:

- Default `PNG` uploads stay in `PNG` format.
- Sending `format=webp` returns a `WebP` image with a `.webp` download name.
- Non-image files are rejected with a friendly error:
  - `Only PNG, JPG, and WebP images are supported.`

## Production fallback behavior

The app is designed to use external lossless optimization tools when they are available:

- `ExifTool`
- `JPEGoptim`
- `OptiPNG`
- `pngcrush`
- `cwebp`

On Vercel, these binaries are typically not available. In that environment the app falls back to built-in `sharp` processing:

- `PNG` uses a lossless Sharp fallback when external PNG tools are unavailable.
- `WebP` output falls back to Sharp lossless WebP when `cwebp` is unavailable.
- `JPG` stays in its original format if safe external lossless JPEG tooling is unavailable.

This keeps production uploads working reliably without breaking the current frontend flow.

## CI

GitHub Actions runs two Playwright checks:

- local E2E validation against a local Next.js server
- production WebP API validation against the live Vercel deployment after Vercel reports the deployment complete
