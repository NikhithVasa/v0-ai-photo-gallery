# Frontend Data Fetching Handoff

This document describes how the frontend currently fetches data, what each API route returns, and what backend behavior the UI depends on today. It is intentionally implementation-level because the current setup is tightly coupled across React components, Next.js API routes, Postgres, and S3.

## High-Level Architecture

The browser does not call Postgres or S3 directly.

Current request flow:

```text
React client components
  -> Next.js API routes under /app/api/*
    -> Postgres via lib/db.ts
    -> S3 via lib/s3.ts
      -> signed URLs returned to browser
```

The UI is a single Next.js page:

- `app/page.tsx`
- Default tab: `people`
- Other tab: `photos`
- Selecting a person switches to `PersonView`
- Search opens a side panel over the current page

## Client-Side Fetching Summary

| UI area | Component | Client request | Fetching library | Notes |
|---|---|---|---|---|
| People grid | `components/people-grid.tsx` | `GET /api/people` | SWR | No custom SWR cache options. Also PATCHes rename. |
| All Photos grid | `components/photos-grid.tsx` | `GET /api/photos` | SWR | Uses `dedupingInterval: 1h`, no focus/reconnect revalidation. |
| Person detail photos | `components/person-view.tsx` | `GET /api/people/:personId/photos` | SWR | Uses same 1h SWR config as photos. |
| Lightbox full image/download | `components/photo-card.tsx` | `POST /api/photos/signed-urls` | direct `fetch` | Signs full-size URLs on demand for current/nearby photos. |
| AI search panel | `components/search-panel.tsx` | `POST /api/search` | direct `fetch` | Search response already includes signed URLs. |
| Person rename | `components/people-grid.tsx` | `PATCH /api/people/:personId` | direct `fetch` | Optimistic UI update, then SWR `mutate()`. |

## Shared Frontend Types

Defined in `lib/types.ts`.

```ts
export interface Person {
  id: string;
  personNumber: number | null;
  defaultName: string;
  displayName: string | null;
  photoCount: number;
  faceCount: number;
  coverFaceUrl: string | null;
}

export interface Photo {
  id: string;
  fileName?: string | null;
  caption: string | null;
  searchText: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
  width?: number | null;
  height?: number | null;
  personSearchText?: string | null;
  qwenDescription?: string | null;
}

export interface SearchResult {
  photoId: string;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
  reason: string | null;
  score: number;
}
```

Important current behavior:

- `Photo.id` can be either a database UUID or an S3 synthetic ID in the format `s3:<original_s3_key>`.
- `thumbnailUrl` is the grid image URL.
- `previewUrl` is usually `null` in grid responses and is fetched later for the lightbox.
- `downloadUrl` is usually `null` in grid responses and is fetched later.
- `width` and `height` are layout hints only. If missing, the UI falls back to `4 / 3`.

## Current API Routes

### `GET /api/photos`

Used by:

- `components/photos-grid.tsx`

Purpose:

- Fetches all photos for the main Library grid.
- The backend route currently treats S3 originals as the source of truth for what appears in the grid.
- It then merges DB metadata when a matching DB row exists.

Current backend implementation:

1. Reads S3 original keys from:

   ```ts
   process.env.ORIGINAL_PREFIX || "originals/pilot-100/"
   ```

2. Reads S3 thumbnail keys from:

   ```ts
   process.env.THUMB_PREFIX || "thumbnails/pilot-100/"
   ```

3. Queries Postgres:

   ```sql
   SELECT
     id,
     file_name,
     caption,
     search_text,
     original_s3_key,
     preview_s3_key,
     thumbnail_s3_key,
     width,
     height
   FROM photos
   ```

4. Matches S3 original keys to DB rows by:

   - `photos.original_s3_key`
   - fallback: `photos.file_name`

5. For each S3 original image:

   - If a matching thumbnail exists in S3, use it.
   - Else if DB has `preview_s3_key`, use that.
   - Else use the original image.

