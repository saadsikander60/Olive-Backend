import { z } from "zod";

export const createContactSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().toLowerCase(),
    phone: z.string().trim().max(20).optional(),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(5000),
  }),
});

export const updateContactStatusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    status: z.enum(["NEW", "READ", "RESOLVED"]),
  }),
});
