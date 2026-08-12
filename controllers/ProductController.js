import Product from "../models/Product.js";
import Category from "../models/Category.js";
import mongoose from "mongoose";
import slugify from "../utils/slugify.js";
import { deleteCloudinaryByUrl } from "../utils/deleteCloudinary.js";

const parseSkinConcern = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // comma-separated
  }
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const parseFeatured = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  return value === "true" || value === true;
};

export const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};

    const isAdmin = req.user?.role === "ADMIN";
    if (!isAdmin) filter.status = "ACTIVE";
    else if (req.query.status) filter.status = req.query.status;

    if (req.query.search) {
      const q = String(req.query.search).trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
      ];
    }

    if (req.query.category) {
      if (mongoose.Types.ObjectId.isValid(req.query.category)) {
        filter.category = req.query.category;
      } else {
        const cat = await Category.findOne({ slug: req.query.category });
        if (cat) filter.category = cat._id;
        else filter.category = null;
      }
    }

    if (req.query.featured !== undefined) {
      filter.featured = parseFeatured(req.query.featured);
    }

    if (req.query.skinType) filter.skinType = req.query.skinType;
    if (req.query.skinConcern) filter.skinConcern = req.query.skinConcern;

    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
    }

    if (req.query.inStock === "true") filter.stock = { $gt: 0 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Products fetched",
      data: {
        products,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).populate(
      "category",
      "name slug"
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (product.status !== "ACTIVE" && req.user?.role !== "ADMIN") {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched",
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const name = req.body.name;
    let slug = req.body.slug ? slugify(req.body.slug) : slugify(name);

    const exists = await Product.findOne({ slug });
    if (exists) slug = `${slug}-${Date.now().toString(36)}`;

    if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
      return res.status(400).json({ success: false, message: "Invalid category" });
    }

    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(400).json({ success: false, message: "Category not found" });
    }

    const images = (req.files || []).map((f) => f.path);

    const product = await Product.create({
      name,
      slug,
      description: req.body.description || "",
      price: Number(req.body.price),
      salePrice:
        req.body.salePrice === "" || req.body.salePrice == null
          ? null
          : Number(req.body.salePrice),
      category: req.body.category,
      images,
      stock: Number(req.body.stock),
      sku: req.body.sku || undefined,
      brand: req.body.brand || "",
      size: req.body.size || "",
      skinType: req.body.skinType || "All Skin Types",
      skinConcern: parseSkinConcern(req.body.skinConcern),
      keyIngredients: req.body.keyIngredients || "",
      howToUse: req.body.howToUse || "",
      status: req.body.status || "ACTIVE",
      featured: parseFeatured(req.body.featured) || false,
    });

    const populated = await Product.findById(product._id).populate(
      "category",
      "name slug"
    );

    return res.status(201).json({
      success: true,
      message: "Product created",
      data: { product: populated },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const fields = [
      "name",
      "description",
      "price",
      "salePrice",
      "stock",
      "sku",
      "brand",
      "size",
      "skinType",
      "keyIngredients",
      "howToUse",
      "status",
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (field === "salePrice" && (req.body[field] === "" || req.body[field] == null)) {
          product.salePrice = null;
        } else if (["price", "salePrice", "stock"].includes(field)) {
          product[field] = Number(req.body[field]);
        } else {
          product[field] = req.body[field];
        }
      }
    }

    if (req.body.featured !== undefined) {
      product.featured = parseFeatured(req.body.featured);
    }

    if (req.body.skinConcern !== undefined) {
      product.skinConcern = parseSkinConcern(req.body.skinConcern);
    }

    if (req.body.category) {
      if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
        return res.status(400).json({ success: false, message: "Invalid category" });
      }
      product.category = req.body.category;
    }

    if (req.body.slug) product.slug = slugify(req.body.slug);
    else if (req.body.name) product.slug = slugify(req.body.name);

    if (req.files?.length) {
      const newImages = req.files.map((f) => f.path);
      const oldImages = [...product.images];
      product.images = [...product.images, ...newImages];
      // optional: if replaceAllImages flag
      if (req.body.replaceImages === "true") {
        product.images = newImages;
        for (const url of oldImages) await deleteCloudinaryByUrl(url);
      }
    }

    await product.save();

    const populated = await Product.findById(product._id).populate(
      "category",
      "name slug"
    );

    return res.status(200).json({
      success: true,
      message: "Product updated",
      data: { product: populated },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    for (const url of product.images || []) {
      await deleteCloudinaryByUrl(url);
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};