Current response shape:

```json
{
  "photos": [
    {
      "id": "uuid-or-s3:originals/pilot-100/file.jpg",
      "fileName": "file.jpg",
      "caption": "string or null",
      "searchText": "string or null",
      "previewUrl": null,
      "thumbnailUrl": "signed S3 URL for grid display",
      "downloadUrl": null,
      "width": 6000,
      "height": 4000
    }
  ]
}
```

Current frontend expectations:

- `photos` must include every actual S3 original image that should appear in the library.
- Every item must have a usable `thumbnailUrl`; otherwise the UI shows a gray tile.
- `width` and `height` should be present for stable layout and correct aspect ratio.
- Order currently comes from S3 listing order, not DB `created_at`.

Known problems:

- The route mixes S3 listing, DB metadata, image URL signing, and response shaping.
- Signed URLs are embedded in list responses, so URL churn can cause image reloads if the endpoint refetches.
- Some S3 thumbnails are missing. The route now falls back to originals, but that is heavier.
- DB may contain rows for originals that do not exist in S3. Those no longer appear in `/api/photos`.

### `POST /api/photos/signed-urls`

Used by:

- `components/photo-card.tsx`
- Triggered when opening the lightbox or downloading from a grid tile.

Purpose:

- Fetch full-size preview/download signed URLs on demand.
- This keeps the initial grid response lighter.

Request:

```json
{
  "ids": [
    "uuid-photo-id",
    "s3:originals/pilot-100/file.jpg"
  ]
}
```

Current limitations:

- Maximum `8` IDs per request.
- UUID IDs are looked up in the `photos` table.
- Synthetic `s3:*` IDs are only accepted if they start with `ORIGINAL_PREFIX` and have an image extension.

Response:

```json
{
  "photos": [
    {
      "id": "same id that was requested",
      "previewUrl": "signed S3 URL",
      "downloadUrl": "signed S3 URL with attachment disposition"
    }
  ]
}
```

Current frontend behavior:

- When the lightbox opens, it requests signed URLs for:
  - current photo
  - next photo
  - previous photo
  - next + 2
  - previous - 2
- The frontend preloads returned `previewUrl` images in memory.
- Download buttons call this route if `downloadUrl` is not already available.

### `GET /api/people`

Used by:

- `components/people-grid.tsx`

Purpose:

- Fetches all people/faces for the People & Pets screen.

Current SQL:

```sql
SELECT
  id,
  default_name,
  display_name,
  cover_face_s3_key,
  face_count,
  photo_count
FROM people
ORDER BY display_name NULLS LAST, default_name
```

Response:

```json
{
  "people": [
    {
      "id": "uuid",
      "personNumber": null,
      "defaultName": "Person 93",
      "displayName": "Nikhith",
      "photoCount": 12,
      "faceCount": 18,
      "coverFaceUrl": "signed S3 URL or null"
    }
  ]
}
```

Current frontend behavior:

- Frontend sorts people alphabetically again by `displayName || defaultName`.
- `coverFaceUrl` is displayed as a circular face image.
- If there are no people, the UI shows an empty state.
- If the API fails, the UI shows a database connection error.

Known issues:

- This route signs every cover face URL in the list response.
- People screen depends entirely on DB rows in `people`.
- The RDS IAM token expiry previously caused `PAM authentication failed`; `lib/db.ts` now refreshes the pool every 12 minutes and retries once.

### `PATCH /api/people/:personId`

Used by:

- `components/people-grid.tsx`
- Triggered by rename controls in `PersonCard`.

Request:

```json
{
  "displayName": "New Name"
}
```

Current behavior:

1. Validates `displayName` exists and is a string.
2. Updates:

   ```sql
   UPDATE people
   SET display_name = $1,
       updated_at = now()
   WHERE id = $2
   ```

3. Inserts lowercased alias:

   ```sql
   INSERT INTO person_aliases (person_id, alias)
   VALUES ($1, $2)
   ON CONFLICT DO NOTHING
   ```

