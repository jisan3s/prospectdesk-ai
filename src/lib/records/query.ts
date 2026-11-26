import { z } from "zod";
export const recordsQuerySchema = z.object({
  search: z.string().trim().max(200).default(""),
  status: z.string().max(80).default(""),
  company: z.union([z.literal(""), z.uuid()]).default(""),
  channel: z.enum(["", "email", "linkedin"]).default(""),
  sort: z.enum(["newest", "oldest", "name", "score"]).default("newest"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type RecordsQuery = z.infer<typeof recordsQuerySchema>;
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
