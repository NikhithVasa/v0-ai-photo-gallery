# Customer Handbook

This handbook is for photographers, studio admins, event teams, and clients using SaathiDesk to prepare, review, search, and share photo galleries.

## What SaathiDesk Does

SaathiDesk helps a studio manage delivery after a shoot:

- Create customer-branded album spaces.
- Upload originals and generated previews.
- Organize albums into events such as ceremony, reception, portraits, or backstage.
- Use AI-assisted culling to review groups, people, and likely best photos.
- Search photos by people, captions, and visual descriptions.
- Share full galleries or restricted person-specific links.
- Protect private albums with passcodes and watermark settings.
- Offer downloadable or view-only delivery links.

## Core Terms

| Term | Meaning |
| --- | --- |
| Customer | A studio, client, or branded subdomain such as `colorsynchrony.saathidesk.com`. |
| Album | A gallery collection, usually one event or client delivery. |
| Event | A section inside an album, such as `wedding`, `reception`, or `sangeet`. |
| Photo | A single uploaded image with preview, metadata, faces, and optional AI text. |
| Person | A detected person profile used for find-yourself views and person-specific shares. |
| Share link | A tokenized public link that can restrict downloads, people, and passcode access. |
| Preset | A `.cube` LUT or style preset that can be uploaded, previewed, saved, and applied. |

## Daily Workflow

1. Sign in at `/login`.
2. Create or open a customer.
3. Create an album and add events.
4. Upload photos to the right event.
5. Let workers process previews, thumbnails, faces, and AI metadata.
6. Review AI culling suggestions and people clusters.
7. Adjust covers, captions, event order, and sort mode.
8. Create share links for the client or selected people.
9. Review the public link in a private browser window before sending.

## Upload Guidance

Use event names that match the way the client expects to browse. Good event names are short and recognizable: `Ceremony`, `Reception`, `Family Portraits`, `Couple Session`.

SaathiDesk accepts common web and camera formats including JPEG, PNG, WebP, HEIC/HEIF, RAW formats such as NEF/CR2/ARW/DNG, TIFF, BMP, and JFIF. RAW and TIFF originals are stored, but browsers cannot display them directly. The app shows generated WebP/JPEG previews once processing finishes.

If a photo looks broken immediately after upload, wait for compression to complete and refresh the album. The app intentionally avoids pointing browsers at RAW originals because they cannot render in `<img>` tags.

## Sharing Guidance

Before sending a link, check four settings:

- Downloads: enabled only when the client is allowed to save originals or delivery files.
- Watermark: enabled when previews should remain protected.
- People restrictions: enabled for find-yourself or family-specific links.
- Passcode: enabled for private galleries or sensitive events.

Use person-specific links when a guest should see only photos containing them. Use full-gallery links when the client is allowed to browse the entire album.

## Privacy Expectations

SaathiDesk treats customer subdomains and share links as private delivery surfaces. Customer subdomains are marked `noindex` by middleware so search engines should not index them. Login, settings, uploads, albums, customers, presets, API, debug, and share pages also receive `X-Robots-Tag: noindex, nofollow` where appropriate.

Search engines can still discover URLs that are shared publicly elsewhere, so do not publish private links on social media. Use passcodes for sensitive albums.

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| Album asks for login | You are on an admin page, or the public route does not include a valid share/passcode state. |
| Public link opens but photos are hidden | The share link may be restricted to specific people or passcode access. |
| Some previews are missing | Processing may still be running, or the original format needs a generated preview. |
| Download button is missing | The share link was created with downloads disabled. |
| Person search misses someone | Faces may need review, merge, or better cover selection. |
| Customer subdomain shows the wrong page | Confirm the subdomain slug and root domain configuration. |

## Safety Checklist Before Delivery

- Open the exact share URL in a private browser window.
- Confirm the album title, cover, event order, and visible photo count.
- Confirm whether downloads are enabled or hidden.
- Confirm watermark behavior on public previews.
- Confirm passcode behavior if the link is private.
- Confirm person-specific links do not show unrelated people.
