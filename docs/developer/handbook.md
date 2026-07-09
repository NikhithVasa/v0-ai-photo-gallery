# Developer Handbook

This handbook is the main engineering entry point for SaathiDesk.

## Stack

- Next.js 16 App Router.
- React 19.
- TypeScript 5.7.
- Tailwind CSS 4.
- Supabase Auth for sign-in sessions.
- PostgreSQL on RDS for app data.
- AWS S3 for originals, previews, thumbnails, videos, and generated assets.
- Optional CloudFront image URLs for media delivery.
- Resend for contact form email.
- PostHog and Vercel Analytics for analytics.

## Commands

Use pnpm unless a task explicitly says otherwise.

```bash
pnpm dev
pnpm build
pnpm lint
pnpm verify:google-photos-picker
```

`pnpm build` runs `scripts/verify-google-photos-picker.mjs` before `next build`, so Google picker regressions fail the build early.

## Repository Map

| Path | Purpose |
| --- | --- |
| `app/` | App Router pages, metadata, public routes, and API route handlers. |
| `components/` | Client and server UI components. Larger pages usually live here and are mounted by route files. |
| `lib/` | Server helpers, database access, auth checks, media helpers, schemas, type conversion, and integration logic. |
| `hooks/` | Reusable React hooks. |
| `types/` | Shared TypeScript declarations. |
| `scripts/` | Verification and maintenance scripts. |
| `docs/` | Customer, developer, and agent documentation. |
| `public/` | Static assets served directly by Next.js. |

## Request Flow

1. `middleware.ts` filters assets/API routes, applies noindex headers, checks Supabase auth for protected pages, and rewrites customer subdomains to customer routes.
2. Route files in `app/` load page-level data or mount components.
3. API routes in `app/api/` validate access and request data.
4. `lib/auth-access.ts`, `lib/album-access.ts`, and `lib/share-access.ts` decide who can see protected album data.
5. `lib/db.ts` runs PostgreSQL queries with RDS IAM token refresh support.
6. `lib/gallery-data.ts` converts database rows into API-safe photo, person, and album shapes.
7. `lib/s3.ts` signs upload/download operations and routes display media through `/api/media` unless CloudFront is forced.

## Environment Variables

The checked-in `.env.example` is minimal. Real deployments also need values for Supabase, AWS, RDS, S3, optional CloudFront behavior, and analytics.

| Variable | Used by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `lib/customer-host.ts`, middleware | Defaults to `saathidesk.com`; controls customer subdomain parsing. |
| `NEXT_PUBLIC_SUPABASE_URL` | middleware, auth helpers | Required for Supabase user checks. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | middleware, clients | Required for auth flows. |
| `RDS_HOST`, `RDS_PORT`, `RDS_USER`, `RDS_DB` | `lib/db.ts` | RDS PostgreSQL connection settings. |
| `RDS_PASSWORD` | `lib/db.ts` | Optional. If absent, IAM auth token generation is used. |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | RDS signer and S3 helpers | Required for AWS integrations. |
| `S3_BUCKET` | `lib/s3.ts` | Bucket for uploaded and generated media. |
| `PG_POOL_MAX` | `lib/db.ts` | Defaults to 1 for serverless safety. |
| `NEXT_PUBLIC_FORCE_CLOUDFRONT_IMAGES`, `FORCE_CLOUDFRONT_IMAGES` | `lib/s3.ts` | Prefer CloudFront image URLs when available. |
| `NEXT_PUBLIC_COMPOSABLE_LIGHTBOX` | `components/photo-card.tsx` | Set to `true` to use the composable Radix-style photo lightbox. |
| `THUMB_PREFIX` | `lib/s3.ts` | Optional derived thumbnail prefix. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | contact API | Contact form delivery. |

## Access Model

There are three overlapping access paths:

- Admin/user access through Supabase sessions.
- Customer/album access through album and customer checks.
- Share-token access through token, passcode, person restriction, watermark, and download policy.

Do not treat `noindex` headers as authorization. They are SEO and privacy hints only.

## Data Compatibility Pattern

Several helpers check or create schema features at runtime, such as photo sort positions, event covers, share link columns, and upload event source prefixes. This app has evolved with production data, so new features often need defensive schema checks instead of assuming every database has the latest column.

## Validation Expectations

For code changes, run the narrowest useful check first. Common checks:

```bash
pnpm lint
pnpm build
pnpm verify:google-photos-picker
```

For documentation-only changes, run:

```bash
git diff --check
```

## Change Safety

- Keep route handlers thin when possible; move reusable transformation logic into `lib/`.
- Keep customer-facing copy plain and specific.
- Preserve existing URL shapes and share-token behavior unless the task explicitly changes them.
- Be careful with bracket route paths in zsh. Quote paths such as `'app/albums/[albumSlug]/page.tsx'`.
