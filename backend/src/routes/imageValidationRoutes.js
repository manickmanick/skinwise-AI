import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import uploadImage from "../middleware/uploadImage.js";
import { validateSkinAnalysisImage } from "../services/imageValidationService.js";

const router = Router();
router.post(
  "/validate",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  uploadImage.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: "error",
          message: "Please upload an image using the 'image' field.",
        });
      }
      const image = await validateSkinAnalysisImage(req.file);
      res.json({
        status: "success",
        message: "Image meets the skin-analysis upload requirements.",
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
  },
);
export default router;
