# Photographer UX Audit: Upload, Event Management, and Sharing

Date: June 13, 2026

## Scope and Method

This review focused on the photographer/admin flow for creating customers, creating albums, managing events, uploading photos, AI processing, sharing, and client viewing. I reviewed the route structure, major page components, responsive Tailwind class patterns, auth/share gates, and local server behavior.

Limitations: the in-app browser connector was not available in this session, and protected routes redirect to `/login` without a session, so mobile/desktop conclusions are based on code-level layout behavior rather than live visual interaction inside an authenticated browser.

## North Star

A photographer should be able to open an album, select or confirm an event, click `Add Photos`, upload, see processing status, and move directly to `View`, `Share`, or `Upload More` without discovering hidden controls or understanding internal event-management terminology.

## Dev Summary

The immediate fix is to stop using `Manage Events` as the upload entry point. `Add Photos` should become the primary album action. Upload should open with album/event destination already selected when possible, followed by upload controls. Cover, delete, and AI tools should move below upload or into secondary sections.

## App Flow Understood

The product has two audiences:

- Public/client-facing: `/`, `/login`, `/share/[token]`, and public album access via `/albums/[albumSlug]?share=...` or passcode.
- Photographer/admin-facing: `/customers`, `/customers/new`, `/customers/[customerSlug]`, `/albums`, `/albums/new`, `/albums/[albumSlug]`, `/albums/[albumSlug]/events/new`, `/upload`, `/albums/[albumSlug]/culling`, `/albums/[albumSlug]/collage`, `/settings`, and preset pages.

The primary photographer path is:

1. Create or open a customer.
2. Add an album for that customer.
3. Define initial event tabs during album creation.
4. Open the album gallery.
5. Use the album gallery to filter by event, view people/photos, share, download, review AI, create collages, or select photos.
6. Use “Manage Events” to create events, add photos to an existing event, update cover photo, delete event/photos, and run AI actions.

The important finding is that step 6 is not only event management. It is the main operational workspace for upload and event maintenance, but it is labeled and placed as a secondary event-chip action.

## Design Decode

The UI language is consistent: off-white backgrounds, soft borders, rounded pills, glassy sticky headers, photo-forward cards, hidden horizontal scrollbars, and compact icon+text controls. This works well for a premium gallery feel.

The same visual language is weaker for admin tasks because operational controls compete with gallery controls. In the album nav, “Select,” “Share,” “AI Review,” “Collage,” download, Photos/People, Search, account, and event chips all sit near each other. The photographer has to infer which controls are viewing tools versus management tools.

Code evidence:

- The album gallery places “Manage Events” at the end of the mobile event chip rail and desktop event chip rail, after the event filters, styled as another low-emphasis pill: [album-gallery-page.tsx](/Users/bruno/git/v0-ai-photo-gallery/components/album-gallery-page.tsx:2559) and [album-gallery-page.tsx](/Users/bruno/git/v0-ai-photo-gallery/components/album-gallery-page.tsx:2822).
- The main desktop action row already contains many competing controls before the event rail: [album-gallery-page.tsx](/Users/bruno/git/v0-ai-photo-gallery/components/album-gallery-page.tsx:2663).
- The manage page opens with a large cover/title hero before the upload/destination controls: [add-event-page.tsx](/Users/bruno/git/v0-ai-photo-gallery/components/add-event-page.tsx:1183).
- The upload target and event selector are in the right-side aside, below destination summary: [add-event-page.tsx](/Users/bruno/git/v0-ai-photo-gallery/components/add-event-page.tsx:1292).
- There is also a separate `/upload` experience with a clearer explicit destination panel: [upload-page.tsx](/Users/bruno/git/v0-ai-photo-gallery/components/upload-page.tsx:816).

## Current vs Recommended Snapshot

| Area | Current | Recommended |
| --- | --- | --- |
| Upload entry | Hidden under `Manage Events` at the end of event chips | Primary `Add Photos` CTA in admin header/mobile bottom bar |
| Upload first view | Cover/title hero dominates | Destination confirmation and upload area first |
| Event selector | Small side-card selector | Top destination bar plus compact side stats |
| Event mistakes | Delete/reupload is the obvious fallback | `Move selected photos to event` |
| Mobile admin actions | Mixed into hidden-scroll event rails/floating buttons | Persistent admin bottom bar: Photos, People, Add, Share, More |
| Share confidence | Share settings exist, but preview boundary is implicit | `Preview as Client` before sending link |
| AI state | Processing banners and AI Review exist, but status is fragmented | Album/event-level processing readiness indicators |

