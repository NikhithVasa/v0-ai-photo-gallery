# Data and Media Flow

This guide explains how photos move from upload to customer delivery.

## Upload Flow

1. The browser sends file names, sizes, content types, dimensions, album info, and event info to `/api/uploads`.
2. The route validates admin or album/customer access.
3. The route creates or finds the album and event.
4. The route builds stable S3 keys for originals, AI input, previews, thumbnails, and annotations.
5. The route inserts initial photo rows.
6. The route returns signed S3 upload URLs.
7. The browser uploads files directly to S3.
8. Completion and worker processes update status, previews, thumbnails, faces, captions, and AI metadata.

## Key S3 Object Families

| Family | Purpose |
| --- | --- |
| `originals/` | Uploaded source files, including RAW or TIFF originals. |
| `ai-input/` | Web-renderable, compressed input images for AI and gallery display. |
| `thumbnails/` | Small previews for grids. |
| `annotated/` | Generated annotation or review assets. |
| video prefixes | Multipart video uploads and rendered outputs. |

The exact prefix can come from an event `source_prefix`. If it is absent, uploads default to `albums/{albumSlug}/events/{eventSlug}`.

## Display URL Selection

`lib/gallery-data.ts` chooses media keys in this order:

1. Completed `ai_input_s3_key`.
2. Web-renderable original key.
3. Clean preview key.
4. Watermarked preview key.
5. Thumbnail key.

The completed-status check matters. `ai_input_s3_key` can be present before the object exists, and pointing the browser at a missing key can produce blocked or broken images.

## Signed URLs and Media Proxy

`lib/s3.ts` has two display patterns:

- `signedUrl()` returns `/api/media?key=...` by default for browser display.
- `signedObjectUrl()` creates direct signed S3 URLs for object reads.
- `signedDownloadUrl()` adds a download content disposition for attachment downloads.

CloudFront can be forced through `NEXT_PUBLIC_FORCE_CLOUDFRONT_IMAGES=true` or `FORCE_CLOUDFRONT_IMAGES=true` when `lib/cloudfront-url.ts` can build a usable URL.

## Database Row Conversion

API routes should avoid returning raw database rows directly. Use conversion helpers such as `toPhoto()` so UI contracts stay stable while database columns evolve.

## Processing States to Watch

| Field | Why it matters |
| --- | --- |
| `upload_status` | Public photo APIs only return completed uploads. |
| `compression_status` | Controls whether AI input is safe to display. |
| `watermark_status` | Indicates whether watermarked previews are ready. |
| `custom_sort_order` or sort positions | Controls album/event ordering. |
