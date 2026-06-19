import { NextResponse } from "next/server";

function logWrongApiPath(request: Request) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event: "saathidesk_wrong_path",
      requestId: request.headers.get("x-vercel-id"),
      method: request.method,
      path: new URL(request.url).pathname,
    }),
  );
}

async function handleWrongApiPath(request: Request) {
  logWrongApiPath(request);

  if (request.method === "HEAD") {
    return new Response(null, { status: 404 });
  }

  return NextResponse.json({ error: "API route not found" }, { status: 404 });
}

export {
  handleWrongApiPath as DELETE,
  handleWrongApiPath as GET,
  handleWrongApiPath as HEAD,
  handleWrongApiPath as OPTIONS,
  handleWrongApiPath as PATCH,
  handleWrongApiPath as POST,
  handleWrongApiPath as PUT,
};
