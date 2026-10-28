
import {
  getProfile,
  updateProfile,
} from "../../services/profile/profileService.js";

export async function getProfileController(req, res, next) {
  try {
    const result = await getProfile(req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateProfileController(req, res, next) {
  try {
    const result = await updateProfile(req.userId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