4. Returns:

```json
{
  "success": true,
  "person": {
    "id": "uuid",
    "display_name": "New Name"
  }
}
```

Frontend behavior:

- Optimistically updates the SWR people list.
- Calls `mutate()` after success/failure to refetch.

### `GET /api/people/:personId/photos`

Used by:

- `components/person-view.tsx`

Purpose:

- Fetches photos associated with a selected person.

Current SQL:

```sql
SELECT DISTINCT
  p.id,
  p.file_name,
  p.caption,
  p.search_text,
  p.original_s3_key,
  p.preview_s3_key,
  p.thumbnail_s3_key,
  p.width,
  p.height,
  p.created_at,
  pp.search_text AS person_search_text,
  pp.qwen_description
FROM photo_people pp
JOIN photos p ON p.id = pp.photo_id
WHERE pp.person_id = $1
ORDER BY p.created_at DESC
```

Response:

```json
{
  "photos": [
    {
      "id": "uuid",
      "fileName": "file.jpg",
      "caption": "string or null",
      "searchText": "string or null",
      "previewUrl": null,
      "thumbnailUrl": "signed S3 URL",
      "downloadUrl": null,
      "width": 6000,
      "height": 4000,
      "personSearchText": "string or null",
      "qwenDescription": "string or null"
    }
  ]
}
```

Current frontend expectations:

- Every returned photo must have a usable `thumbnailUrl`.
- `width` and `height` should be set for layout.
- The response order determines lightbox next/previous order.

Important difference from `/api/photos`:

- This route is DB-driven, not S3-original-list-driven.
- It does not include S3-only images that are missing DB rows.

### `POST /api/search`

Used by:

- `components/search-panel.tsx`

Purpose:

- Text/person search for the Ask AI side panel.
- This is not vector search in the current implementation; it is rule-based name extraction plus SQL regex/ILIKE filtering.

Request:

```json
{
  "query": "photos of nikhith dancing with kishore"
}
```

Current backend flow:

1. `extractSearchTerms()` lowercases and removes filler words.
2. Words matching action keywords become `keywords`.
3. Other words are treated as potential person names.
4. `resolvePersonName()` tries:
   - exact `people.display_name`
   - exact `people.default_name`
   - exact `person_aliases.alias`
   - partial `people.display_name/default_name`
5. Query branches:
   - two resolved people
   - one resolved person
   - keyword-only
   - fallback text search

Tables/columns referenced:

- `people`
- `person_aliases`
- `photos`
- `photo_people`
- `photo_people.co_person_ids`
- `photo_people.interacting_with_person_ids`
- `photo_people.nearby_person_ids`
- `photo_people.search_text`
- `photo_people.qwen_description`
- `photos.search_text`
- `photos.caption`

Response:

```json
{
  "query": "photos dancing",
  "resolvedPersons": ["person uuid"],
  "keywords": ["dancing"],
  "results": [
    {
      "photoId": "uuid",
      "previewUrl": "signed S3 URL",
      "thumbnailUrl": "signed S3 URL",
      "downloadUrl": "signed S3 URL",
      "reason": "why this result matched",
      "score": 1
    }
  ]
}
```

Current frontend behavior:

- Search results are shown in a side drawer as square thumbnails.
- Search result downloads use `downloadUrl`.
- Search result cards do not open the main lightbox today.

Known issues:

- Search response signs preview, thumbnail, and download URLs for every result immediately.
- Search still assumes DB photo rows are the source of truth.
- Search thumbnail fallback does not check whether derived thumbnails actually exist.
- Search UX/data contract is separate from the main `Photo` contract.

## S3 Behavior

Defined in `lib/s3.ts`.

Environment variables:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `ORIGINAL_PREFIX`
- `THUMB_PREFIX`

Current helpers:

