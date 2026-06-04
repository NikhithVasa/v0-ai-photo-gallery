import { CustomerAlbumsPage } from "@/components/customer-albums-page";
import { ProtectedRoute } from "@/components/protected-route";

interface Props {
  params: Promise<{ customerSlug: string }>;
}

export default async function CustomerPage({ params }: Props) {
  const { customerSlug } = await params;

  return (
    <ProtectedRoute>
      <CustomerAlbumsPage customerSlug={customerSlug} />
    </ProtectedRoute>
  );
}
