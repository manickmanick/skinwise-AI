
import { Router } from "express";
import uploadImage from "../middleware/uploadImage.js";
import { analyzeSkin } from "../controllers/skinAnalysisController.js";

const router = Router();

router.post("/", uploadImage.single("image"), analyzeSkin);

export default router;
