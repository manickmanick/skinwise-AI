
import {
  getAnalysisHistory,
  getProgressSummary,
} from "../../services/progress/progressService.js";

export async function getHistory(req, res, next) {
  try {
    const analyses = await getAnalysisHistory(req.userId);
    res.json({ analyses });
  } catch (error) {
    next(error);
  }
}

export async function getSummary(req, res, next) {
  try {
    const summary = await getProgressSummary(req.userId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}