## Implementation Phases

### Phase 1: Fix Upload Discoverability

Build this first:

1. Add visible `Add Photos`.
2. Pass selected event context into upload.
3. Show destination bar before upload.
4. Push cover, AI, and delete controls below upload.
5. Add post-upload next actions.

### Phase 2: Improve Event Management

- Rename `Manage Events` to `Edit Events`.
- Add event rename, reorder, delete, event cover, metadata, and move-photo workflows.
- Add `Move selected photos to event` in photo selection mode.

### Phase 3: Improve Sharing and Client Confidence

- Add `Preview as Client`.
- Clarify share access, passcode, downloads, expiration, and watermark state.
- Ensure admin controls are never visible in client/share mode.

### Phase 4: Improve AI Readiness and Status

- Add album/event-level processing readiness.
- Keep advanced AI actions secondary.
- Make pending/failed AI states actionable without crowding upload.

## Priority Recommendations

### P0: Rename and Reposition the Entry Point

Current label: “Manage Events”

Recommended primary label: “Add Photos”

Recommended secondary label: “Edit Events”

Reason: the user’s real intent is usually “upload photos to this album/event,” not “manage event metadata.” The current label hides upload, cover, deletion, and AI operations behind a narrow concept.

Desktop placement:

- Add a primary `Add Photos` button in the album sticky header action group, visually near `Share` and before advanced tools like `AI Review` and `Collage`.
- Keep a smaller `Edit Events` action at the end of the event chip row or in `More` for users specifically managing event tabs.
- Suggested action order: `Add Photos` primary, `Share`, `Download`, `Search`, then an overflow menu for `AI Review`, `Collage`, and advanced tools.

Mobile placement:

- Add a persistent bottom action button or bottom sheet trigger labeled `Add Photos`.
- Keep event chips for filtering only. Do not rely on a horizontally scrolling hidden-scrollbar chip row as the only route to upload/manage.

### P0: Make Upload Start With Destination and Files, Not Cover

After clicking the current “Manage Events,” the first screen reads as cover/title editing because the hero is large and the cover action is overlaid at the bottom. The actual upload area and event selector are below or off to the side.

Recommended structure:

1. Header: `Add photos to album`
2. Destination bar: Album name, event selector, `New event` option
3. Main upload dropzone/grid
4. Secondary panel: cover photo, AI processing, delete/archive tools

Cover upload should remain available, but it should not dominate the first viewport unless the user explicitly chooses “Edit cover.”

### P0: Default to the Selected Event When Entering From an Event

If a photographer is viewing `Reception` in the album and clicks upload/manage, the next screen should default to “Existing event: Reception.”

Recommended behavior:

- Pass the selected event into the manage/upload route.
- Open the page in `Existing event` mode when an event was selected.
- Use `New event` only when the photographer clicked a clear `+ New Event` action.

This removes the need for users to discover the small “Upload target” switch before they can upload to an existing event.

### P0: Promote the Event Selector Into a Destination Bar

The existing small side selector is efficient for desktop, but it is not strong enough as the core decision point. It answers “where will photos go?” only after the user notices it.

Recommended desktop design:

- Keep the selector compact, but move it into a full-width destination bar above the upload area.
- Format it as: `Destination: [Album] / [Event select] [New event]`
- Show counts next to selected event, but keep delete event in an overflow/destructive area.

Recommended mobile design:

- Put destination selection before upload controls.
- Use a native select or drawer. Avoid burying it below cover or AI sections.

### P0: Use a Canonical Album Upload Route

The app should not ask the team or users to choose between `/upload` and `/albums/[slug]/events/new` for the same core task.

Recommended route decision:

```text
Add Photos:
/albums/[albumSlug]/upload?event=[eventSlug]

Edit Events:
/albums/[albumSlug]/events
```

Use the upload route for destination, file selection, upload confirmation, processing options, and post-upload next actions. Use the events route only for rename, reorder, delete, event cover, event metadata, and moving photos between events.

### P1: Split “Event Management” From “Upload Photos”

The current `AddEventPage` handles event creation, existing-event upload, cover update, event delete, photo delete, and AI actions. That is powerful but cognitively dense.

Recommended IA:

- `Add Photos`: upload to existing or new event.
- `Events`: rename, reorder, delete, event cover, event metadata.
- `AI Processing`: advanced section or overflow menu.

This does not require separate routes immediately; it can be tabs or sections on one page. The key is making the first task obvious.

### P1: Treat Upload as a Guided Workflow

The current manager behaves like a dense workspace. For photographers, upload should feel guided and mistake-proof.

