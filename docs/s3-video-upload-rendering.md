# S3 Video Upload and Rendering Troubleshooting

This document explains how album video upload, S3 storage, and browser rendering work in this app. It is intended for debugging cases where an uploaded video downloads successfully, but does not render or play in the app or from the S3 console **View** button.

## Current implementation

Video upload lives in the album videos flow:

- UI: `components/album-videos-page.tsx`
- Prepare/list API: `app/api/albums/[albumSlug]/videos/route.ts`
- Multipart API: `app/api/albums/[albumSlug]/videos/multipart/route.ts`
- S3 helpers: `lib/s3.ts`
- Render/proxy API: `app/api/media/route.ts`

The expected flow is:

1. The user selects a video in the album videos page.
2. The browser posts `eventSlug`, `fileName`, `size`, and `contentType` to `POST /api/albums/[albumSlug]/videos`.
3. The API creates a `videos` database row with `original_s3_key` and returns either:
   - a presigned single-part `PUT` URL for files under 100 MB, or
   - a multipart upload id and part size for files at or above 100 MB.
4. The browser uploads the file directly to S3.
5. The videos list API returns `videoUrl: /api/media?key=<original_s3_key>`.
6. The page renders that URL in an HTML `<video>` element.
7. `/api/media` verifies access, fetches the S3 object, preserves range requests, and returns the object stream to the browser.

The app does **not** normally expose raw S3 object URLs for playback. It uses the app media proxy so private albums and share permissions can be enforced.

## Important headers

For videos to stream in browsers, these headers matter most.

### S3 object metadata

The upload preparation API sets `ContentType` on both single-part and multipart uploads:

| Extension | App content type |
| --- | --- |
| `.mp4` | `video/mp4` |
| `.m4v` | `video/x-m4v` |
| `.mov` | `video/quicktime` |
| `.webm` | `video/webm` |
| `.avi` | `video/x-msvideo` |
| `.mkv` | `video/x-matroska` |

If the browser file has a valid `file.type` beginning with `video/`, the app keeps that browser-provided type. Otherwise, it falls back from the filename extension.

A video stored as `application/octet-stream` may still download, but browsers and S3 console preview can refuse to render it inline.

### App media response headers

`GET /api/media?key=...` returns:

- `Content-Type`: the S3 content type, with extension fallback for common video types when S3 reports octet-stream.
- `Accept-Ranges: bytes`
- `Content-Length`, when S3 provides it.
- `Content-Range`, when the browser sends a `Range` request.
- HTTP `206` for ranged responses, otherwise HTTP `200`.

Range support is critical. Browser video players usually request metadata and seekable chunks instead of downloading the whole file at once.

## Should we use HLS?

HLS is a good long-term choice for a smoother streaming experience, especially for large event videos, mobile users, slow networks, and users who scrub around the timeline. It is not the first thing to debug when a newly uploaded video does not render at all. First confirm the uploaded source object has the right `Content-Type`, that `/api/media` supports range responses, and that the source file uses browser-supported codecs.

Use direct MP4 playback when:

- videos are short or moderate in size,
- the app only needs one quality level,
- uploads are already H.264/AAC MP4 with `-movflags +faststart`, and
- implementation speed matters more than adaptive streaming.

Use HLS when:

- videos are large,
- users often watch on mobile or variable networks,
- the app needs adaptive quality levels,
- timeline seeking should feel more reliable,
- you want normalized browser-compatible outputs regardless of the uploaded source format.

For this app, the recommended production path is:

1. Keep the original upload in S3 at `videos.original_s3_key`.
2. Trigger a transcode job after upload completes.
3. Convert the source into HLS outputs: `.m3u8` playlists plus `.ts` or fragmented MP4 segments.
4. Store generated HLS files under a derived S3 prefix, for example:

```text
<event-prefix>/videos/hls/<videoId>/master.m3u8
<event-prefix>/videos/hls/<videoId>/720p/index.m3u8
<event-prefix>/videos/hls/<videoId>/720p/segment-00001.ts
```

5. Add a database field such as `hls_s3_key` or `playback_s3_key` to the `videos` table.
6. Return an HLS playback URL from `GET /api/albums/[albumSlug]/videos` when the HLS job is ready.
7. Render HLS in the browser using native Safari support and `hls.js` for browsers such as Chrome and Edge.

