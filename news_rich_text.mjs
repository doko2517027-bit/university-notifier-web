const ALLOWED_TAGS = new Set([
  "B",
  "BR",
  "DIV",
  "FONT",
  "P",
  "SPAN",
  "STRONG",
  "U",
]);

const ALLOWED_FONT_SIZES = new Set(["12px", "14px", "16px", "18px", "20px", "24px"]);
const ALLOWED_FONT_FAMILIES = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "ui-rounded",
]);

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function validColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) || /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(color)
    ? color
    : "";
}

function normalizeFontFamily(value) {
  const family = String(value || "")
    .replace(/["']/g, "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (family.includes("mono")) return "monospace";
  if (family.includes("serif") && !family.includes("sans")) return "serif";
  if (family.includes("rounded")) return "ui-rounded";
  return ALLOWED_FONT_FAMILIES.has(family) ? family : "sans-serif";
}

function sanitizeStyle(element) {
  const declarations = [];
  const sourceStyle = String(element.getAttribute("style") || "");
  for (const declaration of sourceStyle.split(";")) {
    const [rawName, ...rawValue] = declaration.split(":");
    const name = String(rawName || "").trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (name === "color") {
      const color = validColor(value);
      if (color) declarations.push(`color:${color}`);
    } else if (name === "font-size" && ALLOWED_FONT_SIZES.has(value)) {
      declarations.push(`font-size:${value}`);
    } else if (name === "font-family") {
      declarations.push(`font-family:${normalizeFontFamily(value)}`);
    } else if (name === "font-weight" && /^(bold|700|800|900)$/.test(value)) {
      declarations.push("font-weight:700");
    } else if (name === "text-decoration" && value.toLowerCase().includes("underline")) {
      declarations.push("text-decoration:underline");
    }
  }

  if (element.tagName === "FONT") {
    const color = validColor(element.getAttribute("color"));
    if (color) declarations.push(`color:${color}`);
    const sizeMap = { "1": "12px", "2": "14px", "3": "16px", "4": "18px", "5": "20px", "6": "24px" };
    const size = sizeMap[String(element.getAttribute("size") || "")];
    if (size) declarations.push(`font-size:${size}`);
    const face = element.getAttribute("face");
    if (face) declarations.push(`font-family:${normalizeFontFamily(face)}`);
  }

  return [...new Set(declarations)].join(";");
}

export function richNewsHtmlFromText(text) {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

export function sanitizeRichNewsHtml(html, ownerDocument = globalThis.document) {
  if (!ownerDocument?.createElement) return richNewsHtmlFromText(String(html || ""));
  const template = ownerDocument.createElement("template");
  template.innerHTML = String(html || "").slice(0, 30000);

  const cleanNode = (node) => {
    if (node.nodeType === 3) return;
    if (node.nodeType !== 1) {
      node.remove();
      return;
    }
    const element = node;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"].includes(element.tagName)) {
      element.remove();
      return;
    }
    [...element.childNodes].forEach(cleanNode);
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const style = sanitizeStyle(element);
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
    if (style) element.setAttribute("style", style);
  };

  [...template.content.childNodes].forEach(cleanNode);
  return template.innerHTML;
}

export function getRichNewsEditorText(editor) {
  return String(editor?.innerText || "").replace(/\u00a0/g, " ").trim();
}

export function setRichNewsEditorContent(editor, bodyHtml, fallbackText = "") {
  if (!editor) return;
  editor.innerHTML = sanitizeRichNewsHtml(bodyHtml || richNewsHtmlFromText(fallbackText), editor.ownerDocument);
}

export function getRichNewsEditorHtml(editor) {
  if (!editor) return "";
  return sanitizeRichNewsHtml(editor.innerHTML, editor.ownerDocument);
}

export function applyRichNewsCommand(editor, command, value = null) {
  if (!editor?.ownerDocument) return false;
  editor.focus();
  const documentObject = editor.ownerDocument;
  try {
    if (command === "fontSize") {
      const sizeMap = { "12px": "1", "14px": "2", "16px": "3", "18px": "4", "20px": "5", "24px": "6" };
      return documentObject.execCommand("fontSize", false, sizeMap[value] || "3");
    }
    if (command === "fontName") {
      return documentObject.execCommand("fontName", false, normalizeFontFamily(value));
    }
    return documentObject.execCommand(command, false, value);
  } catch (error) {
    console.error("お知らせ文字装飾エラー:", error);
    return false;
  }
}
