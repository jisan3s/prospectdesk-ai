import { z } from "zod";

export const outreachChannel = z.enum(["linkedin", "email"]);
export const outreachType = z.enum(["connection", "initial", "follow_up"]);

export const generateOutreachInput = z.object({
  companyId: z.uuid(),
  contactId: z.uuid().nullable(),
  channel: outreachChannel,
  messageType: outreachType,
  angle: z.string().trim().max(350),
}).strict().superRefine((v, ctx) => {
  if (v.channel === "email" && v.messageType === "connection") {
    ctx.addIssue({ code: "custom", message: "Email cannot be a connection request" });
  }
});

export const generatedOutreach = z.object({
  subject: z.string(),
  body: z.string(),
  personalization_facts: z.array(z.string()),
  cautions: z.array(z.string()),
}).strict();

export const editOutreachInput = z.object({
  body: z.string().trim().min(1).max(3000),
  subject: z.string().trim().max(180),
  revision: z.number().int().positive(),
}).strict();

export const transitionInput = z.object({
  action: z.enum(["submit", "approve", "reject", "revise", "sent"]),
  revision: z.number().int().positive(),
  confirmedManualSend: z.boolean().optional(),
}).strict();

export function validLength(channel: "linkedin" | "email", type: "connection" | "initial" | "follow_up", body: string) {
  const max = channel === "linkedin" ? (type === "connection" ? 280 : 1200) : 2200;
  return body.trim().length > 0 && body.length <= max;
}

export const nextStatus = {
  submit: "in_review",
  approve: "approved",
  reject: "rejected",
  revise: "draft",
  sent: "manually_sent",
} as const;
