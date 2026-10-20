const assert = require("node:assert/strict");
const test = require("node:test");
const { PRIMARY_ADMIN_NUMBER, isPrimaryAdmin, canManageAccount } = require("./admin_policy.js");

test("2510044 is the only primary administrator", () => {
  assert.equal(PRIMARY_ADMIN_NUMBER, "2510044");
  assert.equal(isPrimaryAdmin("2510044", "admin"), true);
  assert.equal(isPrimaryAdmin("2510044", "member"), false);
  assert.equal(isPrimaryAdmin("2510001", "admin"), false);
});

test("delegated administrators cannot change another administrator account", () => {
  assert.equal(canManageAccount("2510001", "2510044", "admin"), false);
  assert.equal(canManageAccount("2510001", "2510002", "admin"), false);
  assert.equal(canManageAccount("2510001", "2510002", "member"), true);
  assert.equal(canManageAccount("2510044", "2510001", "admin"), true);
  assert.equal(canManageAccount("2510044", "2510044", "admin"), false);
});
