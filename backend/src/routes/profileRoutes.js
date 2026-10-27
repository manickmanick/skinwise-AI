import { Router } from "express";
import { pool } from "../config/database.js";
import { isValidTimeZone } from "../utils/dates.js";

const router = Router();
const SKIN_TYPES = new Set(["oily", "dry", "combination", "normal", "unsure"]);
const SENSITIVITY = new Set(["often", "sometimes", "rarely", "unsure"]);
const CONCERNS = new Set([
  "acne",
  "pigmentation",
  "dryness",
  "oiliness",
  "sensitivity",
  "other",
]);
const GOALS = new Set([
  "simple-routine",
  "hydration",
  "sun-protection",
  "comfort",
  "even-tone",
]);

router.get("/", async (req, res) => {
  const [[profileRows], [preferenceRows]] = await Promise.all([
    pool.execute(
      "SELECT skin_type, concerns, allergies, sensitivity, goals, updated_at FROM skin_profiles WHERE user_id = ?",
      [req.userId],
    ),
    pool.execute(
      "SELECT timezone, city FROM user_preferences WHERE user_id = ?",
      [req.userId],
    ),
  ]);
  const profile = profileRows[0] ? parseJsonFields(profileRows[0]) : null;
  res.json({
    profile: profile
      ? {
          skinType: profile.skin_type,
          concerns: profile.concerns,
          allergies: profile.allergies,
          sensitivity: profile.sensitivity,
          goals: profile.goals,
          updatedAt: profile.updated_at,
        }
      : null,
    preferences: preferenceRows[0] || { timezone: "UTC", city: null },
  });
});

router.put("/", async (req, res) => {
  const body = req.body || {};
  const arraysValid = (value, allowed, max = 10) =>
    Array.isArray(value) &&
    value.length <= max &&
    value.every((item) => typeof item === "string" && allowed.has(item));
  if (
    !SKIN_TYPES.has(body.skinType) ||
    !SENSITIVITY.has(body.sensitivity) ||
    !arraysValid(body.concerns, CONCERNS) ||
    !arraysValid(body.goals, GOALS) ||
    !Array.isArray(body.allergies) ||
    body.allergies.length > 20 ||
    body.allergies.some((x) => typeof x !== "string" || x.trim().length > 80)
  ) {
    return res
      .status(400)
      .json({
        status: "error",
        message: "Review the profile fields and choose valid options.",
      });
  }
  const timezone = body.timezone || "UTC";
  if (typeof timezone !== "string" || !isValidTimeZone(timezone))
    return res
      .status(400)
      .json({ status: "error", message: "Choose a valid timezone." });
  const city =
    body.city == null || body.city === "" ? null : String(body.city).trim();
  if (city && city.length > 120)
    return res
      .status(400)
      .json({ status: "error", message: "City name is too long." });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO skin_profiles (user_id, skin_type, concerns, allergies, sensitivity, goals)
       VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE skin_type=VALUES(skin_type), concerns=VALUES(concerns), allergies=VALUES(allergies), sensitivity=VALUES(sensitivity), goals=VALUES(goals), updated_at=CURRENT_TIMESTAMP`,
      [
        req.userId,
        body.skinType,
        JSON.stringify(body.concerns),
        JSON.stringify(body.allergies.map((x) => x.trim()).filter(Boolean)),
        body.sensitivity,
        JSON.stringify(body.goals),
      ],
    );
    await connection.execute(
      `INSERT INTO user_preferences (user_id, timezone, city) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE timezone=VALUES(timezone), city=VALUES(city), updated_at=CURRENT_TIMESTAMP`,
      [req.userId, timezone, city],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.json({ saved: true });
});

function parseJsonFields(row) {
  for (const key of ["concerns", "allergies", "goals"]) {
    if (typeof row[key] === "string") row[key] = JSON.parse(row[key]);
  }
  return row;
}

export default router;
