const test = require("node:test");
const assert = require("node:assert/strict");
const { petEligible, petChoices, makePetProfile, applyPetCare, isNextCalendarDay } = require("./pet_care_policy");

test("ペット機能は招待人数にかかわらず2510044だけに限定する", () => {
  assert.equal(petEligible("2510044", {}), true);
  assert.deepEqual(petChoices("2510044"), ["lizard"]);
  assert.equal(petEligible("2510001", { invitedCount: 5 }), false);
  assert.equal(petEligible("2510001", { invitedCount: 100 }), false);
  assert.deepEqual(petChoices("2510001"), ["lizard"]);
  assert.equal(petEligible("2510001", { invitedCount: 8, rewardSuppressions: { m6: { deletedAt: new Date() } } }), false);
});

test("日本時間の日付で毎日4種類を一度ずつ記録する", () => {
  const first = new Date("2026-10-15T15:10:00.000Z"); // 日本時間 10/16
  let profile = makePetProfile({ species: "lizard", name: "リト", now: first });
  profile = applyPetCare(profile, "feed", first);
  profile = applyPetCare(profile, "play", first);
  assert.equal(profile.dailyCare.date, "2026-10-16");
  assert.equal(profile.friendship, 2);
  assert.equal(profile.currentStreak, 1);
  assert.throws(() => applyPetCare(profile, "feed", first), /already-cared/);
  profile = applyPetCare(profile, "pet", first);
  profile = applyPetCare(profile, "pet", first);
  profile = applyPetCare(profile, "sleep", first);
  assert.equal(Object.keys(profile.dailyCare.actions).length, 4);
  assert.equal(profile.friendship, 5);
  assert.equal(profile.totalCareCount, 5);
  assert.equal(applyPetCare(profile, "feed", new Date("2026-10-16T15:10:00.000Z"), { foodId: "greens" }).lastFoodId, "greens");
  assert.throws(() => applyPetCare(profile, "feed", first, { foodId: "pizza" }), /invalid-food/);
});

test("連続お世話日数は翌日なら継続し、日を空けると1日から再開", () => {
  assert.equal(isNextCalendarDay("2026-10-16", "2026-10-17"), true);
  assert.equal(isNextCalendarDay("2026-10-16", "2026-10-18"), false);
  const day1 = new Date("2026-10-16T03:00:00+09:00");
  const day2 = new Date("2026-10-17T03:00:00+09:00");
  const day4 = new Date("2026-10-19T03:00:00+09:00");
  let profile = applyPetCare(makePetProfile({ species: "lizard", name: "リト", now: day1 }), "pet", day1);
  profile = applyPetCare(profile, "feed", day2);
  assert.equal(profile.currentStreak, 2);
  profile = applyPetCare(profile, "play", day4);
  assert.equal(profile.currentStreak, 1);
  assert.equal(profile.bestStreak, 2);
});
