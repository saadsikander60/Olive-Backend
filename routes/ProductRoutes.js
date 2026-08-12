import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import optionalAuth from "../middleware/optionalAuth.js";
import validate from "../middleware/validate.js";
import { uploadProductImages } from "../middleware/upload.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../validations/ProductValidation.js";
import {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/ProductController.js";

const router = express.Router();

const handleUpload = (req, res, next) => {
  uploadProductImages.array("images", 8)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Upload failed",
      });
    }
    next();
  });
};

router.get("/", optionalAuth, getProducts);
router.get("/:slug", optionalAuth, getProductBySlug);
router.post(
  "/",
  auth,
  admin,
  handleUpload,
  validate(createProductSchema),
  createProduct
);
router.put(
  "/:id",
  auth,
  admin,
  handleUpload,
  validate(updateProductSchema),
  updateProduct
);
router.delete("/:id", auth, admin, deleteProduct);

export default router;
