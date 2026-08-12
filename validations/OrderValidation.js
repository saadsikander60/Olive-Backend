import { z } from "zod";

export const createOrderSchema = z.object({
  body: z.object({
    addressId: z.string().min(1).optional(),
    shippingAddress: z
      .object({
        fullName: z.string().trim().min(1),
        phone: z.string().trim().min(7),
        addressLine1: z.string().trim().min(1),
        addressLine2: z.string().optional(),
        city: z.string().trim().min(1),
        district: z.string().optional(),
        province: z.string().trim().min(1),
        postalCode: z.string().optional(),
        landmark: z.string().optional(),
      })
      .optional(),
    paymentMethod: z
      .enum(["COD", "JazzCash", "EasyPaisa", "Bank Transfer"])
      .default("COD"),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    orderStatus: z
      .enum([
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ])
      .optional(),
    paymentStatus: z
      .enum(["PENDING", "PAID", "FAILED", "REFUNDED"])
      .optional(),
  }),
});
