"use strict";

const crypto = require("node:crypto");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const webpush = require("web-push");
const { deadlineMs, reminderDue } = require("./assignment_notification_policy.js");
const privateKey = defineSecret("CARE_ASSIGNMENT_VAPID_KEY");
const publicKey = "BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";
const reminders = [["7days", 10080, "締切7日前"], ["3days", 4320, "締切3日前"], ["1day", 1440, "締切1日前"], ["3hours", 180, "締切3時間前"], ["2hours", 120, "締切2時間前"], ["1hour", 60, "締切1時間前"]];
const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");

async function deliver(db, userDoc, noticeRef, payload, now) {
  const claimed = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(noticeRef);
    const data = snapshot.data() || {};
    if (data.complete === true || (data.sentAt && data.complete === undefined) || data.leaseUntil?.toMillis() > now) return null;
    tx.set(noticeRef, { leaseUntil: Timestamp.fromMillis(now + 90000) }, { merge: true });
    return new Set(data.deliveredEndpoints || []);
  });
  if (!claimed) return;
  try {
    const devices = await userDoc.ref.collection("pushSubscriptions").get();
    const user = userDoc.data() || {};
    const targets = new Map();
    for (const device of devices.docs) {
      const subscription = device.data();
      if (subscription.endpoint && subscription.keys?.auth && subscription.keys?.p256dh) targets.set(subscription.endpoint, { subscription, ref: device.ref });
    }
    for (const field of ["pushSubscription", "subscription"]) {
      const subscription = user[field];
      if (subscription?.endpoint && subscription.keys?.auth && subscription.keys?.p256dh && !targets.has(subscription.endpoint)) targets.set(subscription.endpoint, { subscription });
    }
    const attempts = await Promise.all([...targets.values()].map(async ({ subscription, ref }) => {
      const endpointId = hash(subscription.endpoint);
      if (claimed.has(endpointId)) return true;
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600, timeout: 10000 });
        claimed.add(endpointId);
        return true;
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          if (ref) await ref.delete();
          return true;
        }
        console.warn("課題通知配信失敗", { studentNumber: userDoc.id, status: error.statusCode || "network" });
        return false;
      }
    }));
    await noticeRef.set({
      studentNumber: userDoc.id,
      leaseUntil: Timestamp.fromMillis(0),
      lastAttemptAt: Timestamp.now(),
      sentCount: attempts.filter(Boolean).length,
      deliveredEndpoints: [...claimed],
      complete: attempts.length > 0 && attempts.every(Boolean),
      ...(claimed.size > 0 ? { sentAt: Timestamp.now() } : {}),
    }, { merge: true });
  } catch (error) {
    await noticeRef.set({ leaseUntil: Timestamp.fromMillis(0) }, { merge: true });
    throw error;
  }
}

exports.assignmentReminderTick = onSchedule({
  schedule: "* * * * *", timeZone: "Asia/Tokyo", region: "asia-northeast1",
  secrets: [privateKey], timeoutSeconds: 60, memory: "256MiB", maxInstances: 1,
}, async () => {
  const db = getFirestore();
  const now = Date.now();
  webpush.setVapidDetails("mailto:k.kouhei.16102@icloud.com", publicKey, privateKey.value().trim());
  const access = await db.collection("access").where("active", "==", true).get();
  const failures = [];
  for (const account of access.docs) {
    if (account.data().experienceMode === "study-only" || !/^caremate-\d{7}$/.test(account.id)) continue;
    const number = account.id.slice(9);
    try {
      const [user, assignments] = await Promise.all([db.collection("users").doc(number).get(), db.collection("assignments").doc(number).get()]);
      if (!user.exists || user.data().notificationSettings?.reminder === false) continue;
      for (const item of assignments.data()?.assignments || []) {
        const deadline = deadlineMs(item.deadline);
        for (const [id, minutes, title] of reminders) {
          if (!reminderDue(deadline, minutes, now)) continue;
          const legacy = await db.collection("sentReminders").doc(`${number}_${hash(item.url || "")}_${id}`).get();
          if (legacy.exists && legacy.data().deadline === item.deadline && legacy.data().sentAt) continue;
          const ref = db.collection("sentReminders").doc(`${number}_${hash(item.url || "")}_${id}_${hash(item.deadline).slice(0, 12)}`);
          await deliver(db, user, ref, {
            title: `📚 ${title}`, body: `${item.course || "科目名なし"}\n${item.title || "課題"}\n締切: ${item.deadline}（日本時間）`,
            url: "https://doko2517027-bit.github.io/university-notifier-web/assignments.html",
          }, now);
        }
      }
    } catch (error) {
      failures.push(number);
      console.error("課題通知処理失敗", { studentNumber: number, code: error.code || "unknown" });
    }
  }
  await db.collection("system").doc("assignmentNotificationHealth").set({ updatedAt: Timestamp.now(), timezone: "Asia/Tokyo", failedAccounts: failures });
});

