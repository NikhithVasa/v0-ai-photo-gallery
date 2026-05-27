import { CustomerAlbumsPage } from "@/components/customer-albums-page";

interface Props {
  params: Promise<{ customerSlug: string }>;
}

export default async function CustomerPage({ params }: Props) {
  const { customerSlug } = await params;

  return <CustomerAlbumsPage customerSlug={customerSlug} />;
}