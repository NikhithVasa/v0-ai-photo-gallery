# Auth, Tenancy, and Sharing

This guide documents the cross-cutting access model.

## Tenancy

Customer subdomains are parsed in `lib/customer-host.ts` using `NEXT_PUBLIC_ROOT_DOMAIN`, which defaults to `saathidesk.com`.

Examples:

| Host | Customer slug |
| --- | --- |
| `saathidesk.com` | none |
| `www.saathidesk.com` | none |
| `colorsynchrony.saathidesk.com` | `colorsynchrony` |
| `www.colorsynchrony.saathidesk.com` | `colorsynchrony` |

Middleware rewrites customer subdomain root paths to `/customers/{customerSlug}` without changing the browser URL.

## Middleware Duties

`middleware.ts` does four important jobs:

- Skips static assets and API routes.
- Adds `X-Robots-Tag: noindex, nofollow` to private or customer-specific surfaces.
- Redirects protected pages to `/login?next=...` when no Supabase user is present.
- Rewrites customer subdomain roots to customer pages.

Do not add expensive database checks to middleware unless there is no alternative. Middleware runs on many requests and should stay cheap.

## Public Paths

Some paths are public because they must support marketing, legal pages, auth callback, public album browsing, or share previews. Public routing does not imply unrestricted data access. Album APIs still call access helpers before returning private photo data.

## Share Access

`lib/share-access.ts` reads the share token from the request, finds the matching share link, verifies expiration, checks passcode state, and returns the policy used by photo APIs.

Share access can restrict:

- Download permission.
- Watermark behavior.
- Person IDs.
- Whether the link is only for the selected person or a subset.
- Event tab visibility.

## SEO and Privacy

`noindex` helps keep private delivery URLs out of search results. It is not an authorization mechanism. Always use auth checks, share-token checks, and passcode checks for real access control.
