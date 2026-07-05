# SaathiDesk Designer Photo Poster Brief

## What The Application Is

SaathiDesk is a private AI wedding and event gallery for photographers, studios, clients, and guests. It helps a studio upload an event, organize it into albums and event tabs, let AI process the photos, then deliver a polished gallery where guests can find the exact photos they care about without scrolling through hundreds or thousands of images.

The product is part client gallery, part AI discovery tool, and part photographer workflow system. The strongest message for a poster is simple:

> A private AI photo gallery where every face, moment, and memory is easy to find.

## Main Audiences

### Photographers and studios

- Create customers, albums, and event sections such as Haldi, Wedding, Reception, or Portraits.
- Upload large batches of photos from desktop, Google Drive, or Google Photos.
- Let processing build thumbnails, clean previews, watermarked previews, AI-ready files, face groups, searchable descriptions, and culling signals.
- Review the best images, manage duplicates, download selected sets, and share controlled client links.

### Clients and guests

- Open a private gallery link, optionally with a passcode.
- Browse a cinematic photo grid on mobile or desktop.
- Search by person, group, outfit, scene, decor, or moment.
- Upload a selfie or portrait to find themselves.
- Download photos when the studio allows it.

## Core Product Story

SaathiDesk turns a wedding gallery into a searchable memory system. Instead of asking guests to scroll endlessly, it lets them search the gallery by face, people group, visible details, event tab, and AI-generated scene meaning.

For a designer, the product should feel like a premium wedding delivery experience with practical AI built into the workflow. The AI should feel helpful and private, not futuristic for its own sake.

## AI-Powered Things In The App

### 1. Face Grouping And People Search

The app detects faces and groups repeated faces into People. Each person gets a face cover, a default person number, and can be renamed by the studio.

Design message:

- Find every guest faster.
- Browse photos by person.
- Rename people and make the gallery feel personal.
- Search one person, multiple people together, or only photos containing a chosen set.

Poster phrase:

> Find every smile in seconds.

### 2. Find Yourself

Guests can upload a selfie or portrait. The app compares it with the album and returns matching people or a closest matching photo.

Design message:

- Guests do not need to know their person number.
- A selfie can take them directly to their photos.
- This is useful for large weddings where guests may appear in a small part of the full album.

Poster phrase:

> Upload a selfie. Find your photos.

### 3. Group Search

Users can select multiple people and find photos where those people appear together. The gallery supports modes such as any selected person, all selected people together, or only the selected people.

Design message:

- Find family groups.
- Find couple moments.
- Find photos of friends together.
- Avoid scrolling through unrelated images.

Poster phrase:

> Search people together, not one by one.

### 4. SaathiDesk AI Search

The app has a SaathiDesk AI search panel for natural-language photo search. It can search across people, names, event tabs, captions, scene descriptions, clothing, decor, emotions, and visible details.

Examples the app is designed around:

- `Kavya jewelry`
- `photos of person 1 on stage`
- `bride jewelry`
- `family portrait`
- `floral decorations`
- `traditional attire`
- `photos of Kavya and Shramik`

Under the hood, the app supports semantic search using OpenRouter Gemini embeddings and pgvector. If semantic search is unavailable, it can fall back to keyword and person search.

Important accuracy note for designers: Ask AI currently returns matching photos. It should not be described as a chatbot that writes full analysis answers. Avoid claims like “Ask who wore the most jewelry and get an answer.” A safer claim is:

> Search moments, outfits, people, scenes, and details.

### 5. AI Culling Review

The culling page helps the studio review and select photos using AI scores and clusters.

It includes review lanes for:

- All photos
- Needs review
- Low score
- Duplicates
- Photo type or tag
- Best by person

AI signals include album score, clarity score, background score, gaze direction, people count, tags, problem reasons, and written AI analysis. The studio can keep, reject, auto-select the top 100, inspect alternates, set the best image in a duplicate cluster, and download selected photos.

Design message:

- AI helps the photographer assemble a stronger delivery set.
- The photographer stays in control.
- Duplicate and low-quality images become easier to review.

Poster phrase:

> Cull faster. Deliver stronger galleries.

### 6. Best-By-Person Review

The AI culling workflow can group recommended photos by person. This helps make sure important guests or family members have good images in the final delivery.

Design message:

- Make the gallery feel complete for every important person.
- See the best photos per face group.
- Useful for wedding families, VIP guests, and couple-focused edits.

Poster phrase:

> Give every important face its best frame.

### 7. Video Person Search And Timelines

The app supports album videos. A studio can upload videos into an album event, then run video face AI.

The video AI can:

- Search for selected known album people inside a video.
- Use uploaded selfie target images.
- Discover unknown people in the video.
- Create a timeline of detected face matches.
- Show match intervals with timestamps.
- Filter the timeline by a specific person or target face.
- Jump directly to the matching part of the video.
- Share a video timeline link with anyone who has album access.

Design message:

- Video becomes searchable by person.
- Guests and studios can jump to the moments where someone appears.
- The timeline is visual, with face chips and match counts.

Poster phrase:

> Find people inside videos, then jump to the moment.

### 8. AI Photo Edits And Preset Finishing

The app includes AI edit surfaces and preset/LUT workflows. A studio can create edited copies without overwriting the original photo. Presets can be uploaded, saved, previewed, and applied to single photos or selected batches.

Design message:

- Original files stay intact.
- AI and presets help finish photos for delivery.
- Studios can keep a consistent visual style.

Poster phrase:

> Finish photos without touching the original.

## Gallery Sharing And Delivery

