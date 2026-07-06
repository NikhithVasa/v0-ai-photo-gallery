# Operations Runbook

Use this runbook when the app is unhealthy, media is missing, auth is failing, or public delivery links behave unexpectedly.

## First Checks

```bash
pnpm lint
pnpm build
git status --short --branch
```

For production issues, also check deployment logs, route logs, and worker logs. The web app depends on external workers for image processing and face/AI metadata.

## Database Busy or Connection Limit

Symptoms:

- API returns `503` with `Database is busy. Please retry in a moment.`
- Logs include PostgreSQL code `53300`.

Relevant file: `lib/db.ts`.

Actions:

- Confirm `PG_POOL_MAX` is not too high for the deployment model.
- Check RDS connection limits and active connections.
- Retry the request after a short delay.
- Avoid adding parallel query bursts in route handlers.

## RDS IAM Token Failure

Symptoms:

- Logs mention password authentication, PAM authentication, or expired credentials.

Relevant file: `lib/db.ts`.

Actions:

- Confirm AWS credentials and region are present.
- Confirm `RDS_USER`, `RDS_HOST`, and `RDS_PORT` are correct.
- If `RDS_PASSWORD` is intentionally absent, IAM token generation must be allowed.

The database helper resets the pool once on auth-token failures and retries the query.

## Missing Photo Previews

Symptoms:

- Grid images appear broken or delayed.
- RAW uploads do not display immediately.

Relevant files: `lib/gallery-data.ts`, `lib/s3.ts`, `/api/media`.

Actions:

- Check `compression_status` for affected photos.
- Confirm generated WebP/JPEG objects exist in S3.
- Confirm `/api/media?key=...` returns a non-error response.
- Confirm CloudFront forcing is not pointing to an invalid distribution or key shape.

## Share Link Access Problems

Symptoms:

- Public link shows fewer photos than expected.
- Person-specific link shows no photos.
- Passcode gate loops.

Relevant files: `lib/share-access.ts`, `lib/share-passcode.ts`, `app/api/albums/[albumSlug]/photos/route.ts`.

Actions:

- Confirm the share token exists and is not expired.
- Confirm passcode cookie state for the token.
- Confirm `person_ids`, `person_id`, and `only_person` settings.
- Check whether the API is filtering by event or people query params.

## Customer Subdomain Problems

Symptoms:

- Root domain works but customer subdomain does not.
- Customer subdomain resolves to login or root content.

Relevant files: `middleware.ts`, `lib/customer-host.ts`.

Actions:

- Confirm DNS resolves to the deployment.
- Confirm TLS certificate covers the subdomain.
- Confirm `NEXT_PUBLIC_ROOT_DOMAIN` matches the production root.
- Confirm the customer slug exists in the database.

## Contact Form Problems

Symptoms:

- Contact form submissions fail.
- Emails are not delivered.

Relevant route: `/api/contact`.

Actions:

- Confirm `RESEND_API_KEY` is set.
- Confirm `RESEND_FROM_EMAIL` uses a verified sender domain if configured.
- Check Resend logs for delivery or domain verification errors.