Prefer **AWS Elemental MediaConvert** for this. It can normalize uploads into H.264/AAC MP4 and create HLS renditions in one pipeline. **AWS Elastic Transcoder** is older and should only be used if the project already depends on it.

HLS still needs correct response headers. The media serving layer must return:

- `.m3u8` as `application/vnd.apple.mpegurl` or `application/x-mpegURL`
- `.ts` as `video/mp2t`
- `.m4s` as `video/iso.segment`
- range support for segment/object requests

If HLS files remain private, the current `/api/media` route would need to allow the HLS prefix and map HLS extensions to the correct content types, or the app should serve HLS through CloudFront signed URLs/cookies.

## Why download can work while playback fails

If a file downloads and plays locally, the bytes are usually present in S3. Playback can still fail for these reasons:

1. **Wrong object `Content-Type`**
   - Example: `application/octet-stream` instead of `video/mp4`.
   - This commonly breaks the S3 console **View** button.
   - The app media proxy has a fallback by extension, but S3 direct preview does not always behave the same way.

2. **Unsupported browser codec**
   - `.mp4` is only a container. The browser still needs supported video and audio codecs.
   - Safe baseline: H.264 video plus AAC audio in an MP4 container.
   - HEVC/H.265, ProRes, some phone-recorded MOV files, AVI, MKV, and unusual audio codecs may download and play in native desktop players but fail in Chrome/Safari/Edge.

3. **MP4 metadata is at the end of the file**
   - Some MP4 files are not optimized for progressive playback because the `moov` atom is at the end.
   - The browser may need a large tail request before it can start playback.
   - Fix by remuxing with `-movflags +faststart`.

4. **S3 CORS blocks browser direct upload behavior**
   - Multipart upload requires the browser to read the `ETag` response header from each `UploadPart` request.
   - If `ETag` is not exposed by bucket CORS, upload completion can fail. This usually prevents a successful upload, but should still be verified.

5. **The video row points at the wrong key or an incomplete object**
   - The UI stores and renders `videos.original_s3_key`.
   - If a stale DB row points to a missing or partial S3 object, the media proxy returns 404 or streams invalid bytes.

6. **Access or proxy behavior differs from direct S3 behavior**
   - Direct S3 viewing uses S3 object metadata and bucket/object permissions.
   - App playback uses `/api/media`, app auth, album access checks, and S3 `GetObject` behind the server.

## First checks for a failing video

Start with the exact `original_s3_key` stored on the `videos` row.

### 1. Check the database row

```sql
SELECT
  id,
  file_name,
  original_s3_key,
  detection_status,
  detection_error,
  created_at
FROM videos
WHERE id = '<video-id>';
```

Confirm that `original_s3_key` matches the object visible in S3.

### 2. Check S3 object metadata

```bash
aws s3api head-object \
  --bucket "$S3_BUCKET" \
  --key "albums/<album-slug>/events/<event-slug>/videos/<video-id>_<name>.mp4"
```

Look for:

- `ContentType` should be browser-playable, usually `video/mp4` for MP4.
- `ContentLength` should match the uploaded file size.
- `ETag` should exist.
- No unexpected `ContentEncoding` should be set.

If `ContentType` is wrong, update object metadata by copying the object onto itself:

```bash
aws s3api copy-object \
  --bucket "$S3_BUCKET" \
  --copy-source "$S3_BUCKET/albums/<album-slug>/events/<event-slug>/videos/<video-id>_<name>.mp4" \
  --key "albums/<album-slug>/events/<event-slug>/videos/<video-id>_<name>.mp4" \
  --metadata-directive REPLACE \
  --content-type "video/mp4"
```

### 3. Check the app media proxy headers

Use an authenticated browser session or a request that includes the needed cookies.

```bash
curl -I \
  -H "Range: bytes=0-1" \
  "https://<app-host>/api/media?key=albums%2F<album-slug>%2Fevents%2F<event-slug>%2Fvideos%2F<video-id>_<name>.mp4"
```

Expected result:

- Status is `206 Partial Content`.
- `Content-Type` is a video type, usually `video/mp4`.
- `Accept-Ranges: bytes` is present.
- `Content-Range` is present.

If this returns `403`, debug album access or share access. If it returns `404`, verify `videos.original_s3_key` and S3 object existence.

