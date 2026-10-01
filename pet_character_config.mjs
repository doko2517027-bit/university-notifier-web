// 画像が届いた後も動作名を変えずに差し替えられる、CareMateペットの固定仕様。
export const CAREMATE_PET_ACTIONS = Object.freeze([
  { id: "stop", label: "止まる" },
  { id: "walk", label: "歩く" },
  { id: "run", label: "走る" },
  { id: "rampage", label: "暴れる" },
  { id: "sit", label: "座る" },
  { id: "sleep", label: "寝る" },
  { id: "jump", label: "ジャンプ" },
  { id: "stretch", label: "伸びをする" },
  { id: "eat", label: "食べる" },
  { id: "play", label: "遊ぶ" },
  { id: "wave", label: "手を振る" },
  { id: "lookAround", label: "周りを見回す" },
]);

export const CAREMATE_PET_EXPRESSIONS = Object.freeze([
  { id: "neutral", label: "真顔" },
  { id: "smile", label: "笑う" },
  { id: "angry", label: "怒る" },
  { id: "cry", label: "泣く" },
  { id: "sad", label: "落ち込む" },
  { id: "hurt", label: "痛そうな顔" },
  { id: "surprised", label: "驚く" },
  { id: "sleepy", label: "眠そう" },
  { id: "embarrassed", label: "照れる" },
  { id: "worried", label: "困る" },
  { id: "excited", label: "わくわくする" },
  { id: "affection", label: "なつく・うれしそう" },
]);

export const CAREMATE_PET_CHARACTERS = Object.freeze({
  cat: { label: "ねこ", fallback: "🐱" },
  dog: { label: "いぬ", fallback: "🐶" },
  bird: { label: "ことり", fallback: "🐥" },
});

// 画像受領後にtrueへ変え、同じ名前の透過WebPを配置すれば切替可能。
export const CAREMATE_PET_ASSETS_READY = false;

export function petAssetPath(kind, action, expression = "neutral", frame = 1) {
  return `images/pets/${kind}/${action}__${expression}__${frame}.webp`;
}

export function petFallbackGlyph(kind, expression = "neutral") {
  const glyphs = {
    cat: { neutral: "🐱", smile: "😸", angry: "😾", cry: "😿", sad: "😿", hurt: "🙀", surprised: "🙀", sleepy: "😽", embarrassed: "😺", worried: "😿", excited: "😻", affection: "😻" },
    dog: { neutral: "🐶", smile: "🐶", angry: "🐕", cry: "🐶", sad: "🐶", hurt: "🐶", surprised: "🐶", sleepy: "🐕", embarrassed: "🐶", worried: "🐶", excited: "🐕", affection: "🐶" },
    bird: { neutral: "🐥", smile: "🐤", angry: "🐦", cry: "🐥", sad: "🐥", hurt: "🐥", surprised: "🐤", sleepy: "🐦", embarrassed: "🐤", worried: "🐥", excited: "🐤", affection: "🐥" },
  };
  return glyphs[kind]?.[expression] || CAREMATE_PET_CHARACTERS[kind]?.fallback || "🐾";
}
