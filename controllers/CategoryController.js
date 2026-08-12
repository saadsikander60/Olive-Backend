import Category from "../models/Category.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";
import slugify from "../utils/slugify.js";
import { deleteCloudinaryByUrl } from "../utils/deleteCloudinary.js";

export const getCategories = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    else if (!req.user || req.user.role !== "ADMIN") filter.status = "ACTIVE";

    const categories = await Category.find(filter).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      message: "Categories fetched",
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Category fetched",
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const name = req.body.name;
    let slug = req.body.slug ? slugify(req.body.slug) : slugify(name);

    const exists = await Category.findOne({ slug });
    if (exists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const category = await Category.create({
      name,
      slug,
      description: req.body.description || "",
      status: req.body.status || "ACTIVE",
      image: req.file?.path || "",
    });

    return res.status(201).json({
      success: true,
      message: "Category created",
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (req.body.name !== undefined) category.name = req.body.name;
    if (req.body.description !== undefined) category.description = req.body.description;
    if (req.body.status !== undefined) category.status = req.body.status;

    if (req.body.slug) {
      category.slug = slugify(req.body.slug);
    } else if (req.body.name) {
      category.slug = slugify(req.body.name);
    }

    if (req.file?.path) {
      const old = category.image;
      category.image = req.file.path;
      if (old && old !== category.image) await deleteCloudinaryByUrl(old);
    }

    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated",
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const productsCount = await Product.countDocuments({ category: req.params.id });
    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with products. Move or delete products first.",
      });
    }

    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (category.image) await deleteCloudinaryByUrl(category.image);

    return res.status(200).json({
      success: true,
      message: "Category deleted",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};
