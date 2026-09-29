import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudinaryNewsAttachmentUrl,
  validNewsAttachments,
} from "./news_attachments.mjs";

test("写真とPDFの添付数・容量・形式を制限する", () => {
  assert.equal(validNewsAttachments([]), true);
  assert.equal(validNewsAttachments([{ type: "image/jpeg", size: 1024 }, { type: "application/pdf", size: 5000000 }]), true);
  assert.equal(validNewsAttachments(Array(5).fill({ type: "image/png", size: 100 })), false);
  assert.equal(validNewsAttachments([{ type: "image/png", size: 0 }]), false);
  assert.equal(validNewsAttachments([{ type: "application/pdf", size: 5 * 1024 * 1024 + 1 }]), false);
  assert.equal(validNewsAttachments([{ type: "text/html", size: 100 }]), false);
});

test("Cloudinaryの所定アカウント・形式のURLだけを表示する", () => {
  assert.equal(cloudinaryNewsAttachmentUrl("https://res.cloudinary.com/vpctonjf/image/upload/v1/photo.jpg", "image/jpeg"), "https://res.cloudinary.com/vpctonjf/image/upload/v1/photo.jpg");
  assert.equal(cloudinaryNewsAttachmentUrl("https://res.cloudinary.com/vpctonjf/raw/upload/v1/file.pdf", "application/pdf"), "https://res.cloudinary.com/vpctonjf/raw/upload/v1/file.pdf");
  assert.equal(cloudinaryNewsAttachmentUrl("javascript:alert(1)", "image/jpeg"), "");
  assert.equal(cloudinaryNewsAttachmentUrl("https://res.cloudinary.com.evil.example/vpctonjf/raw/upload/file.pdf", "application/pdf"), "");
  assert.equal(cloudinaryNewsAttachmentUrl("https://res.cloudinary.com/other/raw/upload/file.pdf", "application/pdf"), "");
  assert.equal(cloudinaryNewsAttachmentUrl("https://res.cloudinary.com/vpctonjf/image/upload/file.pdf", "application/pdf"), "");
});
