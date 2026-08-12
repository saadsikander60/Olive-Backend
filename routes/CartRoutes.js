import express from "express";
import auth from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  addToCartSchema,
  updateCartItemSchema,
} from "../validations/CartValidation.js";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/CartController.js";

const router = express.Router();

router.use(auth);

router.get("/", getCart);
router.post("/", validate(addToCartSchema), addToCart);
router.put("/:productId", validate(updateCartItemSchema), updateCartItem);
router.delete("/:productId", removeCartItem);
router.delete("/", clearCart);

export default router;
