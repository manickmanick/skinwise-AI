import { Router } from "express";
import { pool } from "../config/database.js";
import { localDateFor, summarizeStreak, qualifiesDay } from "../utils/dates.js";

const router = Router();
router.get("/summary", async (req, res) => {
  const [[pref]] = await pool.execute(
    "SELECT timezone FROM user_preferences WHERE user_id = ?",
    [req.userId],
  );
  const timezone = pref?.timezone || "UTC";
  const today = localDateFor(timezone);
  const [[activeRoutine]] = await pool.execute(
    "SELECT id FROM routines WHERE user_id = ? AND active = 1 ORDER BY version DESC LIMIT 1",
    [req.userId],
  );
  if (activeRoutine) {
    const [[stepCount]] = await pool.execute(
      "SELECT COUNT(*) AS eligible FROM routine_steps WHERE routine_id = ?",
      [activeRoutine.id],
    );
    await pool.execute(
      "INSERT IGNORE INTO routine_days (user_id, local_date, routine_id, eligible_steps) VALUES (?, ?, ?, ?)",
      [req.userId, today, activeRoutine.id, Number(stepCount.eligible)],
    );
  }
  const [days] = await pool.execute(
    `SELECT d.local_date, d.eligible_steps, COUNT(c.step_id) AS completed
     FROM routine_days d LEFT JOIN routine_completions c ON c.user_id = d.user_id AND c.local_date = d.local_date
     WHERE d.user_id = ? GROUP BY d.local_date, d.eligible_steps ORDER BY d.local_date`,
    [req.userId],
  );
  const qualified = days
    .filter((d) => qualifiesDay(Number(d.completed), Number(d.eligible_steps)))
    .map((d) => sqlDate(d.local_date));
  const streak = summarizeStreak(qualified, today);
  const todayRow = days.find((d) => sqlDate(d.local_date) === today);
  const completed = Number(todayRow?.completed || 0);
  const eligible = Number(todayRow?.eligible_steps || 0);
  const [[analysisCount]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM skin_analyses WHERE user_id = ?",
    [req.userId],
  );
  res.json({
    today: {
      date: today,
      completed,
      eligible,
      percentage: eligible ? Math.round((completed / eligible) * 100) : 0,
      qualifies: streak.todayQualifies,
    },
    streak,
    analysisCount: Number(analysisCount.total),
  });
});
router.get("/history", async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, metrics, analyzed_at FROM skin_analyses WHERE user_id = ? ORDER BY analyzed_at DESC LIMIT 50",
    [req.userId],
  );
  res.json({
    analyses: rows.map((row) => ({
      id: row.id,
      analyzedAt: new Date(row.analyzed_at).toISOString(),
      metrics:
        typeof row.metrics === "string" ? JSON.parse(row.metrics) : row.metrics,
    })),
  });
});
function sqlDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
export default router;
