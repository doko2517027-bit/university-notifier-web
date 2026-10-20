import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (file) => readFile(new URL(file, import.meta.url), "utf8");

test("入口文言は課題通知あり・なしを選んで発行できる", async () => {
  const [html, client, gate] = await Promise.all([
    source("./entrance_admin.html"),
    source("./entrance_admin.js"),
    source("./functions/entrance_gate.js"),
  ]);
  assert.match(html, /value="assignments"/);
  assert.match(html, /value="study-only"/);
  assert.match(client, /experienceMode/);
  assert.match(gate, /experienceMode/);
  assert.match(gate, /entranceGrants/);
});

test("課題通知なしでは課題・manaba導線と直接アクセスを無効にする", async () => {
  const [nav, bootstrap, settings, home, rules] = await Promise.all([
    source("./common.js"),
    source("./page_bootstrap.js"),
    source("./settings.js"),
    source("./home.js"),
    source("./firestore.rules"),
  ]);
  assert.match(nav, /assignmentAccess \? \[\{ href: "assignments\.html"/);
  assert.match(bootstrap, /assignmentAccess === false && location\.pathname\.endsWith\("assignments\.html"\)/);
  assert.match(settings, /assignmentAccess && user\.manabaCredentialConfigured/);
  assert.match(home, /assignmentAccess \? getDoc\(doc\(db, "assignments"/);
  assert.match(rules, /assignmentEnabled\(\)/);
  assert.match(rules, /experienceMode != 'study-only'/);
});

test("新規アカウントは入口の一回限りgrantで利用形態を確定する", async () => {
  const functions = await source("./functions/index.js");
  assert.match(functions, /experienceMode: "pending"/);
  assert.match(functions, /resolveExperienceMode\(studentNumber, request\.data\?\.entranceGrant\)/);
  assert.match(functions, /transaction\.update\(grantRef, \{ usedAt:/);
  assert.match(functions, /assignmentAccess: experienceMode === "assignments"/);
});
