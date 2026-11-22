import "server-only";
import OpenAI from "openai";

/** Keep per-workflow timeouts while sharing the no-retry provider configuration. */
export function createScoutClient(timeout = 25_000) {
  if (!process.env.OPENAI_API_KEY) throw new Error("Missing OpenAI API key");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout, maxRetries: 0 });
}

export function scoutModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}
