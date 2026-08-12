import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { emitToAdmins, emitToUser } from "../socket/socket.js";

const SENDER_SAFE = "firstName lastName email role";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const populateMessage = (query) => query.populate("sender", SENDER_SAFE);

const formatConversation = (conversation) => {
  if (!conversation) return null;
  return conversation.toObject ? conversation.toObject() : conversation;
};

const getOrCreateUserConversation = async (userId) => {
  let conversation = await Conversation.findOne({ user: userId }).populate(
    "user",
    SENDER_SAFE
  );

  if (!conversation) {
    conversation = await Conversation.create({
      user: userId,
      lastMessage: "",
      lastMessageAt: new Date(),
      unreadForUser: 0,
      unreadForAdmin: 0,
    });
    conversation = await Conversation.findById(conversation._id).populate(
      "user",
      SENDER_SAFE
    );
  }

  return conversation;
};

const assertConversationAccess = (conversation, reqUser) => {
  if (!conversation) {
    return { ok: false, status: 404, message: "Conversation not found" };
  }

  const ownerId = conversation.user?._id
    ? conversation.user._id.toString()
    : conversation.user.toString();

  if (reqUser.role === "ADMIN") return { ok: true, ownerId };

  if (ownerId !== reqUser._id.toString()) {
    return { ok: false, status: 403, message: "Access denied" };
  }

  return { ok: true, ownerId };
};

const emitMessageEvents = ({ message, conversation, ownerUserId }) => {
  const payload = {
    message,
    conversation: formatConversation(conversation),
  };

  emitToUser(ownerUserId, "chat:message:new", payload);
  emitToAdmins("chat:message:new", payload);
  emitToUser(ownerUserId, "chat:conversation:update", {
    conversation: formatConversation(conversation),
  });
  emitToAdmins("chat:conversation:update", {
    conversation: formatConversation(conversation),
  });
  emitToUser(ownerUserId, "chat:unread:update", {
    unreadForUser: conversation.unreadForUser,
    conversationId: conversation._id,
  });
  emitToAdmins("chat:unread:update", {
    conversationId: conversation._id,
    unreadForAdmin: conversation.unreadForAdmin,
  });
};

const createMessageRecord = async ({
  conversation,
  sender,
  text,
  messageType = "TEXT",
  attachment = null,
}) => {
  const cleanText = (text || "").trim();

  if (messageType === "TEXT" && !cleanText) {
    throw new Error("Message text is required");
  }

  if (cleanText.length > 4000) {
    throw new Error("Message is too long");
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: sender._id,
    senderRole: sender.role,
    text: cleanText,
    messageType,
    attachment: attachment || {
      url: "",
      fileName: "",
      mimeType: "",
      size: 0,
    },
    deliveredAt: new Date(),
  });

  const preview =
    messageType === "TEXT"
      ? cleanText
      : messageType === "IMAGE"
        ? "Image"
        : `Attachment: ${attachment?.fileName || "file"}`;

  conversation.lastMessage = preview.slice(0, 200);
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessageSender = sender._id;

  if (sender.role === "USER") {
    conversation.unreadForAdmin = (conversation.unreadForAdmin || 0) + 1;
  } else {
    conversation.unreadForUser = (conversation.unreadForUser || 0) + 1;
  }

  await conversation.save();

  const populatedMessage = await populateMessage(Message.findById(message._id));
  const populatedConversation = await Conversation.findById(conversation._id)
    .populate("user", SENDER_SAFE)
    .populate("lastMessageSender", SENDER_SAFE);

  return { message: populatedMessage, conversation: populatedConversation };
};

