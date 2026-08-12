import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import validate from "../middleware/validate.js";
import { adminUserStatusSchema } from "../validations/UserValidation.js";
import {
  listUsers,
  getUserById,
  updateUserStatus,
} from "../controllers/AdminUserController.js";

const router = express.Router();

router.use(auth, admin);

router.get("/", listUsers);
router.get("/:id", getUserById);
router.put("/:id/status", validate(adminUserStatusSchema), updateUserStatus);

export default router;
