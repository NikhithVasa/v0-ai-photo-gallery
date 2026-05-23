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