### 4. Check codec and fast-start metadata

Download the object and inspect it locally:

```bash
aws s3 cp \
  "s3://$S3_BUCKET/albums/<album-slug>/events/<event-slug>/videos/<video-id>_<name>.mp4" \
  /tmp/failing-video.mp4

ffprobe -hide_banner -show_streams -show_format /tmp/failing-video.mp4
```

For reliable browser playback, prefer:

- Container: MP4
- Video codec: H.264 / AVC, usually `codec_name=h264`
- Pixel format: `yuv420p`
- Audio codec: AAC, usually `codec_name=aac`

If the file is a valid video but not web-friendly, normalize it:

```bash
ffmpeg -i /tmp/failing-video.mp4 \
  -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.1 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  /tmp/browser-ready-video.mp4
```

Then upload the normalized file with `Content-Type: video/mp4`.

## S3 CORS requirements

Direct browser upload to S3 needs bucket CORS. The multipart flow specifically needs `ETag` exposed, because `components/album-videos-page.tsx` reads each part's `ETag` header before calling the complete endpoint.

Minimum CORS shape:

```json
[
  {
    "AllowedOrigins": ["https://<app-host>", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 3000
  }
]
```

If uploads fail around 100 MB or larger with an `ETag` error, fix CORS before debugging codecs.

## Code path details

### Upload preparation

`POST /api/albums/[albumSlug]/videos` validates album access, creates a `videos` row, builds the S3 key, and returns upload instructions.

The S3 key is built as:

```text
<event.source_prefix or albums/<albumSlug>/events/<eventSlug>>/videos/<videoId>_<safe-file-stem><extension>
```

The extension is restricted to `.mp4`, `.mov`, `.m4v`, `.webm`, `.avi`, or `.mkv`. Unknown extensions are stored as `.mp4`.

### Single-part upload

For files below 100 MB:

1. API returns `uploadUrl` from `signedUploadUrl`.
2. Browser sends `PUT` to that URL with `Content-Type` equal to `prepared.video.contentType`.
3. S3 stores the object with that content type.

### Multipart upload

For files at or above 100 MB:

1. API calls `createMultipartUpload` with the computed content type.
2. Browser requests signed part URLs from `/videos/multipart`.
3. Browser uploads each part and collects the exposed `ETag` headers.
4. Browser calls `/videos/multipart` with `action: "complete"`.
5. Server calls `CompleteMultipartUpload` and S3 assembles the object.

### Rendering

`GET /api/albums/[albumSlug]/videos` maps each row to:

```json
{
  "originalS3Key": "albums/.../videos/...mp4",
  "videoUrl": "/api/media?key=albums%2F...%2Fvideos%2F...mp4"
}
```

The UI uses that value directly:

```tsx
<video src={timelineVideo.videoUrl} controls playsInline />
```

The media route only allows safe, known prefixes and then checks album/customer/admin access before streaming from S3.

## Recommended developer fix order

1. Confirm `videos.original_s3_key` points to the uploaded object.
2. Run `head-object` and fix `ContentType` if it is wrong.
3. Test `/api/media` with `Range: bytes=0-1` and confirm `206` plus video headers.
4. Inspect codecs with `ffprobe`.
5. Remux/transcode one failing video to H.264/AAC MP4 with `-movflags +faststart`.
6. Re-upload the normalized video and verify it plays in the app.
7. If normalized files work, add a server-side or worker-side video normalization step before storing final videos, or restrict uploads to browser-supported formats.
8. For a production streaming experience, add an HLS transcode pipeline with MediaConvert and serve the generated playlist/segments through `/api/media` or CloudFront.

## Likely diagnosis for the reported symptom

The reported behavior is: upload succeeds, download succeeds, but S3 **View** and in-app playback do not render. That most often means the object exists but is not browser-renderable inline. The top suspects are:

1. S3 object `ContentType` is not a video MIME type.
2. The file is an MP4/MOV container with unsupported codecs, commonly HEVC/H.265 from phones or cameras.
3. The MP4 is not optimized for progressive playback and needs `-movflags +faststart`.

Use the checks above in order. If S3 `ContentType` and `/api/media` range headers are correct, treat the file as a codec/container issue and normalize it with ffmpeg.