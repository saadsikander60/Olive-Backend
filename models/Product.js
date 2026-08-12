import mongoose from "mongoose";

export const SKIN_TYPES = [
  "All Skin Types",
  "Dry",
  "Oily",
  "Combination",
  "Sensitive",
  "Normal",
];

export const SKIN_CONCERNS = [
  "Acne",
  "Pigmentation",
  "Dryness",
  "Sensitive Skin",
  "Anti Aging",
  "Sun Protection",
];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 10000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    salePrice: {
      type: Number,
      min: 0,
      default: null,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    images: {
      type: [String],
      default: [],
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    brand: {
      type: String,
      trim: true,
      default: "",
    },
    size: {
      type: String,
      trim: true,
      default: "",
    },
    skinType: {
      type: String,
      enum: SKIN_TYPES,
      default: "All Skin Types",
    },
    skinConcern: {
      type: [String],
      enum: SKIN_CONCERNS,
      default: [],
    },
    keyIngredients: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    howToUse: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

productSchema.virtual("effectivePrice").get(function () {
  if (this.salePrice != null && this.salePrice < this.price) {
    return this.salePrice;
  }
  return this.price;
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

const Product = mongoose.model("Product", productSchema);
export default Product;
