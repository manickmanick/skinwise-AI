import { Router } from "express";
import {
  getProfileController,
  updateProfileController,
} from "../controllers/profile/profileController.js";
import { validate } from "../middleware/validate.js";
import { profileSchema } from "../validators/authSchemas.js";

const router = Router();

router.get("/", getProfileController);
router.put("/", validate(profileSchema), updateProfileController);

export default router;