| Helper | Purpose |
|---|---|
| `signedUrl(key)` | Signs a view URL for an S3 object. |
| `signedDownloadUrl(key, filename?)` | Signs an attachment/download URL. |
| `listS3Keys(prefix)` | Lists S3 object keys under a prefix. |
| `derivedThumbnailKey(originalKey, thumbnailKey?)` | Uses explicit thumbnail key, or derives one from original key/prefix. |

Current cache behavior:

- Signed URL cache: `55 minutes`.
- S3 list cache: `5 minutes`.
- Signed URL expiry: `1 hour`.

Important:

- S3 list cache and signed URL cache are in-process only.
- In serverless environments, cache lifetime depends on instance reuse.
- If signed URLs change, browsers may reload images even if the image content is the same.

## Database Behavior

Defined in `lib/db.ts`.

Connection:

- Uses `pg.Pool`.
- Uses AWS RDS IAM auth token from `@aws-sdk/rds-signer`.
- Pool is refreshed every `12 minutes`.
- On auth errors such as `PAM authentication failed`, the pool is reset and the query retries once.

Tables currently expected by frontend/API routes:

```text
people
person_aliases
photos
photo_people
```

Important columns used:

```text
people:
  id
  default_name
  display_name
  cover_face_s3_key
  face_count
  photo_count
  updated_at

person_aliases:
  person_id
  alias

photos:
  id
  file_name
  caption
  search_text
  original_s3_key
  preview_s3_key
  thumbnail_s3_key
  width
  height
  created_at

photo_people:
  photo_id
  person_id
  search_text
  qwen_description
  co_person_ids
  interacting_with_person_ids
  nearby_person_ids
```

## Frontend Rendering Details That Depend on Backend Data

### Photo Layout

`components/photos-grid.tsx` and `components/person-view.tsx` use a justified flex layout.

Sizing uses:

```ts
photoAspectRatio(photo) = photo.width / photo.height
photoFlexBasis(photo) = ratio * clamp(220px, 24vw, 340px)
```

If dimensions are missing:

```ts
aspect ratio = 4 / 3
```

Backend requirement for best UX:

- Always return `width` and `height` for every photo.
- Dimensions should represent the original aspect ratio, not a square thumbnail crop.

### Grid Image

`PhotoCard` renders:

```ts
const imageUrl = photo.thumbnailUrl || photo.previewUrl;
```

Backend requirement:

- `thumbnailUrl` must be a real, loadable image URL.
- If no thumbnail exists, return a lower-res preview or original URL instead.

### Lightbox Image

The grid response usually does not include `previewUrl`.

When the user opens a photo:

1. The lightbox first displays `photo.thumbnailUrl` if no signed preview has returned yet.
2. It calls `POST /api/photos/signed-urls`.
3. It swaps to the full `previewUrl` when available.

Backend requirement:

- `POST /api/photos/signed-urls` must return full-size display URL quickly.
- It should support the same IDs returned by `/api/photos`.

### Next / Previous Order

The frontend uses array index order from the endpoint response.

Backend requirement:

- The response order must be the exact order the user should navigate in.
- `GET /api/photos` currently returns S3 listing order.
- `GET /api/people/:personId/photos` currently returns DB `created_at DESC`.

## Current Pain Points / Refactor Targets

These are the main backend/API issues causing frontend complexity:

1. **Two sources of truth for photos**

   - `/api/photos` is S3-list-driven.
   - Person photos/search are DB-driven.
   - Some DB rows point to missing S3 originals.
   - Some S3 originals may not have DB metadata.

2. **Incomplete thumbnails**

   - Not every original has a matching thumbnail object.
   - The frontend had gray tiles when thumbnail URLs pointed to missing S3 objects.
   - Backend should return a guaranteed loadable display URL.

3. **Signed URL churn**

   - Signed URLs expire and change.
   - Refetching list endpoints can make the browser reload many images.
   - Backend should ideally provide stable CDN URLs or proxy/image endpoint URLs.

4. **Dimensions are required for polished layout**

   - Missing `width`/`height` makes the UI fall back to `4 / 3`.
   - Wrong dimensions cause layout jumps or incorrect tile sizes.

