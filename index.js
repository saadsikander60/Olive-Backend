import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import connectDB from "./config/db.js";
import { initSocket } from "./socket/socket.js";
import errorHandler from "./middleware/errorHandler.js";

import userRoutes from "./routes/UserRoutes.js";
import adminUserRoutes from "./routes/AdminUserRoutes.js";
import productRoutes from "./routes/ProductRoutes.js";
import categoryRoutes from "./routes/CategoryRoutes.js";
import cartRoutes from "./routes/CartRoutes.js";
import orderRoutes from "./routes/OrderRoutes.js";
import reviewRoutes from "./routes/ReviewRoutes.js";
import addressRoutes from "./routes/AddressRoutes.js";
import contactRoutes from "./routes/ContactRoutes.js";
import dashboardRoutes from "./routes/DashboardRoutes.js";
import chatRoutes from "./routes/ChatRoutes.js";

await connectDB();

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, try again later" },
});

app.use("/api/v1/users/login", authLimiter);
app.use("/api/v1/users/register", authLimiter);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Olive API is running",
  });
});

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/admin/users", adminUserRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/addresses", addressRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/chat", chatRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Olive server running on port ${PORT}`);
});
