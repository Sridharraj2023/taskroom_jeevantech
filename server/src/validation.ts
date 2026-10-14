import { z } from "zod";
export const credentials = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z
      .string()
      .min(10)
      .max(72)
      .refine(
        (v) => Buffer.byteLength(v, "utf8") <= 72,
        "Password must be at most 72 UTF-8 bytes",
      ),
  })
  .strict();
export const registration = credentials.extend({
  name: z.string().trim().min(2).max(80),
});
export const taskInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().max(2000).default(""),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
    owner_id: z.uuid().optional(),
  })
  .strict();
export const taskUpdate = taskInput.partial();
export const userUpdate = z
  .object({
    name: z.string().trim().min(2).max(80),
    role: z.enum(["ADMIN", "USER"]),
  })
  .strict();
export const idSchema = z.uuid();
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
