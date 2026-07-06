# Agent Repo Map

This is a quick map for agents that need to move through the repo without broad exploration.

## App Router

- `app/page.tsx`: root marketing or landing route.
- `app/docs/page.tsx`: public docs page shell.
- `app/how-ai-works/page.tsx`: public AI explanation route.
- `app/login/page.tsx`: sign-in route.
- `app/albums/`: authenticated album pages.
- `app/share/[token]/`: public share pages and social preview images.
- `app/customers/`: customer and subdomain-backed customer pages.
- `app/api/`: API route handlers.

## Components

- Page components are usually named after their route, such as `album-gallery-page.tsx`, `upload-page.tsx`, or `customer-albums-page.tsx`.
- Shared UI primitives live in `components/ui/`.
- Auth and analytics wrappers live near the top of `components/`.

## Lib Helpers

- `db.ts`: PostgreSQL pool, IAM auth token retry, transaction helper.
- `s3.ts`: S3 client, signed uploads/downloads, cache helpers, object reads/writes.
- `gallery-data.ts`: database row to UI/API type conversion.
- `auth-access.ts`: admin and customer access helpers.
- `album-access.ts`: album access decisions.
- `share-access.ts`: share-token policy lookup.
- `share-passcode.ts`: passcode cookie checks.
- `customer-host.ts`: root domain and subdomain parsing.
- `photo-sort.ts`: album/event/custom sorting SQL helpers.
- `customer-schema.ts`: runtime schema compatibility helpers.

## Worker Repositories

This VS Code workspace also includes sibling worker repos:

- `photo-ai-worker/`: image and AI processing worker.
- `face-worker/`: face deduplication and related worker code.

Do not edit worker repos when the user asks for web app documentation unless the requested behavior crosses the web/worker boundary.
