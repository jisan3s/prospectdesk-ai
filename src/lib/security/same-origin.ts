/** Use the incoming authority: Next.js can reconstruct request.url with an internal host. */
export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Preserve authenticated API clients without a browser Origin header.
  try {
    const expected = new URL(request.url);
    const host = request.headers.get("host");
    if (host) expected.host = host;
    return origin === expected.origin;
  } catch {
    return false;
  }
}
