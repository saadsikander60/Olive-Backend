import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import { uploadChatAttachment } from "../middleware/upload.js";
import {
  getMyConversation,
  getConversationMessages,
  sendUserMessage,
  markUserConversationRead,
  getAdminConversations,
  sendAdminMessage,
  markAdminConversationRead,
  getAdminUnreadTotal,
} from "../controllers/ChatController.js";

const router = express.Router();

const handleUpload = (req, res, next) => {
  uploadChatAttachment.single("attachment")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "File upload failed",
      });
    }
    next();
  });
};

// USER
router.get("/conversation", auth, getMyConversation);
router.get("/messages/:conversationId", auth, getConversationMessages);
router.post("/messages", auth, handleUpload, sendUserMessage);
router.put("/:conversationId/read", auth, markUserConversationRead);

// ADMIN
router.get("/admin/conversations", auth, admin, getAdminConversations);
router.get("/admin/unread-total", auth, admin, getAdminUnreadTotal);
router.get(
  "/admin/conversations/:conversationId/messages",
  auth,
  admin,
  getConversationMessages
);
router.post("/admin/messages", auth, admin, handleUpload, sendAdminMessage);
router.put(
  "/admin/conversations/:conversationId/read",
  auth,
  admin,
  markAdminConversationRead
);

export default router;
