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
  cat: { label: "ねこ", fallback: "🐱", sprite: "images/pets/cat.webp" },
  dog: { label: "いぬ", fallback: "🐶", sprite: "images/pets/dog.webp" },
  rabbit: { label: "うさぎ", fallback: "🐰", sprite: "images/pets/rabbit.webp" },
  // 旧版で「ことり」を選んだ保存データは、今回追加したうさぎへ安全に引き継ぐ。
  bird: { label: "うさぎ", fallback: "🐰", sprite: "images/pets/rabbit.webp" },
});

export const CAREMATE_PET_ASSETS_READY = true;

const ACTION_FRAME_INDEX = Object.freeze({
  stop: 0,
  walk: 1,
  run: 3,
  rampage: 5,
  sit: 6,
  sleep: 7,
  jump: 8,
  stretch: 9,
  eat: 10,
  play: 11,
  wave: 12,
  lookAround: 13,
});

const EXPRESSION_FRAME_INDEX = Object.freeze({
  neutral: 14,
  smile: 15,
  angry: 16,
  cry: 17,
  sad: 18,
  hurt: 19,
  surprised: 20,
  sleepy: 21,
  embarrassed: 15,
  worried: 22,
  excited: 23,
  affection: 23,
});

export function petAssetPath(kind, action, expression = "neutral", frame = 1) {
  return CAREMATE_PET_CHARACTERS[kind]?.sprite || CAREMATE_PET_CHARACTERS.dog.sprite;
}

export function petSpriteFrame(action = "stop", expression = "neutral", animationFrame = 0) {
  let index;
  if (["stop", "sit"].includes(action) && expression !== "neutral") {
    index = EXPRESSION_FRAME_INDEX[expression] ?? EXPRESSION_FRAME_INDEX.neutral;
  } else {
    index = ACTION_FRAME_INDEX[action] ?? ACTION_FRAME_INDEX.stop;
    if (action === "walk" && animationFrame % 2 === 1) index = 2;
    if (action === "run" && animationFrame % 2 === 1) index = 4;
  }
  return { index, column: index % 6, row: Math.floor(index / 6) };
}

export function applyPetSprite(element, kind, action = "stop", expression = "neutral", animationFrame = 0) {
  if (!element) return;
  const character = CAREMATE_PET_CHARACTERS[kind] || CAREMATE_PET_CHARACTERS.dog;
  const frame = petSpriteFrame(action, expression, animationFrame);
  element.classList.add("caremate-pet-sprite");
  element.style.backgroundImage = `url("${character.sprite}")`;
  element.style.backgroundPosition = `${frame.column * 20}% ${frame.row * (100 / 3)}%`;
  element.dataset.spriteFrame = String(frame.index);
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", `${character.label}：${CAREMATE_PET_ACTIONS.find((item) => item.id === action)?.label || "止まる"}`);
}

export function petFallbackGlyph(kind, expression = "neutral") {
  const glyphs = {
    cat: { neutral: "🐱", smile: "😸", angry: "😾", cry: "😿", sad: "😿", hurt: "🙀", surprised: "🙀", sleepy: "😽", embarrassed: "😺", worried: "😿", excited: "😻", affection: "😻" },
    dog: { neutral: "🐶", smile: "🐶", angry: "🐕", cry: "🐶", sad: "🐶", hurt: "🐶", surprised: "🐶", sleepy: "🐕", embarrassed: "🐶", worried: "🐶", excited: "🐕", affection: "🐶" },
    rabbit: { neutral: "🐰", smile: "🐰", angry: "🐇", cry: "🐰", sad: "🐰", hurt: "🐰", surprised: "🐇", sleepy: "🐇", embarrassed: "🐰", worried: "🐰", excited: "🐇", affection: "🐰" },
    bird: { neutral: "🐰", smile: "🐰", angry: "🐇", cry: "🐰", sad: "🐰", hurt: "🐰", surprised: "🐇", sleepy: "🐇", embarrassed: "🐰", worried: "🐰", excited: "🐇", affection: "🐰" },
  };
  return glyphs[kind]?.[expression] || CAREMATE_PET_CHARACTERS[kind]?.fallback || "🐾";
}
