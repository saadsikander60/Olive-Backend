import cloudinary from "../config/cloudinary.js";

export const deleteCloudinaryByUrl = async (url) => {
  if (!url || typeof url !== "string") return;

  try {
    // Expected: .../upload/v123/olive-xxx/folder/public_id.ext
    const parts = url.split("/");
    const uploadIdx = parts.findIndex((p) => p === "upload");
    if (uploadIdx === -1) return;

    let pathParts = parts.slice(uploadIdx + 1);
    // drop version segment v123456
    if (pathParts[0] && /^v\d+$/.test(pathParts[0])) {
      pathParts = pathParts.slice(1);
    }

    const last = pathParts[pathParts.length - 1] || "";
    pathParts[pathParts.length - 1] = last.replace(/\.[^/.]+$/, "");
    const publicId = pathParts.join("/");

    if (!publicId) return;

    const isRaw = url.includes("/raw/upload/");
    await cloudinary.uploader.destroy(publicId, {
      resource_type: isRaw ? "raw" : "image",
    });
  } catch (error) {
    console.error("Cloudinary delete failed:", error.message);
  }
};
