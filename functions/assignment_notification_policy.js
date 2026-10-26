"use strict";

function deadlineMs(text) {
  const match = String(text || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  return match ? Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+09:00`) : NaN;
}

function reminderDue(deadline, minutes, now) {
  const target = deadline - minutes * 60000;
  return deadline > now && target <= now && now - target < 10 * 60000;
}

module.exports = { deadlineMs, reminderDue };
