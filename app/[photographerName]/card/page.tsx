import { PhotographerCardPage } from "@/components/photographer-card-page";

interface PageProps {
  params: Promise<{ photographerName: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function prettyNameFromSlug(slug: string) {
  return toTitleCase(slug.replace(/-/g, " "));
}

export default async function PhotographerCardRoute({
  params,
  searchParams,
}: PageProps) {
  const { photographerName } = await params;
  const resolvedSearchParams = await searchParams;

  const displayName =
    firstParam(resolvedSearchParams.name)?.trim() ||
    prettyNameFromSlug(photographerName);
  const company =
    firstParam(resolvedSearchParams.company)?.trim() ||
    `${displayName} Studio`;
  const role =
    firstParam(resolvedSearchParams.role)?.trim() ||
    "Wedding and Event Photography";
  const email =
    firstParam(resolvedSearchParams.email)?.trim() ||
    `hello@${photographerName}.studio`;
  const phone = firstParam(resolvedSearchParams.phone)?.trim() || "+91 90000 00000";
  const website =
    firstParam(resolvedSearchParams.website)?.trim() ||
    `https://${photographerName}.studio`;
  const instagram =
    firstParam(resolvedSearchParams.instagram)?.trim() ||
    `@${photographerName}`;
  const mode = firstParam(resolvedSearchParams.mode);

  return (
    <PhotographerCardPage
      photographerSlug={photographerName}
      canEdit={mode !== "view"}
      initialProfile={{
        name: displayName,
        company,
        role,
        email,
        phone,
        website,
        instagram,
      }}
    />
  );
}
