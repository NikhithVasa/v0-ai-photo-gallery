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
  photoSortMode: PhotoSortMode;
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
  photoSortMode: PhotoSortMode;
  photoCount: number;
  peopleCount: number;
}

export type PhotoSortMode =
  | "title_asc"
  | "title_desc"
  | "added_newest"
  | "added_oldest"
  | "original_newest"
  | "original_oldest"
  | "rating"
  | "custom";

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
  createdAt?: string | null;
  originalDate?: string | null;
  rating?: number | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
  width: number | null;
  height: number | null;
  personSearchText?: string | null;
  qwenDescription?: string | null;
  originalS3Key?: string | null;
  aiInputS3Key?: string | null;
  cleanPreviewS3Key?: string | null;
  watermarkedPreviewS3Key?: string | null;
  thumbnailS3Key?: string | null;
  annotatedS3Key?: string | null;
  customSortOrder?: number | null;
  people?: PhotoPerson[];
}

export interface PhotoAiAnalysis {
  albumScore: number | null;
  clarityScore: number | null;
  backgroundScore: number | null;
  cameraGaze: string | null;
  decorationKeywords: string | null;
  reason: string | null;
  qwenStatus: string | null;
  peopleCount: number | null;
  qwenJson: Record<string, unknown> | null;
}

export interface AiReviewPhoto {
  photo: Photo;
  ai: PhotoAiAnalysis;
  problemReasons?: string[];
}

export interface AiReviewPersonGroup {
  person: Person;
  photos: AiReviewPhoto[];
}

export interface CullingScore {
  overallScore: number | null;
  technicalScore: number | null;
  faceScore: number | null;
  gazeScore: number | null;
  reason: string | null;
}

export interface CullingClusterPhoto {
  id: string;
  fileName: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  thumbnailS3Key: string | null;
  cleanPreviewS3Key: string | null;
  watermarkedPreviewS3Key: string | null;
}

export interface CullingCluster {
  clusterId: string;
  albumSlug: string;
  eventSlug: string;
  clusterType: string | null;
  bestPhotoId: string | null;
  similarCount: number;
  score: number | null;
  reason: string | null;
  scoreReason: string | null;
  scoreDetails: CullingScore;
  photo: CullingClusterPhoto | null;
}

export interface CullingClusterItem {
  clusterId: string;
  photoId: string;
  rankInCluster: number;
  isBest: boolean;
  similarityScore: number | null;
  qualityScore: number | null;
  reason: string | null;
  scoreReason: string | null;
  scoreDetails: CullingScore;
  photo: CullingClusterPhoto;
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

export interface AlbumShareSettings {
  token?: string;
  albumSlug?: string;
  albumName?: string;
  customerName?: string | null;
  expiresAt?: string | null;
  backgroundColor?: string;
  passcode?: string | null;
  passcodeRequired?: boolean;
  personId?: string | null;
  personName?: string | null;
  linkName?: string | null;
  onlyPerson?: boolean;
  allowEventTabs?: boolean;
  hideAi?: boolean;
  allowDownloads: boolean;
  watermarkEnabled: boolean;
  watermarkText: string | null;
  watermarkMode: "full" | "corners";
  watermarkPositions: string[];
}
