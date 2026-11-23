// Used only by scripts/run-final-review.mjs in its synthetic environment.
if (process.env.LOCAL_SERVICE_DOUBLE !== "1") throw new Error("Provider preload requires the isolated test environment.");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.hostname === "api.tavily.com") {
    return originalFetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/tavily/search`, {
      method: request.method, headers: request.headers, body: await request.text(), signal: request.signal,
    });
  }
  if (url.hostname === "api.openai.com" || url.hostname.endsWith(".supabase.co")) {
    throw new Error("External data/provider traffic is blocked in the isolated test run.");
  }
  return originalFetch(input, init);
};
