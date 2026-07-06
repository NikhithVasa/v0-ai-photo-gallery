# App Directory

`app/` contains Next.js App Router routes, route metadata, social image generators, sitemap/robots handlers, and API route handlers.

## Conventions

- Keep route files thin when possible. Mount a page component from `components/` or call a helper from `lib/`.
- Put reusable business logic in `lib/`, not inside page files.
- Public pages should define metadata through `lib/seo.ts` helpers when practical.
- Quote bracket routes in shell commands, for example `'app/albums/[albumSlug]/page.tsx'`.

## Important Areas

- `albums/`: authenticated album management, uploads, culling, videos, and public album views.
- `api/`: route handlers for data, media, uploads, shares, presets, customers, and search.
- `customers/`: customer and subdomain-backed pages.
- `share/[token]/`: public share pages and Open Graph/Twitter images.
- `legal/`, `contact/`, `docs/`, `how-ai-works/`: public information pages.
