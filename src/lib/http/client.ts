import { z } from "zod";

const errorResponseSchema = z.object({ error: z.string().min(1) });

export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "HttpError";
  }
}

/** Read an API response once, preserve HTTP errors, and validate successful data. No retries. */
export async function requestJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = errorResponseSchema.safeParse(data);
    throw new HttpError(
      error.success ? error.data.error : `Request failed (${response.status})`,
      response.status,
    );
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpError("The service returned an unexpected response. Please try again.", response.status);
  }
  return parsed.data;
}

export function postJson<T>(url: string, schema: z.ZodType<T>, payload: unknown): Promise<T> {
  return requestJson(url, schema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
