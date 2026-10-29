import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import uploadImage from "../middleware/uploadImage.js";
import {
  analyzeSkin,
  getAnalysisTask,
} from "../controllers/skinAnalysis/skinAnalysisController.js";
import { pool } from "../config/database.js";
import { requireUser } from "../middleware/requireUser.js";
import { validate } from "../middleware/validate.js";
import {
  analysisIdParamSchema,
  compareQuerySchema,
  historyQuerySchema,
  taskParamSchema,
} from "../validators/authSchemas.js";

const router = Router();
router.post(
  "/",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        status: "error",
        message: "Too many analysis requests. Try again later.",
        code: "RATE_LIMITED",
      }),
  }),
  uploadImage.single("image"),
  analyzeSkin,
);
router.get(
  "/",
  requireUser,
  validate(historyQuerySchema, "query"),
  async (req, res) => {
    const limit = req.validatedQuery.limit;
    const cursor = req.validatedQuery.cursor || null;
    const [rows] = cursor
      ? await pool.execute(
          "SELECT id, metrics, analyzed_at FROM skin_analyses WHERE user_id = ? AND analyzed_at < ? ORDER BY analyzed_at DESC LIMIT ?",
          [req.userId, cursor, limit],
        )
      : await pool.execute(
          "SELECT id, metrics, analyzed_at FROM skin_analyses WHERE user_id = ? ORDER BY analyzed_at DESC LIMIT ?",
          [req.userId, limit],
        );
    res.json({
      analyses: rows.map(parseAnalysis),
      nextCursor:
        rows.length === limit
          ? new Date(rows.at(-1).analyzed_at).toISOString()
          : null,
    });
  },
);
router.get(
  "/compare",
  requireUser,
  validate(compareQuerySchema, "query"),
  async (req, res) => {
    const { from, to } = req.validatedQuery;
    const [rows] = await pool.execute(
      "SELECT id, metrics, analyzed_at FROM skin_analyses WHERE user_id = ? AND id IN (?, ?)",
      [req.userId, from, to],
    );
    if (rows.length !== 2)
      return res.status(404).json({
        status: "error",
        message: "One or both analyses were not found.",
      });
    const older = rows.find((row) => row.id === from);
    const newer = rows.find((row) => row.id === to);
    res.json({
      from: parseAnalysis(older),
      to: parseAnalysis(newer),
      comparisons: compareMetrics(
        parseAnalysis(older).metrics,
        parseAnalysis(newer).metrics,
      ),
    });
  },
);
router.get(
  "/tasks/:taskId",
  validate(taskParamSchema, "params"),
  getAnalysisTask,
);
router.get(
  "/:analysisId",
  requireUser,
  validate(analysisIdParamSchema, "params"),
  async (req, res) => {
    const [rows] = await pool.execute(
      "SELECT id, metrics, analyzed_at FROM skin_analyses WHERE user_id = ? AND id = ?",
      [req.userId, req.params.analysisId],
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ status: "error", message: "Analysis not found." });
    res.json({ analysis: parseAnalysis(rows[0]) });
  },
);

function parseAnalysis(row) {
  return {
    id: row.id,
    analyzedAt: new Date(row.analyzed_at).toISOString(),
    metrics:
      typeof row.metrics === "string" ? JSON.parse(row.metrics) : row.metrics,
  };
}
function compareMetrics(first, second) {
  const keyOf = (item) => `${item.type}:${item.region || ""}`;
  const right = new Map(second.output.map((item) => [keyOf(item), item]));
  return first.output.flatMap((before) => {
    const after = right.get(keyOf(before));
    if (!after) return [];
    const valueKey = ["ui_score", "raw_score", "score"].find(
      (key) =>
        typeof before[key] === "number" && typeof after[key] === "number",
    );
    return valueKey
      ? [
          {
            type: before.type,
            region: before.region || null,
            field: valueKey,
            from: before[valueKey],
            to: after[valueKey],
            difference: after[valueKey] - before[valueKey],
          },
        ]
      : [];
  });
}
export default router;
