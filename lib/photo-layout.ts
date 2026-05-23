interface PhotoShape {
  width?: number | null;
  height?: number | null;
}

export function photoAspectRatio(photo: PhotoShape) {
  if (!photo.width || !photo.height) return 4 / 3;
  return photo.width / photo.height;
}

export function photoFlexBasis(photo: PhotoShape, targetHeight = 340) {
  const ratio = photoAspectRatio(photo);
  return `calc(${ratio} * clamp(220px, 24vw, ${targetHeight}px))`;
}
