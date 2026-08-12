import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import User from "../models/User.js";

let ioInstance = null;

export const getIO = () => ioInstance;

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) return next(new Error("Authentication required"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");

      if (!user) return next(new Error("User not found"));
      if (user.status === "INACTIVE") return next(new Error("Account inactive"));

      socket.user = {
        id: user._id.toString(),
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      };

      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    const role = socket.user.role;

    socket.join(`user:${userId}`);
    if (role === "ADMIN") socket.join("admins");

    socket.emit("chat:connected", { userId, role });

    socket.on("chat:typing", (payload = {}) => {
      const conversationId = payload.conversationId;
      if (!conversationId) return;

      if (role === "ADMIN") {
        const targetUserId = payload.userId;
        if (!targetUserId) return;
        io.to(`user:${targetUserId}`).emit("chat:typing", {
          conversationId,
          userId,
          role,
          name: `${socket.user.firstName} ${socket.user.lastName}`.trim(),
        });
      } else {
        io.to("admins").emit("chat:typing", {
          conversationId,
          userId,
          role,
          name: `${socket.user.firstName} ${socket.user.lastName}`.trim(),
        });
      }
    });

    socket.on("chat:typing:stop", (payload = {}) => {
      const conversationId = payload.conversationId;
      if (!conversationId) return;

      if (role === "ADMIN") {
        const targetUserId = payload.userId;
        if (!targetUserId) return;
        io.to(`user:${targetUserId}`).emit("chat:typing:stop", {
          conversationId,
          userId,
          role,
        });
      } else {
        io.to("admins").emit("chat:typing:stop", {
          conversationId,
          userId,
          role,
        });
      }
    });
  });

  ioInstance = io;
  return io;
};

export const emitToUser = (userId, event, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
};

export const emitToAdmins = (event, payload) => {
  if (!ioInstance) return;
  ioInstance.to("admins").emit(event, payload);
};
