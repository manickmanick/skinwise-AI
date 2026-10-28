
import { pool } from "../../config/database.js";

export async function findAnalysisHistory(userId) {
  const [rows] = await pool.execute(
    `SELECT id, metrics, analyzed_at
     FROM skin_analyses
     WHERE user_id = ?
     ORDER BY analyzed_at DESC
     LIMIT 50`,
    [userId],
  );

  return rows;
}

export async function getUserTimezone(userId) {
  const [[pref]] = await pool.execute(
    "SELECT timezone FROM user_preferences WHERE user_id = ?",
    [userId],
  );

  return pref?.timezone || "UTC";
}

export async function getActiveRoutine(userId) {
  const [[routine]] = await pool.execute(
    `SELECT id
     FROM routines
     WHERE user_id = ? AND active = 1
     ORDER BY version DESC
     LIMIT 1`,
    [userId],
  );

  return routine || null;
}

export async function countRoutineSteps(routineId) {
  const [[result]] = await pool.execute(
    "SELECT COUNT(*) AS eligible FROM routine_steps WHERE routine_id = ?",
    [routineId],
  );

  return Number(result.eligible);
}

export async function ensureRoutineDay(
  userId,
  today,
  routineId,
  eligibleSteps,
) {
  await pool.execute(
    `INSERT IGNORE INTO routine_days
       (user_id, local_date, routine_id, eligible_steps)
     VALUES (?, ?, ?, ?)`,
    [userId, today, routineId, eligibleSteps],
  );
}

export async function getRoutineDays(userId) {
  const [rows] = await pool.execute(
    `SELECT
       d.local_date,
       d.eligible_steps,
       COUNT(c.step_id) AS completed
     FROM routine_days d
     LEFT JOIN routine_completions c
       ON c.user_id = d.user_id
       AND c.local_date = d.local_date
     WHERE d.user_id = ?
     GROUP BY d.local_date, d.eligible_steps
     ORDER BY d.local_date`,
    [userId],
  );

  return rows;
}

export async function countSkinAnalyses(userId) {
  const [[result]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM skin_analyses WHERE user_id = ?",
    [userId],
  );

  return Number(result.total);
}
