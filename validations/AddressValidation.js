import { z } from "zod";
import { PAKISTAN_PROVINCES } from "../models/Address.js";

export const createAddressSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(7).max(20),
    addressLine1: z.string().trim().min(1).max(200),
    addressLine2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1).max(100),
    district: z.string().trim().max(100).optional(),
    province: z.enum(PAKISTAN_PROVINCES),
    postalCode: z.string().trim().max(20).optional(),
    landmark: z.string().trim().max(200).optional(),
    isDefault: z.boolean().optional(),
  }),
});

export const updateAddressSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createAddressSchema.shape.body.partial(),
});
