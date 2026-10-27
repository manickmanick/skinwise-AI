import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "../config/database.js";
import { generateRoutine } from "../services/routineEngine.js";
import { localDateFor, qualifiesDay } from "../utils/dates.js";

const router = Router();

router.get("/current", async (req, res) => {
  const today = await currentLocalDate(req.userId);
  const routine = await ensureTodayRoutine(req.userId, today);
  if (!routine)
    return res.json({
      routine: null,
      completion: { completed: 0, eligible: 0, percentage: 0 },
      message: "Complete your skin profile to create a routine.",
    });
  const steps = await getSteps(routine.id);
  const [completedRows] = await pool.execute(
    "SELECT step_id FROM routine_completions WHERE user_id = ? AND local_date = ?",
    [req.userId, today],
  );
  const completed = new Set(completedRows.map((row) => row.step_id));
  const count = completed.size;
  const eligible = steps.length;
  res.json({
    routine: {
      id: routine.id,
      version: routine.version,
      createdAt: new Date(routine.created_at).toISOString(),
      steps: steps.map((step) => ({
        ...step,
        completed: completed.has(step.id),
      })),
    },
    completion: {
      date: today,
      completed: count,
      eligible,
      percentage: eligible ? Math.round((count / eligible) * 100) : 0,
      qualifies: qualifiesDay(count, eligible),
    },
    completedStepIds: [...completed],
  });
});

router.post("/generate", async (req, res) => {
  const today = await currentLocalDate(req.userId);
  const priorDayRoutine = await ensureTodayRoutine(req.userId, today);
  const [[profile]] = await pool.execute(
    "SELECT skin_type, concerns, allergies, sensitivity, goals FROM skin_profiles WHERE user_id = ?",
    [req.userId],
  );
  if (!profile)
    return res
      .status(409)
      .json({
        status: "error",
        message:
          "Save your skin profile before creating a personalized routine.",
      });
  for (const key of ["concerns", "allergies", "goals"])
    if (typeof profile[key] === "string")
      profile[key] = JSON.parse(profile[key]);
  const [[latest]] = await pool.execute(
    "SELECT metrics FROM skin_analyses WHERE user_id = ? ORDER BY analyzed_at DESC LIMIT 1",
    [req.userId],
  );
  const metrics = latest
    ? (typeof latest.metrics === "string"
        ? JSON.parse(latest.metrics)
        : latest.metrics
      ).output
    : [];
  const generated = generateRoutine(profile, metrics || []);
  const connection = await pool.getConnection();
  const routineId = crypto.randomUUID();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [
      req.userId,
    ]);
    const [[versionRow]] = await connection.execute(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM routines WHERE user_id = ?",
      [req.userId],
    );
    const version = versionRow.next_version;
    await connection.execute(
      "UPDATE routines SET active = 0 WHERE user_id = ? AND active = 1",
      [req.userId],
    );
    await connection.execute(
      "INSERT INTO routines (id, user_id, version, active, generation_inputs) VALUES (?, ?, ?, 1, ?)",
      [routineId, req.userId, version, JSON.stringify(generated.inputs)],
    );
    for (const step of generated.steps) {
      await connection.execute(
        "INSERT INTO routine_steps (id, routine_id, position, period, title, instructions, frequency, reason, caution) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          crypto.randomUUID(),
          routineId,
          step.position,
          step.period,
          step.title,
          step.instructions,
          step.frequency,
          step.reason,
          step.caution,
        ],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res
    .status(201)
    .json({
      generated: true,
      routine: {
        id: routineId,
        version: versionRow.next_version,
        steps: generated.steps,
      },
      takesEffectNextDay: Boolean(priorDayRoutine),
    });
});