Sharing is a major part of the product. The studio can create gallery links and people-specific links with client controls.

### Album Share Links

The studio can create a private gallery link and control:

- Passcode
- Expiration date
- Allow downloads
- Hide AI features
- Gallery background color
- Watermark on or off
- Watermark text
- Full-photo or corner watermark mode
- Watermark corner positions
- Copy link
- Copy ready-to-send client message
- Preview link
- Delete link

Design message:

- The photographer controls access, downloads, watermarks, and presentation.
- The shared gallery can be client-safe and brand-safe.

Poster phrase:

> Share beautifully. Control everything.

### People Share Links

The studio can create a link for one person or selected people. These links can show only that person, only that group, or the relevant people across events.

Controls include:

- Shared link name
- Only them toggle
- Background color
- Allow downloads
- Watermark
- Event tabs on or off
- Passcode
- Expiration date

Design message:

- Send a bride, groom, family member, or guest a focused gallery of just their photos.
- Great for VIP handoffs and guest-specific sharing.

Poster phrase:

> Send each guest their own gallery.

### Shared Gallery AI Guide

When AI features are available in a shared gallery, the app can introduce guests to People Search, Find Yourself, Group Search, Only Them, and SaathiDesk AI.

Design message:

- Guests should understand search quickly.
- AI should feel approachable, not technical.

## Non-AI Features Designers Should Know

- Customer pages for studios and clients.
- Album creation and event organization.
- Desktop upload plus Google Drive and Google Photos import.
- Upload progress, retry states, and processing status.
- Masonry-style photo gallery.
- Full-screen photo viewer.
- Photo downloads in original, PNG, or JPEG where allowed.
- Selected-photo downloads and filtered-people downloads.
- Album/event/customer cover management.
- Collage builder for keepsake exports.
- Preset marketplace and LUT-based finishing workflow.
- Storage cost visibility for customers.

## Privacy And Trust Message

The in-product privacy message says:

> AI runs on our local machine. Photos, prompts, and metadata are not used for training or any other activities.

This should be treated as a trust badge or secondary poster message. It is especially important because the product handles private family events.

Good poster wording:

- Private AI for personal galleries.
- Your photos stay yours.
- AI search without training on your memories.
- Built for private wedding delivery.

## Poster Copy Bank

### Main Headline Options

- SaathiDesk
- Private AI Wedding Galleries
- Every Face, Moment, And Memory. Findable.
- The Wedding Gallery That Knows Where The Moment Is.
- Find Yourself In The Celebration.
- AI Search For Wedding Photos And Videos.
- Deliver Galleries Guests Can Actually Search.

### Short Supporting Lines

- Search by face, outfit, scene, event, or moment.
- Upload a selfie and jump to your photos.
- Find families, friends, couples, and groups together.
- Cull duplicates, low-score images, and best-by-person sets faster.
- Turn long event videos into person-aware timelines.
- Share private galleries with passcodes, watermarks, and download controls.

### Feature Callouts

- People Search
- Find Yourself
- Group Search
- Only Them
- SaathiDesk AI Search
- AI Culling Review
- Best By Person
- Video Face Timeline
- Private Share Links
- Watermarked Client Galleries
- Guest-Specific Gallery Links

### Button Or Badge Text

- Search moments
- Find your photos
- Share gallery
- Run AI
- Review best photos
- Open video timeline
- Download selected
- Private link
- Watermark protected

## Suggested Poster Structure

### Option A: Client-Facing Poster

Headline:

> Find yourself in every celebration.

Support:

> Open your private gallery, search by face or moment, and download the photos your photographer allows.

Visuals to show:

- A premium wedding gallery grid.
- A selfie upload or Find Yourself card.
- Circular people avatars.
- Search examples such as `bride jewelry`, `family portrait`, or `friends on stage`.
- A private/passcode badge.

### Option B: Photographer-Facing Poster

Headline:

> Deliver smarter wedding galleries.

Support:

> Upload events, let AI group faces and describe moments, cull faster, and share controlled client galleries.

Visuals to show:

- Upload and processing status.
- AI culling review with scores.
- Share settings for watermark, passcode, downloads, and expiration.
- A gallery preview on phone and desktop.

### Option C: AI Feature Poster

Headline:

> Search photos and videos by person, scene, and moment.

Support:

> SaathiDesk AI helps guests find themselves, helps studios review the best photos, and turns videos into searchable timelines.

Visuals to show:

- People chips and group search.
- Search panel with natural-language examples.
- Video timeline with face markers.
- Culling cards with Keep and Reject actions.

## Visual Direction For Designers

- Premium wedding editorial, not generic AI tech.
- Use real gallery images, wedding details, faces, hands, jewelry, stage, family groups, and video timeline fragments.
- Keep the tone warm, private, polished, and useful.
- AI elements should look like quiet tools: search bars, face chips, timeline markers, scores, and trust badges.
- Avoid sci-fi robots, glowing brains, generic circuit graphics, or exaggerated “magic AI” visuals.
- Show both mobile and desktop because guests use phones and studios often work on larger screens.
- Use trust signals: passcode, watermark, private link, no-training message.

## Claims To Avoid

- Do not say the AI can answer any question about the album.
- Do not say it writes full wedding summaries.
- Do not say it ranks people with final answers such as “who wore the most jewelry.”
- Do not imply downloads are always available. Downloads depend on studio share settings.
- Do not imply public galleries. The product is positioned around private sharing.

## Best One-Line Summary

> SaathiDesk is a private AI-powered photo and video gallery that helps wedding studios deliver searchable, shareable, and beautifully controlled client albums.