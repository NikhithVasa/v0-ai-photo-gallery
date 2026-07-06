# API Routes

API route handlers live under `app/api/`. The full route map is documented in [docs/developer/api-map.md](../../docs/developer/api-map.md).

## Rules of Thumb

- Validate access before reading or returning private data.
- Use `dbErrorResponse()` when a route can hit database connection pressure.
- Use shared helpers from `lib/` for S3 URLs, database row conversion, share-token policy, and schema compatibility.
- Return `Cache-Control: no-store` for private album/customer responses unless the route is explicitly public and cache-safe.
- Keep share-token behavior centralized in `lib/share-access.ts` and passcode behavior in `lib/share-passcode.ts`.

## Sensitive Route Families

- Album and photo APIs must respect admin, album, customer, and share access.
- Share APIs must respect expiration, passcodes, person restrictions, downloads, and watermark settings.
- Media APIs must avoid exposing arbitrary S3 objects without an access decision.
