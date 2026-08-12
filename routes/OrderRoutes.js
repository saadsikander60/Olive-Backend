import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import validate from "../middleware/validate.js";
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "../validations/OrderValidation.js";
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAdminOrders,
  updateOrderStatus,
} from "../controllers/OrderController.js";

const router = express.Router();

router.post("/", auth, validate(createOrderSchema), createOrder);
router.get("/my-orders", auth, getMyOrders);
router.get("/", auth, admin, getAdminOrders);
router.get("/:id", auth, getOrderById);
router.put(
  "/:id/status",
  auth,
  admin,
  validate(updateOrderStatusSchema),
  updateOrderStatus
);

export default router;
