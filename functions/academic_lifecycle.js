function officialStartDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ""))) return null;
  const start = new Date(`${dateString}T00:00:00+09:00`);
  if (Number.isNaN(start.getTime())) return null;
  const roundTrip = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(start);
  if (roundTrip !== dateString) return null;
  return start.toISOString();
}

function statusRetentionDate(dateString) {
  const officialAt = officialStartDate(dateString);
  if (!officialAt) return null;
  const start = new Date(officialAt);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 30);
  return { officialAt, deleteAt: end.toISOString() };
}

module.exports = { officialStartDate, statusRetentionDate };
