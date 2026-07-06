# SaathiDesk Web App

SaathiDesk is a Next.js photo gallery and delivery app for photographers, studios, event teams, and private clients. It supports customer-branded subdomains, album and event organization, AI-assisted culling, person-aware search, share links, passcodes, watermarks, downloads, presets, and media delivery through S3.

## Documentation

Start with the docs index: [docs/README.md](docs/README.md).

| Audience | Primary guide |
| --- | --- |
| Customers and studio teams | [Customer Handbook](docs/customer/handbook.md) |
| Developers | [Developer Handbook](docs/developer/handbook.md) |
| AI agents | [Agent Handbook](docs/agents/handbook.md) |

Feature-specific guides live in `docs/` as well, including Google integrations, OpenRouter search, LUT presets, frontend data flow, and S3 video upload behavior.

## Stack

- Next.js 16 App Router and React 19.
- TypeScript, Tailwind CSS, and shadcn/Radix-style UI primitives.
- Supabase Auth for login sessions.
- PostgreSQL on RDS for albums, photos, people, shares, presets, and customers.
- AWS S3 for originals, generated previews, videos, and downloadable media.
- Resend for the contact form.

## Local Development

Install dependencies and run the dev server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Common checks:

```bash
pnpm lint
pnpm build
pnpm verify:google-photos-picker
```

`pnpm build` runs the Google Photos picker verification script before `next build`.

## Environment

Copy `.env.example` into your local environment and fill in the required values for the part of the app you are working on. The minimal checked-in example documents Resend. The developer handbook lists the broader Supabase, AWS, RDS, S3, CloudFront, and analytics variables used by the app.

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below. Every merge to `main` automatically deploys through the configured deployment pipeline.

[Continue working on v0](https://v0.app/chat/projects/prj_ZOcfuMikHlqPQL4lMWx1fuk7yTu8)

<a href="https://v0.app/chat/api/kiro/clone/NikhithVasa/v0-ai-photo-gallery" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>
