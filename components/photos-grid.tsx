Send this to the developer:

⸻

For mobile, I don’t want one photo per row. The reference is Pic-Time mobile gallery style: it shows a 2-column masonry grid, where photos keep their natural aspect ratio and stack tightly.

Current issue:

Right now mobile is showing one full-width photo per row, which makes the gallery feel too slow and empty. Users should be able to see more photos at once while scrolling.

Expected mobile behavior:

* Mobile should show 2 columns, not 1 column.
* Photos should keep their original aspect ratio.
* Do not crop the images.
* Use width: 100% and height: auto.
* Cards can have different heights.
* The grid should be tightly packed like a masonry layout.
* Only show small consistent gutters between photos.
* No large empty holes.
* No fixed-height tiles.
* No object-fit: cover for the main grid thumbnails.

Reference behavior:

On mobile, make it look like the Pic-Time reference: two vertical masonry columns, full photos visible, different image heights, tightly packed, with consistent spacing.

Implementation direction:

.mobile-gallery-grid {
  column-count: 2;
  column-gap: 3px;
}
.mobile-gallery-item {
  break-inside: avoid;
  margin-bottom: 3px;
  overflow: hidden;
}
.mobile-gallery-item img {
  width: 100%;
  height: auto;
  display: block;
}

Responsive rule:

@media (max-width: 768px) {
  .gallery-grid {
    column-count: 2;
    column-gap: 3px;
  }
  .gallery-item {
    break-inside: avoid;
    margin-bottom: 3px;
  }
  .gallery-item img {
    width: 100%;
    height: auto;
    display: block;
  }
}

You can phrase it like this:

For mobile, please don’t switch to one photo per row. I want a 2-column masonry layout like the Pic-Time reference screenshot. Each photo should show fully without cropping, so use natural image height instead of fixed-height tiles. The photos can have different heights, but they should stack tightly in two columns with small consistent gutters. This gives users a dense gallery browsing experience instead of making them scroll through one huge image at a time.