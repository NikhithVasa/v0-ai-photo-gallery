# Preset Marketplace and LUT Guide

This guide explains how to access the Preset Marketplace, create compatible LUT
files, upload presets, and apply presets to photos.

## Quick Links

Local development:

- Marketplace: [http://localhost:3000/presets](http://localhost:3000/presets)
- My Presets: [http://localhost:3000/presets/my](http://localhost:3000/presets/my)
- Upload Preset: [http://localhost:3000/presets/upload](http://localhost:3000/presets/upload)

Production:

- Marketplace: `https://saathidesk.com/presets`
- My Presets: `https://saathidesk.com/presets/my`
- Upload Preset: `https://saathidesk.com/presets/upload`

You must be signed in before accessing preset pages.

## Where to Find Presets

### From the account menu

1. Sign in.
2. Click your avatar in the top-right corner.
3. Choose one of:
   - **Preset Marketplace**
   - **My Presets**
   - **Upload Preset**

The avatar menu is available in album pages, Collage, and other authenticated
areas.

### From a single photo

1. Open an album.
2. Click a photo to open the full-screen viewer.
3. Click the **palette icon** in the photo toolbar.
4. Select a preset.
5. Adjust the intensity.
6. Compare **Original** and **Preview**.
7. Click **Apply and Create Edited Copy**.

The original photo is never overwritten.

### Apply a preset to multiple photos

1. Open an album.
2. Click **Select**.
3. Select the photos you want to edit.
4. Click **Apply Preset**.
5. Choose a preset and intensity.
6. Confirm the operation.
7. Keep the page open while the selected photos are processed.

An edited copy is created for every successfully processed photo.

## Marketplace Workflow

1. Open **Preset Marketplace**.
2. Search or filter by category.
3. Open **Preview** to inspect the before/after comparison.
4. Click **Save**.
5. The preset appears under **My Presets > Saved**.
6. Open a photo and use the palette icon to apply it.

Only presets you uploaded or saved appear in the photo editor preset library.

## What Is a LUT?

A LUT, or lookup table, maps input colors to output colors. It can create a
consistent global color style such as:

- Warm wedding colors
- Moody shadows
- Film-inspired tones
- Black-and-white looks
- Skin-tone color treatments
- Cinematic contrast

A LUT cannot reliably reproduce edits that depend on image position or image
content, including:

- Cropping or rotation
- Masks or local brush edits
- Subject/background selection
- Blur or sharpening
- Grain and texture overlays
- Object removal

For the best result, build LUTs from global color and tonal adjustments.

## Compatible LUT Requirements

| Requirement | Supported value |
| --- | --- |
| File format | `.cube` |
| LUT type | 3D LUT |
| LUT size | `LUT_3D_SIZE` from 2 through 65 |
| Maximum LUT file size | 25 MB |
| 1D LUT files | Not supported |
| Before preview | Required |
| After preview | Required |
| Preview formats | JPG, PNG, WebP, or AVIF |
| Maximum preview size | 15 MB per image |

Lightroom `.xmp` and `.lrtemplate` presets are not `.cube` LUT files and cannot
be uploaded directly.

## Create a LUT in Adobe Photoshop

Photoshop can export global adjustment layers as a color lookup table.

1. Open a representative photo in Photoshop.
2. Confirm the document uses **RGB Color** mode.
3. Make sure the document has a background layer.
4. Create the look using adjustment layers such as:
   - Curves
   - Color Balance
   - Selective Color
   - Hue/Saturation
   - Black & White
5. Avoid masks and spatial effects because LUTs cannot reproduce them.
6. Choose **File > Export > Color Lookup Tables**.
7. Select **CUBE** as the export format.
8. Use a grid size that produces a 3D LUT no larger than 65 points.
9. Export the `.cube` file.
10. Test the LUT on several different photos before uploading it.

Adobe documents the Photoshop export workflow here:

- [Export color lookup tables from Photoshop](https://helpx.adobe.com/photoshop/using/export-color-lookup-tables.html)

## Create a LUT in DaVinci Resolve

DaVinci Resolve is useful for creating and testing 3D `.cube` LUTs.

1. Import a representative photo or video clip.
2. Open the **Color** page.
3. Build the look using global color-grade nodes.
4. Avoid effects that depend on masks, tracking, grain, blur, or image position.
5. Right-click the graded clip thumbnail.
6. Choose **Generate LUT** and export a **33 Point Cube** LUT.
7. Save the generated `.cube` file.
8. Apply it to multiple test images to confirm the look is consistent.

Menu wording can vary slightly between Resolve versions. Blackmagic documents
Resolve LUT creation and current manuals through its support center:

- [Blackmagic Design Support Center](https://www.blackmagicdesign.com/support/)

## Create Good Preview Images

Every uploaded preset requires a before and after preview.

For the clearest marketplace listing:

1. Use the same source photo for both images.
2. Keep the same crop and dimensions.
3. Use the untouched photo as **Before**.
4. Apply the LUT at 100% and export it as **After**.
5. Use a photo that clearly demonstrates the preset's intended use.
6. Avoid adding unrelated edits to the after image.

Recommended preview subjects:

- Portrait presets: a portrait with visible skin tones
- Wedding presets: ceremony or couple portrait
- Outdoor presets: daylight landscape or portrait
- Indoor presets: mixed-light or reception image
- Black-and-white presets: an image with clear contrast and texture

## Upload a Preset

1. Open **Upload Preset** from the avatar menu or visit `/presets/upload`.
2. In **Upload file**, select the `.cube` LUT file.
3. In **Add details**, enter:
   - Preset name
   - Description
   - Category
   - Creator name
   - Tags
   - Best-use descriptions
4. In **Preview images**, upload the before and after images.
5. In **Visibility and publish**, choose:
   - **Private**: only you can access it.
   - **Public Marketplace**: signed-in users can discover and save it.
6. Confirm that you own the preset or have permission to share it.
7. Click **Publish Preset**.

The LUT file currently must be selected from the device file picker. Google
Drive and Google Photos import buttons are for importing images into the
existing upload pipeline, not for uploading LUT files.

## Test With an Identity LUT

An identity LUT is useful for testing the upload and apply workflow. It should
not visibly change the photo.

Create a text file named `identity-test.cube` with this content:

```text
TITLE "Identity Test"
LUT_3D_SIZE 2
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0

0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
```

Upload it as a private preset with any valid before and after preview images.

## Troubleshooting

### "This preset uses a 1D LUT"

Export a 3D `.cube` LUT instead. This application does not support
`LUT_1D_SIZE`.

### "This preset has an unsupported LUT size"

Export the LUT with a `LUT_3D_SIZE` between 2 and 65.

### "This preset file is incomplete or invalid"

The number of RGB entries does not match the declared LUT size. Re-export the
LUT from Photoshop, Resolve, or another trusted LUT creation tool.

### The preset does not appear in the photo editor

The photo editor shows presets that:

- You uploaded, or
- You saved from the public marketplace

Save the public preset first, then reopen the photo preset panel.

### The preview does not match the marketplace image

Marketplace preview images are uploaded by the preset creator. The photo editor
generates a real preview using the selected photo, LUT, and intensity.

### Applying a preset fails

Confirm that:

- You are signed in.
- You have access to the album.
- The source photo still exists.
- The preset is still available.
- Storage and database services are available.

The original photo remains unchanged when an apply operation fails.

## Current Behavior and Limitations

- Presets are applied as real 3D LUT transformations.
- Applied results are saved as new JPEG edited copies.
- The original photo is never overwritten.
- Single-photo and selected-photo batch apply are supported.
- Public and private presets are supported.
- Paid presets, preset packs, reviews, and creator profiles are not currently
  implemented.
