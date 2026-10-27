
import {
  validateSkinAnalysisImage,
} from "../services/imageValidationService.js";

export async function validateUploadedImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Please upload an image using the 'image' field.",
      });
    }

    const image = await validateSkinAnalysisImage(req.file);

    return res.status(200).json({
      status: "success",
      message: "Image meets the SD dimension requirements.",
      image: {
        width: image.width,
        height: image.height,
        format: image.format,
        sizeBytes: image.sizeBytes,
      },
    });
  } catch (error) {
    next(error);
  }
}
