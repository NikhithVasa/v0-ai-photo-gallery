import { dbErrorResponse } from "@/lib/db";

export function handleDbRouteError(error: unknown, fallbackMessage: string) {
  const dbResponse = dbErrorResponse(error);
  if (dbResponse) return dbResponse;

  console.error(fallbackMessage, error);
  return Response.json({ error: fallbackMessage }, { status: 500 });
}
