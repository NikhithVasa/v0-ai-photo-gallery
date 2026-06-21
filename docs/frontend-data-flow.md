# Frontend Data Fetching Handoff

This document describes the current frontend data flow after the album/event refactor. The browser still never talks to Postgres or S3 directly; every request goes through Next.js API routes that query Postgres and return signed S3 URLs.

## High-Level Architecture

```text
React client components
  -> album-scoped Next.js API routes under /app/api/albums/*
    -> Postgres via lib/db.ts
    -> S3 URL signing via lib/s3.ts
      -> signed thumbnail/preview/download URLs returned to browser
```

The frontend now has album-aware entry points:

```text
/
/albums
/albums/[albumSlug]
/albums/[albumSlug]?event=wedding
```

`/` and `/albums` both render the album selector. `/albums/[albumSlug]` renders the gallery shell for one album and keeps the selected event in the `event` query param.

## Client-Side Fetching Summary

| UI area | Component | Request | Notes |
|---|---|---|---|
| Album selector | `components/albums-page.tsx` | `GET /api/albums` | Lists album cards with cover photos and counts. |
| Album shell | `components/album-gallery-page.tsx` | `GET /api/albums/:albumSlug` | Loads album metadata and event tabs. |
| Photos grid | `components/photos-grid.tsx` | `GET /api/albums/:albumSlug/photos?event=` | DB-first photo list. Uses 1 hour SWR dedupe and disables focus/reconnect revalidation. |
| People grid | `components/people-grid.tsx` | `GET /api/albums/:albumSlug/people?event=` | Album-scoped people; optional event filter. |
| Person detail | `components/person-view.tsx` | `GET /api/albums/:albumSlug/people/:personId/photos?event=` | Uses the same photo grid/lightbox behavior as all photos. |
| Person rename | `components/people-grid.tsx` | `PATCH /api/albums/:albumSlug/people/:personId` | Optimistic local rename, then SWR revalidate. |
| Lightbox/download URLs | `components/photo-card.tsx` | `POST /api/albums/:albumSlug/photos/signed-urls` | Fetches signed preview/download URLs for current and nearby photos. |
| Search panel | `components/search-panel.tsx` | `POST /api/albums/:albumSlug/search` | Sends `query`, `event`, `together`, `limit`; expects `Photo[]` results. |
| Album password | `components/album-gallery-page.tsx` | `POST /api/albums/:albumSlug/verify-password` | Used only when `album.passwordRequired` is true. |

## Shared Frontend Types

Defined in `lib/types.ts`.

```ts
export interface AlbumSummary {
  id: string;
  slug: string;
  name: string;
  passwordRequired: boolean;
  coverPhotoUrl: string | null;
  eventCount: number;
  photoCount: number;
  peopleCount: number;
  createdAt: string;
}

export interface AlbumEvent {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  photoCount: number;
  peopleCount: number;
}

export interface AlbumDetail {
  id: string;
  slug: string;
  name: string;
  passwordRequired: boolean;
  watermarkEnabled: boolean;
  events: AlbumEvent[];
  photoCount: number;
  peopleCount: number;
}

export interface Person {
  id: string;
  albumId: string;
  personNumber: number;
  defaultName: string;
  displayName: string | null;
  photoCount: number;
  faceCount: number;
  occurrenceCount: number;
  coverFaceUrl: string | null;
  eventStats?: Array<{
    eventSlug: string;
    eventName: string;
    photoCount: number;
    faceCount: number;
  }>;
}

export interface Photo {
  id: string; // DB UUID only
  albumId: string;
  albumSlug: string;
  eventId: string;
  eventSlug: string;
  eventName: string;
  fileName: string | null;
  caption: string | null;
  searchText: string | null;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  personSearchText?: string | null;
  qwenDescription?: string | null;
}
```

The frontend no longer supports synthetic `s3:<key>` photo IDs in the new album-scoped flow.

## API Routes

### `GET /api/albums`

Returns album cards for `/` and `/albums`.

Response:

```ts
{ albums: AlbumSummary[] }
```

Implementation:

- Reads from `albums`.
- Counts related `album_events`, `photos`, and visible `people`.
- Uses the first non-deleted photo as a cover.
- Signs `coverPhotoUrl` from the DB S3 key.

### `GET /api/albums/:albumSlug`

Returns the open album metadata and event tabs.

Response:

```ts
{ album: AlbumDetail }
```

Implementation:

- Reads one album by `albums.slug`.
- Counts non-deleted photos and visible people.
- Calls the shared event loader for `album.events`.

### `GET /api/albums/:albumSlug/events`

Returns only event tabs.

Response:

```ts
{ events: AlbumEvent[] }
```

Implementation:

- Reads `album_events` scoped by album slug.
- Counts non-deleted photos per event.
- Counts people per event through `person_event_stats`.

### `GET /api/albums/:albumSlug/photos?event=`

Returns DB-first photos for the album, optionally scoped by event slug.

Response:

```ts
{ photos: Photo[] }
```

Implementation:

- Joins `photos`, `albums`, and `album_events`.
- Requires `a.slug = albumSlug`.
- Applies optional `e.slug = event`.
- Filters `COALESCE(p.is_deleted, false) = false`.
- Orders by `p.created_at ASC` so lightbox next/previous matches the visible grid order.

S3 URL priority:

