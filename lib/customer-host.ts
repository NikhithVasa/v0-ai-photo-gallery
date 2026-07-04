export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "saathidesk.com";

export function normalizeHost(host: string) {
  return host.split(":")[0].toLowerCase();
}

function stripLeadingWww(value: string) {
  return value.startsWith("www.") ? value.slice(4) : value;
}

export function getCustomerSlugFromHost(host: string) {
  const normalizedHost = stripLeadingWww(normalizeHost(host));

  if (normalizedHost === ROOT_DOMAIN) return null;

  const suffix = `.${ROOT_DOMAIN}`;

  if (!normalizedHost.endsWith(suffix)) return null;

  const subdomain = normalizedHost.slice(0, -suffix.length);

  if (!subdomain) return null;

  return stripLeadingWww(subdomain);
}

export function getCustomerSlugFromRequest(request: Request) {
  return getCustomerSlugFromHost(request.headers.get("host") || "");
}

export function customerPublicUrl(customerSlug: string) {
  return `https://${customerSlug}.${ROOT_DOMAIN}`;
}
