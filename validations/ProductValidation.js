import { z } from "zod";
import { SKIN_CONCERNS, SKIN_TYPES } from "../models/Product.js";

const skinTypeEnum = z.enum(SKIN_TYPES);
const skinConcernEnum = z.enum(SKIN_CONCERNS);

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(220).optional(),
    description: z.string().max(10000).optional(),
    price: z.coerce.number().min(0),
    salePrice: z.coerce.number().min(0).optional().nullable(),
    category: z.string().min(1),
    stock: z.coerce.number().int().min(0),
    sku: z.string().trim().optional(),
    brand: z.string().trim().optional(),
    size: z.string().trim().optional(),
    skinType: skinTypeEnum.optional(),
    skinConcern: z
      .union([z.array(skinConcernEnum), z.string()])
      .optional(),
    keyIngredients: z.string().max(5000).optional(),
    howToUse: z.string().max(5000).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    featured: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: createProductSchema.shape.body.partial(),
});
