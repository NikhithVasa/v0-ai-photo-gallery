const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "saathidesk.com";

export function normalizeHost(host: string) {
  return host.split(":")[0].toLowerCase();
}

export function getCustomerSlugFromHost(host: string) {
  const normalizedHost = normalizeHost(host);

  if (normalizedHost === ROOT_DOMAIN) return null;
  if (normalizedHost === `www.${ROOT_DOMAIN}`) return null;

  const suffix = `.${ROOT_DOMAIN}`;

  if (!normalizedHost.endsWith(suffix)) return null;

  const subdomain = normalizedHost.slice(0, -suffix.length);

  if (!subdomain) return null;
  if (subdomain === "www") return null;

  return subdomain.startsWith("www.") ? subdomain.slice(4) : subdomain;
}

export function getCustomerSlugFromRequest(request: Request) {
  return getCustomerSlugFromHost(request.headers.get("host") || "");
}

export function customerPublicUrl(customerSlug: string) {
  return `https://www.${customerSlug}.${ROOT_DOMAIN}`;
}
