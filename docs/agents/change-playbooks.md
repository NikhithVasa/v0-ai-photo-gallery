# Agent Change Playbooks

Use these playbooks to keep common changes scoped.

## Add or Change an API Route

1. Read the route handler in `app/api/...`.
2. Read the access helper it calls.
3. Read the closest data conversion helper in `lib/`.
4. Make the route change.
5. Run `pnpm lint` or a narrower route-specific check if available.
6. Update `docs/developer/api-map.md` if the route behavior or purpose changed.

## Change Album Photo Display

1. Read the page/component that renders the grid.
2. Read `app/api/albums/[albumSlug]/photos/route.ts`.
3. Read `lib/gallery-data.ts` for media selection and response shape.
4. Avoid returning raw S3 keys to the browser unless the existing contract already does so.
5. Validate with lint and, when UI changes are visible, a browser check.

## Change Sharing Behavior

1. Read `lib/share-access.ts` and `lib/share-passcode.ts`.
2. Read the album photo route that applies share restrictions.
3. Preserve existing token, passcode, download, watermark, and people behavior unless explicitly changing it.
4. Update customer sharing docs and developer auth docs.

## Change Customer Subdomain Behavior

1. Read `lib/customer-host.ts`.
2. Read `middleware.ts`.
3. Check root-domain, `www`, and customer-subdomain cases.
4. Confirm noindex behavior remains correct.
5. Update `docs/developer/auth-tenancy-sharing.md`.

## Change Upload or Media Behavior

1. Read `app/api/uploads/route.ts`.
2. Read `lib/s3.ts`.
3. Read `lib/gallery-data.ts` if display behavior changes.
4. Preserve RAW/TIFF display fallbacks.
5. Update `docs/developer/data-and-media-flow.md`.

## Change Public Copy or UI Docs

1. Locate route in `app/` and component in `components/`.
2. Preserve the existing visual system unless the task asks for redesign.
3. Keep visible copy concise and operational.
4. Update `docs/customer/` when the user-facing workflow changes.