```text
thumbnailUrl:
  thumbnail_s3_key
  -> watermarked_preview_s3_key
  -> clean_preview_s3_key
  -> original_s3_key

previewUrl:
  watermarked_preview_s3_key
  -> clean_preview_s3_key
  -> original_s3_key

downloadUrl:
  null in list responses; fetched on demand from signed-urls route
```

### `GET /api/albums/:albumSlug/people?event=`

Returns people scoped to the album, optionally filtered to people present in one event.

Response:

```ts
{ people: Person[] }
```

Implementation without event:

- Reads visible `people` by album.
- Orders by `photo_count DESC`, then `person_number ASC`.

Implementation with event:

- Joins `album_events`.
- Uses `person_event_stats`.
- Filters to `COALESCE(pes.photo_count, 0) > 0`.

Every returned person also gets `eventStats` for all album events, so the UI can show per-event indicators.

### `GET /api/albums/:albumSlug/people/:personId/photos?event=`

Returns photos for one person in one album, optionally event-scoped.

Response:

```ts
{ photos: Photo[] }
```

Implementation:

- Joins `photo_people`, `photos`, `albums`, and `album_events`.
- Requires album slug and person ID.
- Applies optional event slug.
- Returns the same `Photo` shape and URL priority as the album photos route.

### `PATCH /api/albums/:albumSlug/people/:personId`

Renames a person inside an album.

Request:

```ts
{ displayName: string }
```

Response:

```ts
{ success: true; person: { id: string; display_name: string | null } }
```

Implementation:

- Updates only when the person belongs to the album slug.
- Best-effort inserts into `person_aliases` if that optional table exists.

### `POST /api/albums/:albumSlug/photos/signed-urls`

Returns signed preview/download URLs for selected photos.

Request:

```ts
{ photoIds: string[] }
```

Response:

```ts
{
  urls: {
    [photoId: string]: {
      previewUrl: string | null;
      downloadUrl: string | null;
      thumbnailUrl?: string | null;
    };
  };
  photos: Array<{
    id: string;
    previewUrl: string | null;
    downloadUrl: string | null;
    thumbnailUrl?: string | null;
  }>;
}
```

The response includes both `urls` and `photos` for easier frontend migration, but the new frontend reads `urls`.

Implementation:

- Accepts DB UUIDs only.
- Verifies photo IDs belong to the album slug.
- Caps signing to 12 IDs per request.
- Uses preview priority `watermarked_preview_s3_key -> clean_preview_s3_key -> original_s3_key`.
- Uses `original_s3_key` for download.

### `POST /api/albums/:albumSlug/search`

Searches inside one album, optionally within one event.

Request:

```ts
{
  query: string;
  event?: string | null;
  people?: string[];
  together?: boolean;
  limit?: number;
}
```

Response:

```ts
{
  query: string;
  resolvedPeople: Person[];
  results: Photo[];
}
```

Current implementation:

- Album scope is mandatory.
- Event filter is optional.
- Person names are resolved inside the album only.
- `person 93` resolves through `people.person_number`.
- Optional `people` values may be UUIDs or names.
- `together=true` requires every selected person to appear in the same photo.
- Natural-language queries use OpenRouter `google/gemini-embedding-2` at 768 dimensions and rank `photos.image_embedding` with pgvector cosine distance.
- Keyword fallback searches `photos.search_text`, `photos.caption`, `photo_people.search_text`, and `photo_people.qwen_description`.

Vector columns are not exposed to the browser. Backend can replace the internals with vector search as long as the response contract stays the same.

### `POST /api/albums/:albumSlug/verify-password`

Password gate for protected albums.

Request:

```ts
{ password: string }
```

Response:

```ts
{ ok: boolean }
```

Current implementation supports plain comparison and `sha256:<hex>` hashes. If backend uses bcrypt/argon hashes, this route should be updated with the matching verifier package.

## S3 Behavior

The new album-scoped routes do not list S3 and do not derive S3 paths from prefixes.

S3 keys come from DB columns:

```text
photos.original_s3_key
photos.clean_preview_s3_key
photos.watermarked_preview_s3_key
photos.thumbnail_s3_key
photos.annotated_s3_key
people.cover_face_s3_key
```

`lib/gallery-data.ts` centralizes the signing and priority rules. `lib/s3.ts` still caches signed URLs for 55 minutes.

## UI Rendering Behavior

- Album selector appears at `/` and `/albums`.
- Album pages default to the Photos tab so albums with zero people still show content.
- Event tabs are shown from `album.events` and update the `event` query param.
- Photos use the same order returned by the API; lightbox next/previous follows that array exactly.
- The grid uses image dimensions from DB to produce variable-width photo tiles.
- Missing dimensions fall back to `4 / 3`.
- Grid thumbnails use `thumbnailUrl || previewUrl`.
- Lightbox uses `previewUrl || thumbnailUrl`.
- Full download URLs are fetched only when needed.
- People empty state says processing instead of treating zero people as an error.
- Event-aware person indicators come from `person.eventStats`.

## Runtime Verification Note

Build and type-check pass locally. A local runtime call to `GET /api/albums` currently fails against the configured local database with:

```text
relation "album_events" does not exist
```

That means the local `.env` database is not the new album schema. The album-scoped frontend/API contract expects the migrated backend schema containing `albums`, `album_events`, `photos`, `people`, `photo_people`, and `person_event_stats`.
