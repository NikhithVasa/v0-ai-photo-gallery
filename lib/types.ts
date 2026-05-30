export interface AlbumCustomer {
  id: string;
  slug: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  passwordRequired?: boolean;
  coverPhotoUrl?: string | null;
}

export interface AlbumSummary {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  albumDate?: string | null;
  expiresAt?: string | null;
  isExpired?: boolean;
  passwordRequired: boolean;
  coverPhotoUrl: string | null;
  eventCount: number;
  photoCount: number;
  peopleCount: number;
  createdAt: string;
  customer?: AlbumCustomer | null;
}

export interface AlbumDetail {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  albumDate?: string | null;
  expiresAt?: string | null;
  isExpired?: boolean;
  passwordRequired: boolean;
  watermarkEnabled: boolean;
  events: AlbumEvent[];
  photoCount: number;
  peopleCount: number;
  customer?: AlbumCustomer | null;
  coverPhotoUrl?: string | null;
}

export interface AlbumEvent {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  photoCount: number;
  peopleCount: number;
}

export interface Person {
  id: string;
  albumId: string;
  personNumber: number;
  defaultName: string;
  displayName: string | null;
  photoCount: number;
  faceCount: number;
  occurrenceCount: number;
  coverFaceUrl: string | null;
  eventStats?: Array<{
    eventSlug: string;
    eventName: string;
    photoCount: number;
    faceCount: number;
  }>;
}

export interface PhotoPerson {
  id: string;
  personNumber: number;
  defaultName: string;
  displayName: string | null;
  photoCount: number;
  coverFaceUrl: string | null;
}

export interface Photo {
  id: string;
  albumId: string;
  albumSlug: string;
  eventId: string;
  eventSlug: string;
  eventName: string;
  fileName: string | null;
  caption: string | null;
  searchText: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
  width: number | null;
  height: number | null;
  personSearchText?: string | null;
  qwenDescription?: string | null;
  originalS3Key?: string | null;
  cleanPreviewS3Key?: string | null;
  watermarkedPreviewS3Key?: string | null;
  thumbnailS3Key?: string | null;
  annotatedS3Key?: string | null;
  people?: PhotoPerson[];
}

export interface SearchResult {
  photoId: string;
  albumSlug?: string;
  eventSlug?: string;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
  reason: string | null;
  score: number;
}
