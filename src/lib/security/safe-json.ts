export class RequestBodyError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "RequestBodyError"; }
}

/** Bound bytes and read time, including chunked requests without Content-Length. */
export async function readBoundedJson(request: Request, limitBytes = 16_000, timeoutMs = 10_000, allowEmpty = false): Promise<unknown> {
  if (!request.body) {
    if (allowEmpty) return undefined;
    throw new RequestBodyError("Missing request body", 400);
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let raw = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestBodyError("Request body timed out", 408)), timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > limitBytes) throw new RequestBodyError("Request body too large", 413);
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    if (!raw.length && allowEmpty) return undefined;
    return JSON.parse(raw);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
