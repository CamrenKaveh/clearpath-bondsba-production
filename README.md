# ClearPath / BondSBA

Production React + Vite app for:

- `bondsba.com`
- `clearpathsbaloan.com`

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

The build runs `scripts/generate-seo-pages.mjs` before Vite so static SEO pages are generated into `public/` and copied into `dist/`.

## Vercel Setup

Use this repository as the Vercel project root. Do not point Vercel at the parent home directory.

Recommended Vercel settings:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- Root Directory: `.`

Production environment variables are managed in Vercel. Do not commit `.env`, `.env.local`, or `.env.production.local`.