Recommended flow:

1. Choose or confirm destination: album and event.
2. Add photos: device, Google Drive, or Google Photos.
3. Confirm before upload: show photo count and destination.
4. Choose processing options: run AI, captions, thumbnails/search.
5. Show progress and post-upload next actions.

Confirmation copy should be explicit:

```text
You are uploading 320 photos to:
Kavya Wedding / Reception

[Change Event] [Start Upload]
```

Post-upload actions should continue the workflow:

```text
Upload complete

[View Reception Photos] [Run AI Processing] [Share Album] [Upload More]
```

### P1: Add “Move Selected Photos to Event”

Photographers will sometimes upload to the wrong event. The UX should make that recoverable without deleting and re-uploading.

Recommended placement:

- In photo selection mode, add `Move to Event` next to selected-photo actions.
- In event management, support moving photos between events.
- In lightbox or bulk selection, keep the destination selector simple: `Move 24 photos to [Reception]`.

This should be treated as core event-management behavior, not an advanced admin edge case.

Expected data behavior:

- Moving photos should update the photo/event relationship only.
- It should not duplicate S3 objects or require re-uploading files.
- It should refresh event counts and any event-scoped AI/person stats.

### P1: Add a Photographer Workspace Navigation Pattern

The account avatar menu currently contains presets/settings/logout, but not `Customers`, `Albums`, or `Upload photos`: [auth-avatar-menu.tsx](/Users/bruno/git/v0-ai-photo-gallery/components/auth-avatar-menu.tsx:62).

Recommended:

- Add global entries: `Customers`, `Albums`, `Add Photos`.
- In album pages, add a breadcrumb/back target: `Customers > Customer > Album`.
- This gives users recovery paths without depending on the browser back button.

### P1: Keep Client Gallery Beauty, But Add Admin Mode Clarity

The album page is visually successful as a client gallery. For photographers, the same page needs an admin mode distinction.

Recommended:

- Add a subtle admin toolbar only for signed-in photographers.
- Put admin actions there: `Add Photos`, `Share`, `Settings`, `More`.
- Keep client viewing actions in the gallery controls.

This reduces confusion between “viewing the gallery” and “working on the gallery.”

### P2: Add Client Preview and Stronger Share Clarity

Because the app has both photographer/admin and public/client modes, the photographer needs a clear way to validate the client experience.

Recommended:

- Add `Preview as Client` near `Share`.
- In share settings, make access outcomes explicit: link access, passcode, downloads, expiration, watermark, and which client-facing tabs/features are visible.
- After share settings are saved, provide `Copy link` and `Preview as Client` as paired next actions.

### P2: Make the Admin/Client Boundary Explicit

Only signed-in photographers should see:

- `Add Photos`
- `Edit Events`
- AI processing controls
- `Move to Event`
- Delete actions
- Share settings
- Album/customer settings

Clients should only see:

- Photos
- People, if enabled
- Search, if enabled
- Download, if enabled
- Share-safe photo interactions

This matters because the same album component supports public share and photographer/admin viewing.

### P2: Surface Album/Event AI Readiness

AI is part of the product value, but readiness is scattered across banners, review screens, and processing actions.

Recommended album/event indicators:

```text
Reception
420 photos
Faces indexed: 380 / 420
Captions generated: 310 / 420
Search ready: 300 / 420
```

This should be summary status, not another dense control panel.

### P2: Add an Admin Summary Strip Before Building a Full Dashboard

A full photographer dashboard could help, but it is larger product work and risks duplicating the album gallery. Start with a compact admin summary strip inside the album page instead.

Recommended first version:

```text
Kavya Wedding
[Add Photos] [Share Album] [Edit Events] [More]

1,240 photos · 4 events · AI 82% ready · Share link active
```

If that proves useful, it can grow into a dedicated dashboard later.

### P2: Add Complete Empty, Error, and Pending States

Recommended states:

```text
Empty album
No photos yet
[Add Photos]

No events
Create your first event before uploading
[Create Event]

Upload failed
12 of 300 photos failed
[Retry Failed] [Download Error Report]

AI pending
Photos uploaded. AI processing has not started.
[Run AI Processing]
```

These states should be actionable and should lead to the next expected photographer task.

### P2: Reduce Hidden Horizontal Scroll Risk

Several critical controls live in horizontally scrollable rails with hidden scrollbars. This is elegant but risky for discoverability, especially on mobile.

Recommended:

- Put primary actions outside horizontal chip rails.
- Let event chips remain scrollable filters.
- Use visible overflow affordance or a `More` button when action count exceeds width.

