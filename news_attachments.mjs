export const MAX_NEWS_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_NEWS_ATTACHMENTS = 4;

export const NEWS_ATTACHMENT_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf",
]);

export function validNewsAttachments(files) {
  return files.length <= MAX_NEWS_ATTACHMENTS && files.every((file) =>
    NEWS_ATTACHMENT_TYPES.has(file.type) &&
    Number.isSafeInteger(file.size) && file.size > 0 &&
    file.size <= MAX_NEWS_ATTACHMENT_BYTES);
}

export function cloudinaryNewsAttachmentUrl(value, type) {
  if (!NEWS_ATTACHMENT_TYPES.has(type)) return "";
  try {
    const url = new URL(value);
    const resource = type === "application/pdf" ? "raw" : "image";
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" &&
      url.pathname.startsWith(`/vpctonjf/${resource}/upload/`) ? url.href : "";
  } catch {
    return "";
  }
}
