import { headers } from "next/headers";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ notFound: string[] }>;
}

export default async function WrongPathPage({ params }: Props) {
  const [{ notFound: pathSegments }, requestHeaders] = await Promise.all([
    params,
    headers(),
  ]);

  console.warn(
    JSON.stringify({
      level: "warn",
      event: "saathidesk_wrong_path",
      requestId: requestHeaders.get("x-vercel-id"),
      method: "GET",
      path: `/${pathSegments.join("/")}`,
    }),
  );

  notFound();
}
