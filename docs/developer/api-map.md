# API Map

This map groups API routes by product area. Route handlers live under `app/api/`.

## Albums and Photos

| Route area | Purpose |
| --- | --- |
| `/api/albums` | Create and list albums. |
| `/api/albums/stats` | Aggregate album stats. |
| `/api/albums/[albumSlug]` | Read or update a single album. |
| `/api/albums/[albumSlug]/photos` | List album photos with event, person, share, and sort filters; optional `limit` and `offset` paginate results and return `hasMore`. |
| `/api/albums/[albumSlug]/photos/[photoId]` | Single photo updates and deletes. |
| `/api/albums/[albumSlug]/photos/signed-urls` | Signed media URLs for photo display/download flows. |
| `/api/albums/[albumSlug]/photos/sort` | Custom sort positions. |
| `/api/albums/[albumSlug]/photos/move` | Move photos between album events. |
| `/api/albums/[albumSlug]/cover` | Album cover selection. |
| `/api/albums/[albumSlug]/events` | Album event CRUD. |

## Uploads and Media

| Route area | Purpose |
| --- | --- |
| `/api/uploads` | Create upload targets and initial photo rows. |
| `/api/uploads/complete` | Mark uploads complete after client upload. |
| `/api/uploads/processing-status` | Poll processing status. |
| `/api/uploads/[photoId]/file` | Photo file operations. |
| `/api/media` | Auth-aware media proxy for display objects. |
| `/api/albums/[albumSlug]/videos` | Video list/create flows. |
| `/api/albums/[albumSlug]/videos/multipart` | Multipart video uploads. |
| `/api/albums/[albumSlug]/videos/[videoId]/ai` | AI video actions. |

## Sharing

| Route area | Purpose |
| --- | --- |
| `/api/share/[token]` | Public share metadata and access. |
| `/api/share/[token]/verify-passcode` | Passcode verification for share links. |
| `/api/albums/[albumSlug]/share` | Create or update album share settings. |
| `/api/albums/[albumSlug]/share/links` | Manage album share links. |
| `/api/albums/[albumSlug]/share/person` | Create person-specific share links. |

## People and Culling

| Route area | Purpose |
| --- | --- |
| `/api/albums/[albumSlug]/people` | Album people list. |
| `/api/albums/[albumSlug]/people/[personId]` | Person updates. |
| `/api/albums/[albumSlug]/people/[personId]/photos` | Photos for a person. |
| `/api/albums/[albumSlug]/people/match` | Person matching. |
| `/api/albums/[albumSlug]/people/merge` | Merge duplicate people. |
| `/api/albums/[albumSlug]/culling/clusters` | Album-level culling clusters. |
| `/api/albums/[albumSlug]/events/[eventSlug]/culling/clusters` | Event-level culling clusters. |
| `/api/culling/clusters/[clusterId]/items` | Cluster item detail. |
| `/api/culling/clusters/[clusterId]/best` | Best-photo selection. |

## Customers, Auth, Presets, Search

| Route area | Purpose |
| --- | --- |
| `/api/customers` | Customer list/create. |
| `/api/customers/[customerSlug]` | Customer read/update. |
| `/api/customers/[customerSlug]/albums` | Albums for a customer subdomain. |
| `/api/customers/[customerSlug]/users` | Customer user management. |
| `/api/customers/[customerSlug]/password` | Customer password setup. |
| `/api/customers/[customerSlug]/verify-password` | Customer password verification. |
| `/api/auth/access` | Auth/access state endpoint. |
| `/api/search` | Admin search over person and text metadata. |
| `/api/presets` | Preset marketplace data. |
| `/api/presets/[presetId]` | Preset detail/update/delete. |
| `/api/presets/[presetId]/save` | Save preset to account. |
| `/api/presets/[presetId]/apply` | Apply preset to selected photos. |
| `/api/contact` | Contact form email. |
| `/api/newsletter` | Add a newsletter subscriber to Resend Contacts and the optional configured newsletter segment. |

## Route Handler Rules

- Validate access before querying sensitive data.
- Prefer shared helpers for database rows, signed media URLs, and auth checks.
- Return `Cache-Control: no-store` for private album data unless a route is explicitly public and cache-safe.
- Keep share-token policy in share/access helpers so public and album routes stay consistent.
