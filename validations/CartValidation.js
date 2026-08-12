import { z } from "zod";

export const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(100).default(1),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({ productId: z.string().min(1) }),
  body: z.object({
    quantity: z.coerce.number().int().min(1).max(100),
  }),
});
