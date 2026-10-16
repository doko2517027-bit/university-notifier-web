const test = require("node:test");
const assert = require("node:assert/strict");
const { petEligible, petChoices, makePetProfile, applyPetCare, advancePetClock, isPetNight } = require("./pet_care_policy");

test("ペット機能は招待人数にかかわらず2510044だけに限定する", () => {
  assert.equal(petEligible("2510044", {}), true);
  assert.deepEqual(petChoices("2510044"), ["lizard"]);
  assert.equal(petEligible("2510001", { invitedCount: 100 }), false);
});

test("初期リトは空腹・好感度の減衰時刻を個別に持つ", () => {
  const now = new Date("2026-10-16T12:00:00+09:00");
  const profile = makePetProfile({ species: "lizard", name: "リト", now });
  assert.equal(profile.fullness, 8);
  assert.equal(profile.petCoins, 100);
  assert.equal(profile.friendship, 0);
  assert.equal(profile.lastMeterAt.getTime(), now.getTime());
});

test("ごはんの満腹度・満足度を種類ごとに反映し、空腹の間は複数回食べられる", () => {
  const now = new Date("2026-10-16T12:00:00+09:00");
  let profile = makePetProfile({ species: "lizard", name: "リト", now });
  profile = applyPetCare(profile, "feed", now, { foodId: "cricket" });
  assert.equal(profile.fullness, 44);
  assert.equal(profile.lastMeal.preference, "大好物");
  assert.equal(profile.lastMeal.satisfaction, 32);
  assert.equal(profile.friendship, 1);
  profile = applyPetCare(profile, "feed", new Date(now.getTime() + 15 * 60_000), { foodId: "komatsuna" });
  assert.equal(profile.fullness, 68);
  assert.equal(profile.friendship, 1, "同じタイミングで何度も食べさせても好感度は重複加算しない");
  profile = applyPetCare(profile, "feed", new Date(now.getTime() + 30 * 60_000), { foodId: "cricket" });
  assert.equal(profile.fullness, 100);
  assert.throws(() => applyPetCare(profile, "feed", new Date(now.getTime() + 45 * 60_000), { foodId: "pumpkin" }), /too-full/);
  assert.throws(() => applyPetCare(profile, "feed", now, { foodId: "pizza" }), /invalid-food/);
});

test("なでる操作は何度でも受け付けるが、好感度はクールダウン中に重複加算しない", () => {
  const start = new Date("2026-10-16T10:00:00+09:00");
  let profile = makePetProfile({ species: "lizard", name: "リト", now: start });
  profile = applyPetCare(profile, "pet", start);
  profile = applyPetCare(profile, "pet", new Date(start.getTime() + 1_000));
  assert.equal(profile.totalCareCount, 2);
  assert.equal(profile.friendship, 1);
  profile = applyPetCare(profile, "pet", new Date(start.getTime() + 6 * 60 * 60 * 1000));
  assert.equal(profile.friendship, 1, "6時間の放置減衰と報酬クールダウンを反映する");
});

test("連続お世話日数は1日に1度だけ進み、日を飛ばすとリセットし、最高記録を保持する", () => {
  const firstDay = new Date("2026-10-16T10:00:00+09:00");
  let profile = makePetProfile({ species: "lizard", name: "リト", now: firstDay });
  profile = applyPetCare(profile, "pet", firstDay);
  assert.equal(profile.currentStreak, 1);
  assert.equal(profile.bestStreak, 1);
  profile = applyPetCare(profile, "play", new Date("2026-10-16T12:00:00+09:00"));
  assert.equal(profile.currentStreak, 1, "同じ日に複数回お世話しても連続日数は増えない");
  profile = applyPetCare(profile, "feed", new Date("2026-10-17T10:00:00+09:00"), { foodId: "pumpkin" });
  assert.equal(profile.currentStreak, 2);
  assert.equal(profile.bestStreak, 2);
  profile = applyPetCare(profile, "pet", new Date("2026-10-19T10:00:00+09:00"));
  assert.equal(profile.currentStreak, 1, "1日抜けると新しい連続記録を開始する");
  assert.equal(profile.bestStreak, 2);
});

test("90分以内にお世話を続けていれば放置減衰しない", () => {
  const start = new Date("2026-10-16T10:00:00+09:00");
  const profile = { ...makePetProfile({ species: "lizard", name: "リト", now: start }), friendship: 8, affinityAwards: { pet: start } };
  const activeAtEighty = applyPetCare(profile, "pet", new Date(start.getTime() + 80 * 60_000));
  const afterMoreEighty = advancePetClock(activeAtEighty, new Date(start.getTime() + 160 * 60_000));
  assert.equal(afterMoreEighty.friendship, 8);
});

test("好感度は放置90分ごとに減り、満腹度も時間経過で減る", () => {
  const start = new Date("2026-10-16T10:00:00+09:00");
  let profile = makePetProfile({ species: "lizard", name: "リト", now: start });
  profile = applyPetCare(profile, "play", start);
  profile = { ...profile, friendship: 8, fullness: 60 };
  const afterNinety = advancePetClock(profile, new Date(start.getTime() + 90 * 60_000));
  assert.equal(afterNinety.friendship, 7);
  assert.equal(afterNinety.fullness, 56);
  const afterThreeHours = advancePetClock(profile, new Date(start.getTime() + 3 * 60 * 60_000));
  assert.equal(afterThreeHours.friendship, 6);
  assert.equal(afterThreeHours.fullness, 48);
});

test("夜間は自動で眠り、世話操作では起こせない", () => {
  const day = new Date("2026-10-16T12:00:00+09:00");
  const night = new Date("2026-10-16T23:00:00+09:00");
  assert.equal(isPetNight(day), false);
  assert.equal(isPetNight(night), true);
  const profile = makePetProfile({ species: "lizard", name: "リト", now: day });
  assert.equal(advancePetClock(profile, night).isSleeping, true);
  assert.throws(() => applyPetCare(profile, "pet", night), /sleep-time/);
  assert.throws(() => applyPetCare(profile, "feed", night, { foodId: "cricket" }), /sleep-time/);
});

test("既存プロフィールの好感度は初回スキーマ更新時に保持される", () => {
  const now = new Date("2026-10-16T12:00:00+09:00");
  const oldProfile = { species: "lizard", name: "リト", friendship: 17, createdAt: new Date("2025-01-01T00:00:00Z") };
  const migrated = advancePetClock(oldProfile, now);
  assert.equal(migrated.friendship, 17);
  assert.equal(migrated.fullness, 8);
  assert.equal(migrated.petCoins, 100);
});
