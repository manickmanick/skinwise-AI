
import {
  findAnalysisHistory,
  getUserTimezone,
  getActiveRoutine,
  countRoutineSteps,
  ensureRoutineDay,
  getRoutineDays,
  countSkinAnalyses,
} from "../../repository/progress/progressRepository.js";

import {
  localDateFor,
  summarizeStreak,
  qualifiesDay,
} from "../../utils/dates.js";

export async function getAnalysisHistory(userId) {
  const rows = await findAnalysisHistory(userId);

  return rows.map((row) => ({
    id: row.id,
    analyzedAt: new Date(row.analyzed_at).toISOString(),
    metrics:
      typeof row.metrics === "string"
        ? JSON.parse(row.metrics)
        : row.metrics,
  }));
}

function sqlDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

export async function getProgressSummary(userId) {
  const timezone = await getUserTimezone(userId);
  const today = localDateFor(timezone);

  const activeRoutine = await getActiveRoutine(userId);

  if (activeRoutine) {
    const eligibleSteps = await countRoutineSteps(activeRoutine.id);

    await ensureRoutineDay(
      userId,
      today,
      activeRoutine.id,
      eligibleSteps,
    );
  }

  const days = await getRoutineDays(userId);

  const qualified = days
    .filter((day) =>
      qualifiesDay(Number(day.completed), Number(day.eligible_steps)),
    )
    .map((day) => sqlDate(day.local_date));

  const streak = summarizeStreak(qualified, today);

  const todayRow = days.find(
    (day) => sqlDate(day.local_date) === today,
  );

  const completed = Number(todayRow?.completed || 0);
  const eligible = Number(todayRow?.eligible_steps || 0);
  const analysisCount = await countSkinAnalyses(userId);

  return {
    today: {
      date: today,
      completed,
      eligible,
      percentage: eligible
        ? Math.round((completed / eligible) * 100)
        : 0,
      qualifies: streak.todayQualifies,
    },
    streak,
    analysisCount,
  };
}
