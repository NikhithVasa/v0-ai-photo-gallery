import { NextRequest, NextResponse } from "next/server";
import { getCustomerSlugFromHost } from "@/lib/customer-host";

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
