import { NextRequest, NextResponse } from "next/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "saathidesk.com";

function normalizeHost(host: string) {
  return host.split(":")[0].toLowerCase();
}

function isAssetOrApiPath(pathname: string) {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|map|txt|xml)$/)
  );
}

function getCustomerSlugFromHost(host: string) {
  const normalizedHost = normalizeHost(host);

  if (normalizedHost === ROOT_DOMAIN) return null;
  if (normalizedHost === `www.${ROOT_DOMAIN}`) return null;

  const suffix = `.${ROOT_DOMAIN}`;

  if (!normalizedHost.endsWith(suffix)) return null;

  const subdomain = normalizedHost.slice(0, -suffix.length);

  if (!subdomain) return null;
  if (subdomain === "www") return null;

  return subdomain;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAssetOrApiPath(pathname)) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") || "";
  const customerSlug = getCustomerSlugFromHost(host);

  if (!customerSlug) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();

  if (pathname === "/") {
    url.pathname = `/customers/${customerSlug}`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/customers") {
    url.pathname = `/customers/${customerSlug}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};