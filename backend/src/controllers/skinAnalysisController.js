
import {
  validateSkinAnalysisImage,
} from "../services/imageValidationService.js";

import {
  analyzeSkinImage,
} from "../services/skinAnalysisService.js";

export async function analyzeSkin(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Please upload a JPEG or PNG image.",
      });
    }

    // Reject invalid dimensions before calling YouCam.
    const imageMetadata = await validateSkinAnalysisImage(
      req.file
    );

    const analysis = await analyzeSkinImage(
      req.file,
      imageMetadata
    );

    return res.status(200).json({
      status: "success",
      message: "Skin analysis completed.",
      image: analysis.image,
      results: analysis.results,
    });
  } catch (error) {
    next(error);
  }
}
