import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import { getDashboard } from "../controllers/DashboardController.js";

const router = express.Router();

router.get("/", auth, admin, getDashboard);

export default router;
