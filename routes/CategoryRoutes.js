import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import optionalAuth from "../middleware/optionalAuth.js";
import validate from "../middleware/validate.js";
import { uploadCategoryImage } from "../middleware/upload.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validations/CategoryValidation.js";
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/CategoryController.js";

const router = express.Router();

const handleUpload = (req, res, next) => {
  uploadCategoryImage.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Upload failed",
      });
    }
    next();
  });
};

router.get("/", optionalAuth, getCategories);
router.get("/:slug", getCategoryBySlug);
router.post(
  "/",
  auth,
  admin,
  handleUpload,
  validate(createCategorySchema),
  createCategory
);
router.put(
  "/:id",
  auth,
  admin,
  handleUpload,
  validate(updateCategorySchema),
  updateCategory
);
router.delete("/:id", auth, admin, deleteCategory);

export default router;
