export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function localDateFor(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map(({ type, value: part }) => [type, part]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function previousDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1));
  return date.toISOString().slice(0, 10);
}

export function qualifiesDay(completed, eligible) {
  return (
    Number.isFinite(completed) &&
    Number.isFinite(eligible) &&
    eligible > 0 &&
    completed / eligible >= 0.5
  );
}

export function summarizeStreak(qualifiedDates, today) {
  const dates = new Set(qualifiedDates);
  let bestStreak = 0;
  let run = 0;
  let previous = null;
  for (const date of [...dates].sort()) {
    run = previous && previousDate(date) === previous ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = date;
  }
  let currentStreak = 0;
  let cursor = dates.has(today) ? today : previousDate(today);
  while (dates.has(cursor)) {
    currentStreak += 1;
    cursor = previousDate(cursor);
  }
  return { currentStreak, bestStreak, todayQualifies: dates.has(today) };
}
