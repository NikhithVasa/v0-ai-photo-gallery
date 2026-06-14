import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getCustomerSlugFromHost } from "@/lib/customer-host";

function isAssetOrApiPath(pathname: string) {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/opengraph-image" ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname === "/twitter-image" ||
    pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|map|txt|xml)$/)
  );
}

function isPublicPath(request: NextRequest, customerSlug: string | null) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/" && !customerSlug) return true;
  if (pathname === "/login" || pathname === "/auth/callback") return true;
  if (pathname.startsWith("/legal/") || pathname.startsWith("/share/")) return true;
  if (/^\/albums\/[^/]+$/.test(pathname)) return true;

  return (
    /^\/albums\/[^/]+(?:\/(?:culling|collage))?$/.test(pathname) &&
    Boolean(searchParams.get("share"))
  );
}

function shouldNoIndex(pathname: string, customerSlug: string | null) {
  if (customerSlug) return true;

  return (
    pathname === "/login" ||
    pathname === "/collage" ||
    pathname === "/settings" ||
    pathname === "/upload" ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/debug") ||
    pathname.startsWith("/albums") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/presets") ||
    pathname.startsWith("/share")
  );
}

function withRobotsHeader(
  response: NextResponse,
  pathname: string,
  customerSlug: string | null,
) {
  if (shouldNoIndex(pathname, customerSlug)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

function rewriteWithCookies(url: URL, response: NextResponse) {
  const rewriteResponse = NextResponse.rewrite(url);
  response.cookies.getAll().forEach((cookie) => rewriteResponse.cookies.set(cookie));
  return rewriteResponse;
}

async function hasSupabaseUser(request: NextRequest, response: NextResponse) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return false;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Boolean(user);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAssetOrApiPath(pathname)) {
    return withRobotsHeader(NextResponse.next(), pathname, null);
  }

  const host = request.headers.get("host") || "";
  const customerSlug = getCustomerSlugFromHost(host);
  const response = withRobotsHeader(
    NextResponse.next(),
    pathname,
    customerSlug,
  );

  if (!isPublicPath(request, customerSlug)) {
    const isAuthenticated = await hasSupabaseUser(request, response);

    if (!isAuthenticated) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set(
        "next",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );
      return withRobotsHeader(
        NextResponse.redirect(loginUrl),
        pathname,
        customerSlug,
      );
    }
  }

  if (!customerSlug) return response;

  const url = request.nextUrl.clone();

  if (pathname === "/") {
    url.pathname = `/customers/${customerSlug}`;
    return withRobotsHeader(
      rewriteWithCookies(url, response),
      pathname,
      customerSlug,
    );
  }

  if (pathname === "/customers") {
    url.pathname = `/customers/${customerSlug}`;
    return withRobotsHeader(
      rewriteWithCookies(url, response),
      pathname,
      customerSlug,
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
