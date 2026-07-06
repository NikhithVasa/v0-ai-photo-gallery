# Lib Helpers

`lib/` contains the app's reusable business logic and integration boundaries.

## High-Traffic Files

| File | Purpose |
| --- | --- |
| `db.ts` | PostgreSQL pool, RDS IAM token retry, transactions, DB error responses. |
| `s3.ts` | S3 client, signed uploads/downloads, object reads/writes, media URL helpers. |
| `video-playback.ts` | MediaConvert playback normalization, playback schema compatibility, and job status refresh. |
| `gallery-data.ts` | Database row to API/UI photo, event, and person conversion. |
| `auth-access.ts` | Admin and customer access helpers. |
| `album-access.ts` | Album access decisions. |
| `share-access.ts` | Share-token lookup and policy normalization. |
| `share-passcode.ts` | Share passcode cookie validation. |
| `customer-host.ts` | Root-domain and customer subdomain parsing. |
| `photo-sort.ts` | Sort mode normalization and SQL ordering helpers. |

## Conventions

- Prefer shared helpers over duplicating SQL, auth, or media logic in routes.
- Keep database row conversion explicit so API contracts remain stable.
- Preserve runtime schema compatibility checks unless a migration makes them obsolete everywhere.