### P2: Clean Up Legacy Upload Entry Points

There are two upload models:

- `/upload`: explicit album/event destination panel.
- `/albums/[slug]/events/new`: rich event manager/uploader with cover and AI tools.

Recommended:

- Make `/albums/[albumSlug]/upload?event=[eventSlug]` the canonical visible upload experience.
- Redirect or de-emphasize `/upload` unless it remains useful as an internal/global utility.
- Replace `/albums/[slug]/events/new` as an upload destination with an event-edit route.
- Borrow the explicit destination clarity from the current `/upload` screen.

## Direct Answers to Current Concerns

### “Manage event is hard to find. Where should it go?”

Do not make “Manage Events” the main upload entry. Add a primary `Add Photos` button in the album header action group. Keep `Edit Events` at the end of the event chip row or inside `More` as a secondary event-edit affordance.

### “After clicking manage event I see upload/update cover photo and have to scroll to realize I can upload photos.”

The page hierarchy is inverted. Upload destination and upload area should be first. Cover should become secondary.

### “Selecting the event is embedded in a small section. Is there a better way?”

Yes. The compact selector is good as a control, but the destination decision is too important to live in a side card only. Promote it to a destination bar above upload, and keep the side card for counts/settings.

### “Consider mobile view.”

Mobile needs a persistent `Add Photos` entry that is not hidden in the event rail. The upload screen should show destination first, then upload. AI actions, delete event, and cover update should be below upload or behind accordions/drawers.

## Suggested Ticket Breakdown

Recommended implementation order:

1. Add visible `Add Photos`.
2. Pass selected event context into upload/manage.
3. Move destination selection above upload.
4. Move cover, AI, and delete controls below upload or into secondary sections.
5. Add upload confirmation and post-upload next actions.
6. Add selected-photo `Move to Event`.
7. Add client preview and clearer share settings.
8. Add album/event AI readiness summaries.
9. Redirect or de-emphasize legacy upload/event-manager entry points after the canonical route is in place.

## Wireframes

### Album Header: Photographer View

```text
Kavya Wedding
1,240 photos · 4 events · AI 82% ready · Share link active

[Add Photos] [Share] [Edit Events] [More]

Event filters:
All | Haldi | Reception | Wedding
```

### Mobile Album Admin Bar

```text
[Photos] [People] [+ Add] [Share] [More]

+ Add opens bottom sheet:
- Add photos to current event
- Add photos to another event
- Create new event
```

### Upload Page

```text
Add Photos

Destination
Album: Kavya Wedding
Event: Reception v

Upload
[Drop photos here]

Options
[ ] Run AI after upload
[ ] Generate captions

[Start Upload]
```

## Acceptance Criteria for First Tickets

### Ticket 1: Add Primary `Add Photos` CTA

- Desktop album header shows `Add Photos` without horizontal scrolling.
- Mobile shows `Add Photos` without relying on the event chip rail.
- Clicking `Add Photos` passes `albumSlug`.
- If an event is selected, the target route also receives `eventSlug`.
- Existing event editing remains available as `Edit Events`.

### Ticket 2: Default Upload to Selected Event

- From `All`, upload asks the user to choose or create an event.
- From a selected event, upload defaults to `Existing event` with that event selected.
- The selected destination is visible before the file picker/dropzone.
- The URL can be refreshed without losing the album/event context.

### Ticket 3: Destination Bar and Guided Upload

- Upload page first viewport shows destination and upload controls before cover or AI controls.
- User sees album/event and selected photo count before starting upload.
- User must confirm destination before upload starts for multi-photo batches.
- After upload, user sees `View Event Photos`, `Run AI`, `Share Album`, and `Upload More`.

### Ticket 4: Move Selected Photos to Event

- Photo selection mode includes `Move to Event`.
- User can choose an event destination from a simple selector.
- Confirmation states photo count and destination event.
- Moved photos disappear from the old event filter and appear in the new event filter after refresh.

### Ticket 5: Client Preview and Share Clarity

- Share dialog includes a `Preview as Client` action.
- Preview opens without admin-only controls.
- Share settings clearly show download, watermark, expiration, and access/passcode state.
- After saving share settings, `Copy link` and `Preview as Client` are both visible.

## Overall Conclusion

The core UX problem is not visual polish. It is information architecture and workflow confidence. The app has a strong gallery presentation, but photographer tasks are hidden inside gallery controls and an overloaded event manager. The highest-impact change is to make `Add Photos` a first-class primary action, make destination selection unmistakable, and make upload a guided, recoverable workflow with clear next steps.
