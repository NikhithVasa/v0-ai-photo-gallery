export interface Preset {
  id: string;
  name: string;
  description: string | null;
  creatorName: string;
  category: string;
  tags: string[];
  bestFor: string[];
  visibility: "private" | "public";
  status: string;
  lutSize: number;
  previewBeforeUrl: string | null;
  previewAfterUrl: string | null;
  saveCount: number;
  isSaved: boolean;
  isOwner: boolean;
  createdAt: string;
}
