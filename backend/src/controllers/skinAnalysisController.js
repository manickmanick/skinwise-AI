import { validateSkinAnalysisImage } from "../services/imageValidationService.js";

import { analyzeSkinImage } from "../services/skinAnalysisService.js";
import { pool } from "../config/database.js";
import {
  normalizedMetrics,
  newAnalysisId,
} from "../services/analysisMetrics.js";

export async function analyzeSkin(req, res, next) {
  try {
    if (req.body?.consent !== "true") {
      return res.status(400).json({
        status: "error",
        message:
          "Confirm the photo-processing notice before submitting an image.",
      });
    }
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Please upload a JPEG or PNG image.",
      });
    }

    // Reject invalid dimensions before calling YouCam.
    const imageMetadata = await validateSkinAnalysisImage(req.file);

    const analysis = await analyzeSkinImage(req.file, imageMetadata);
    const publicMetrics = normalizedMetrics(analysis.results);

    let analysisId = null;
    if (req.session?.userId) {
      analysisId = newAnalysisId();
      await pool.execute(
        "INSERT INTO skin_analyses (id, user_id, metrics) VALUES (?, ?, ?)",
        [analysisId, req.session.userId, JSON.stringify(publicMetrics)],
      );
    }

    return res.status(200).json({
      status: "success",
      message: "Skin analysis completed.",
      analysisId,
      image: analysis.image,
      results: publicMetrics,
    });
  } catch (error) {
    next(error);
  }
}
