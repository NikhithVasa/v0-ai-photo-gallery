import { PresetDetailsPage } from "@/components/preset-details-page";
import { ProtectedRoute } from "@/components/protected-route";

interface Props {
  params: Promise<{ presetId: string }>;
}

export default async function PresetDetailsRoute({ params }: Props) {
  const { presetId } = await params;
  return (
    <ProtectedRoute>
      <PresetDetailsPage presetId={presetId} />
    </ProtectedRoute>
  );
}
