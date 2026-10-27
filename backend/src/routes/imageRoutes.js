
import { Router } from "express";
import uploadImage from "../middleware/uploadImage.js";
import {
  validateUploadedImage,
} from "../controllers/imageController.js";

const router = Router();

router.post(
  "/validate",
  uploadImage.single("image"),
  validateUploadedImage
);

export default router;
