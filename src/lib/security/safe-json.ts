/** Read and enforce a byte limit even when Content-Length is absent or dishonest. */
export async function readBoundedJson(request: Request, limitBytes = 16_000): Promise<unknown> {
  if (!request.body) throw new Error("Missing request body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let raw = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limitBytes) throw new Error("Request body too large");
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
