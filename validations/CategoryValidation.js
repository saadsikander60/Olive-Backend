import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    slug: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createCategorySchema.shape.body.partial(),
});
