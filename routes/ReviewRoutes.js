import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import validate from "../middleware/validate.js";
import {
  createReviewSchema,
  updateReviewSchema,
} from "../validations/ReviewValidation.js";
import {
  createReview,
  getProductReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  getAdminReviews,
} from "../controllers/ReviewController.js";

const router = express.Router();

router.get("/product/:productId", getProductReviews);
router.get("/my-reviews", auth, getMyReviews);
router.get("/admin", auth, admin, getAdminReviews);
router.post("/", auth, validate(createReviewSchema), createReview);
router.put("/:id", auth, validate(updateReviewSchema), updateReview);
router.delete("/:id", auth, deleteReview);

export default router;
