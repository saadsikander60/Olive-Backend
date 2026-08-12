import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "olive/products",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  }),
});

const categoryStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "olive/categories",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  }),
});

const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
    const isPdf = file.mimetype === "application/pdf";
    return {
      folder: "olive/chat",
      resource_type: isPdf ? "raw" : "image",
      allowed_formats: isPdf ? ["pdf"] : ["jpg", "jpeg", "png", "webp"],
    };
  },
});

const imageFilter = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, or WEBP images are allowed"));
  }
  cb(null, true);
};

const chatFilter = (_req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, WEBP, or PDF files are allowed"));
  }
  cb(null, true);
};

export const uploadProductImages = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const uploadCategoryImage = multer({
  storage: categoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const uploadChatAttachment = multer({
  storage: chatStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: chatFilter,
});

export default uploadProductImages;
