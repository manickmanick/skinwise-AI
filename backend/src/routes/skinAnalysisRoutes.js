
import { Router } from "express";
import uploadImage from "../middleware/uploadImage.js";
import {
  analyzeSkin,
  getAnalysisTask,
} from "../controllers/skinAnalysis/skinAnalysisController.js";

const router = Router();

router.post("/", uploadImage.single("image"), analyzeSkin);
router.get("/tasks/:taskId", getAnalysisTask);

export default router;