router.get("/completions", async (req, res) => {
  const today = await currentLocalDate(req.userId);
  const routine = await ensureTodayRoutine(req.userId, today);
  if (!routine)
    return res.json({
      date: today,
      steps: [],
      completed: 0,
      eligible: 0,
      percentage: 0,
      qualifies: false,
    });
  const steps = await getSteps(routine.id);
  const [doneRows] = await pool.execute(
    "SELECT step_id FROM routine_completions WHERE user_id = ? AND local_date = ?",
    [req.userId, today],
  );
  const done = new Set(doneRows.map((row) => row.step_id));
  const total = steps.length;
  res.json({
    date: today,
    steps: steps.map((step) => ({ ...step, completed: done.has(step.id) })),
    completed: done.size,
    eligible: total,
    percentage: total ? Math.round((done.size / total) * 100) : 0,
    qualifies: qualifiesDay(done.size, total),
  });
});

router.put("/completions/:stepId", async (req, res) => {
  if (typeof req.body?.completed !== "boolean")
    return res
      .status(400)
      .json({ status: "error", message: "completed must be true or false." });
  const today = await currentLocalDate(req.userId);
  const routine = await ensureTodayRoutine(req.userId, today);
  if (!routine)
    return res
      .status(404)
      .json({ status: "error", message: "No routine is active." });
  const [eligibleRows] = await pool.execute(
    "SELECT id FROM routine_steps WHERE id = ? AND routine_id = ?",
    [req.params.stepId, routine.id],
  );
  if (!eligibleRows.length)
    return res
      .status(404)
      .json({ status: "error", message: "Routine step not found." });
  if (req.body.completed) {
    await pool.execute(
      "INSERT IGNORE INTO routine_completions (user_id, step_id, local_date) VALUES (?, ?, ?)",
      [req.userId, req.params.stepId, today],
    );
  } else {
    await pool.execute(
      "DELETE FROM routine_completions WHERE user_id = ? AND step_id = ? AND local_date = ?",
      [req.userId, req.params.stepId, today],
    );
  }
  const [[summary]] = await pool.execute(
    "SELECT COUNT(*) AS completed FROM routine_completions c JOIN routine_steps s ON s.id = c.step_id WHERE c.user_id = ? AND c.local_date = ? AND s.routine_id = ?",
    [req.userId, today, routine.id],
  );
  const [[totalRow]] = await pool.execute(
    "SELECT eligible_steps FROM routine_days WHERE user_id = ? AND local_date = ?",
    [req.userId, today],
  );
  const total = totalRow?.eligible_steps || 0;
  const count = Number(summary.completed);
  res.json({
    date: today,
    completed: count,
    eligible: total,
    percentage: total ? Math.round((count / total) * 100) : 0,
    qualifies: qualifiesDay(count, total),
  });
});

async function currentLocalDate(userId) {
  const [[row]] = await pool.execute(
    "SELECT timezone FROM user_preferences WHERE user_id = ?",
    [userId],
  );
  try {
    return localDateFor(row?.timezone || "UTC");
  } catch {
    return localDateFor("UTC");
  }
}

async function ensureTodayRoutine(userId, date) {
  const [[day]] = await pool.execute(
    "SELECT d.routine_id AS id, r.version, r.created_at FROM routine_days d JOIN routines r ON r.id = d.routine_id WHERE d.user_id = ? AND d.local_date = ?",
    [userId, date],
  );
  if (day) return day;
  const [[active]] = await pool.execute(
    "SELECT id, version, created_at FROM routines WHERE user_id = ? AND active = 1 ORDER BY version DESC LIMIT 1",
    [userId],
  );
  if (!active) return null;
  const steps = await getSteps(active.id);
  await pool.execute(
    "INSERT IGNORE INTO routine_days (user_id, local_date, routine_id, eligible_steps) VALUES (?, ?, ?, ?)",
    [userId, date, active.id, steps.length],
  );
  const [[chosen]] = await pool.execute(
    "SELECT d.routine_id AS id, r.version, r.created_at FROM routine_days d JOIN routines r ON r.id = d.routine_id WHERE d.user_id = ? AND d.local_date = ?",
    [userId, date],
  );
  return chosen || active;
}

async function getSteps(routineId) {
  const [rows] = await pool.execute(
    "SELECT id, position, period, title, instructions, frequency, reason, caution FROM routine_steps WHERE routine_id = ? ORDER BY FIELD(period, 'morning', 'night'), position",
    [routineId],
  );
  return rows;
}

export default router;