export const getMyConversation = async (req, res, next) => {
  try {
    if (req.user.role === "ADMIN") {
      return res.status(400).json({
        success: false,
        message: "Admins should use admin chat endpoints",
      });
    }

    const conversation = await getOrCreateUserConversation(req.user._id);
    return res.status(200).json({
      success: true,
      message: "Conversation fetched",
      data: { conversation },
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversation id" });
    }

    const conversation = await Conversation.findById(conversationId).populate(
      "user",
      SENDER_SAFE
    );
    const access = assertConversationAccess(conversation, req.user);
    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      populateMessage(
        Message.find({ conversation: conversationId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
      ),
      Message.countDocuments({ conversation: conversationId }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Messages fetched",
      data: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        messages: messages.reverse(),
        conversation,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const sendUserMessage = async (req, res, next) => {
  try {
    if (req.user.role === "ADMIN") {
      return res.status(400).json({
        success: false,
        message: "Use admin message endpoint",
      });
    }

    const conversation = await getOrCreateUserConversation(req.user._id);
    let messageType = "TEXT";
    let attachment = null;
    const text = req.body.text || "";

    if (req.file) {
      const isImage = req.file.mimetype?.startsWith("image/");
      messageType = isImage ? "IMAGE" : "FILE";
      attachment = {
        url: req.file.path,
        fileName: req.file.originalname || "attachment",
        mimeType: req.file.mimetype || "",
        size: req.file.size || 0,
      };
    }

    const result = await createMessageRecord({
      conversation,
      sender: req.user,
      text,
      messageType,
      attachment,
    });

    emitMessageEvents({
      message: result.message,
      conversation: result.conversation,
      ownerUserId: req.user._id.toString(),
    });

    return res.status(201).json({
      success: true,
      message: "Message sent",
      data: {
        message: result.message,
        conversation: result.conversation,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const markUserConversationRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversation id" });
    }

    const conversation = await Conversation.findById(conversationId).populate(
      "user",
      SENDER_SAFE
    );
    const access = assertConversationAccess(conversation, req.user);
    if (!access.ok) {
      return res.status(access.status).json({
        success: false,
        message: access.message,
      });
    }

    if (req.user.role !== "USER") {
      return res.status(403).json({
        success: false,
        message: "Only users can mark their chat as read here",
      });
    }

    conversation.unreadForUser = 0;
    await conversation.save();

    await Message.updateMany(
      { conversation: conversationId, senderRole: "ADMIN", seenAt: null },
      { seenAt: new Date() }
    );

    emitToUser(access.ownerId, "chat:seen", {
      conversationId,
      readerRole: "USER",
    });
    emitToAdmins("chat:seen", { conversationId, readerRole: "USER" });
    emitToUser(access.ownerId, "chat:unread:update", {
      conversationId,
      unreadForUser: 0,
    });

    return res.status(200).json({
      success: true,
      message: "Conversation marked as read",
      data: { conversation },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminConversations = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const filter = {};

    if (search) {
      const users = await User.find({
        role: "USER",
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      filter.user = { $in: users.map((u) => u._id) };
    }

    const [conversations, total, unreadTotal] = await Promise.all([
      Conversation.find(filter)
        .populate("user", SENDER_SAFE)
        .populate("lastMessageSender", SENDER_SAFE)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(filter),
      Conversation.aggregate([
        { $group: { _id: null, total: { $sum: "$unreadForAdmin" } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      message: "Conversations fetched",
      data: {
        conversations,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        unreadTotal: unreadTotal[0]?.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const sendAdminMessage = async (req, res, next) => {
  try {
    const conversationId = req.body.conversationId;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Valid conversationId is required",
      });
    }

    const conversation = await Conversation.findById(conversationId).populate(
      "user",
      SENDER_SAFE
    );
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    let messageType = "TEXT";
    let attachment = null;
    const text = req.body.text || "";

    if (req.file) {
      const isImage = req.file.mimetype?.startsWith("image/");
      messageType = isImage ? "IMAGE" : "FILE";
      attachment = {
        url: req.file.path,
        fileName: req.file.originalname || "attachment",
        mimeType: req.file.mimetype || "",
        size: req.file.size || 0,
      };
    }

    const result = await createMessageRecord({
      conversation,
      sender: req.user,
      text,
      messageType,
      attachment,
    });

    const ownerUserId = conversation.user._id.toString();
    emitMessageEvents({
      message: result.message,
      conversation: result.conversation,
      ownerUserId,
    });

    return res.status(201).json({
      success: true,
      message: "Message sent",
      data: {
        message: result.message,
        conversation: result.conversation,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const markAdminConversationRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversation id" });
    }

    const conversation = await Conversation.findById(conversationId).populate(
      "user",
      SENDER_SAFE
    );
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    conversation.unreadForAdmin = 0;
    await conversation.save();

    await Message.updateMany(
      { conversation: conversationId, senderRole: "USER", seenAt: null },
      { seenAt: new Date() }
    );

    const ownerUserId = conversation.user._id.toString();
    emitToUser(ownerUserId, "chat:seen", {
      conversationId,
      readerRole: "ADMIN",
    });
    emitToAdmins("chat:seen", { conversationId, readerRole: "ADMIN" });
    emitToAdmins("chat:unread:update", {
      conversationId,
      unreadForAdmin: 0,
    });

    return res.status(200).json({
      success: true,
      message: "Conversation marked as read",
      data: { conversation },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUnreadTotal = async (req, res, next) => {
  try {
    const result = await Conversation.aggregate([
      { $group: { _id: null, total: { $sum: "$unreadForAdmin" } } },
    ]);

    return res.status(200).json({
      success: true,
      message: "Unread total",
      data: { unreadTotal: result[0]?.total || 0 },
    });
  } catch (error) {
    next(error);
  }
};