5. **Search contract differs from photo contract**

   - Search returns `SearchResult`.
   - Main grid/person grid return `Photo`.
   - Search signs all URLs eagerly; photo grid signs full URLs lazily.

6. **People data can fail independently**

   - People tab is the default screen.
   - If `/api/people` fails, user sees a broken first screen even if photos are available.

7. **S3 listing in request path**

   - Listing S3 in `/api/photos` is slower on cold requests.
   - The current in-process cache helps but is not reliable across serverless cold starts.

## Suggested Backend Contract After Refactor

This is the contract that would simplify the frontend substantially.

### `GET /api/library/photos`

Return all displayable photos from one canonical backend source.

```json
{
  "photos": [
    {
      "id": "stable-photo-id",
      "fileName": "7S2A4300.jpg",
      "caption": null,
      "width": 6000,
      "height": 4000,
      "thumbnailUrl": "stable URL or signed URL",
      "previewUrl": null,
      "downloadUrl": null,
      "createdAt": "2026-05-01T12:00:00.000Z",
      "people": [
        {
          "id": "person-id",
          "displayName": "Nikhith"
        }
      ]
    }
  ],
  "nextCursor": null
}
```

Requirements:

- Includes every photo that should be visible in the library.
- Excludes missing/deleted S3 objects.
- `thumbnailUrl` always loads.
- `width` and `height` always present.
- Order is explicit and stable.
- Supports pagination/cursor if the library grows.

### `POST /api/library/photos/urls`

Request:

```json
{
  "ids": ["stable-photo-id"],
  "include": ["preview", "download"]
}
```

Response:

```json
{
  "photos": [
    {
      "id": "stable-photo-id",
      "previewUrl": "url",
      "downloadUrl": "url"
    }
  ]
}
```

Requirements:

- Fast enough to call on lightbox open.
- Supports batch signing for current + nearby photos.
- IDs must be the same stable IDs from the list endpoint.

### `GET /api/people`

Return:

```json
{
  "people": [
    {
      "id": "person-id",
      "defaultName": "Person 93",
      "displayName": "Nikhith",
      "photoCount": 12,
      "faceCount": 18,
      "coverFaceUrl": "url"
    }
  ]
}
```

Requirements:

- `coverFaceUrl` always loads if present.
- Sorting can happen backend-side.

### `GET /api/people/:personId/photos`

Return same `Photo` shape as library endpoint.

Requirements:

- Same URL/dimension guarantees as library photos.
- Same stable IDs.
- Explicit stable order.

### `POST /api/search`

Prefer returning the same `Photo` shape or a wrapper around it:

```json
{
  "query": "photos dancing",
  "results": [
    {
      "photo": {
        "id": "stable-photo-id",
        "fileName": "7S2A4300.jpg",
        "width": 6000,
        "height": 4000,
        "thumbnailUrl": "url",
        "previewUrl": null,
        "downloadUrl": null
      },
      "reason": "matched dancing",
      "score": 0.92
    }
  ]
}
```

Requirements:

- Search results should be able to open the same lightbox.
- URL behavior should match the photo grid contract.

## Immediate Questions For Backend

1. What is the canonical source of truth: Postgres `photos`, S3 originals, or another ingest manifest?
2. Should S3-only files without DB rows be visible?
3. Should DB rows whose S3 object is missing be hidden?
4. Can backend guarantee every photo has:
   - stable ID
   - file name
   - original S3 key or stable media URL
   - thumbnail/preview URL
   - width/height
5. Can thumbnails be regenerated for all originals?
6. Can the backend expose stable image URLs instead of short-lived signed S3 URLs?
7. What should the default library sort order be?
8. Should search return photo IDs only, full photo objects, or grouped/person-aware results?
9. Should people cover faces use signed URLs, stable URLs, or derived CDN URLs?
10. Do we need pagination before the photo count grows beyond a few hundred?

