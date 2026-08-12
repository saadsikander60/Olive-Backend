import express from "express";
import auth from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
} from "../validations/UserValidation.js";
import {
  register,
  login,
  getMe,
  updateMe,
} from "../controllers/UserController.js";

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.get("/me", auth, getMe);
router.put("/me", auth, validate(updateProfileSchema), updateMe);

export default router;
