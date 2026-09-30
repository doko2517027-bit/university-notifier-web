function browserName(userAgent) {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/CriOS\//i.test(userAgent)) return "Chrome";
  if (/Chrome\//i.test(userAgent)) return "Chrome";
  if (/FxiOS\//i.test(userAgent)) return "Firefox";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "ブラウザ不明";
}

function androidModelFromUserAgent(userAgent) {
  const match = String(userAgent || "").match(
    /Android[^;)]*;\s*([^;)]+?)(?:\s+Build\/|;|\))/i,
  );
  const model = String(match?.[1] || "").trim();
  if (!model || /^(K|wv|ja-jp)$/i.test(model)) return "";
  return model.slice(0, 80);
}

export function describePresenceDevice({
  userAgent = "",
  maxTouchPoints = 0,
  clientHintModel = "",
} = {}) {
  const ua = String(userAgent || "");
  const browser = browserName(ua);
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && Number(maxTouchPoints) > 1)) {
    return `iPad（詳細不明）・${browser}`;
  }
  if (/iPhone/i.test(ua)) return `iPhone（詳細不明）・${browser}`;
  if (/Android/i.test(ua)) {
    const model = String(clientHintModel || androidModelFromUserAgent(ua)).trim();
    return model ? `Android（${model}）・${browser}` : `Android（詳細不明）・${browser}`;
  }
  if (/Windows/i.test(ua)) return `Windows PC・${browser}`;
  if (/Macintosh/i.test(ua)) return `Mac・${browser}`;
  if (/Linux/i.test(ua)) return `Linux PC・${browser}`;
  return `PC・タブレット（詳細不明）・${browser}`;
}
