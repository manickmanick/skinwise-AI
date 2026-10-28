import { Router } from "express";
import {
  getHistory,
  getSummary,
} from "../controllers/progress/progressController.js";

const router = Router();

router.get("/history", getHistory);
router.get("/summary", getSummary);

export default router;
