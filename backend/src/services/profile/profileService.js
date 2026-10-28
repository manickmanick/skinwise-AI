
import {
  findProfileByUserId,
  saveProfileAndPreferences,
} from "../../repository/profile/profileRepository.js";

import { isValidTimeZone } from "../../utils/dates.js";

function parseJsonFields(row) {
  const parsed = { ...row };

  for (const key of ["concerns", "allergies", "goals"]) {
    if (typeof parsed[key] === "string") {
      parsed[key] = JSON.parse(parsed[key]);
    }
  }

  return parsed;
}

export async function getProfile(userId) {
  const { profile: profileRow, preferences: preferenceRow } =
    await findProfileByUserId(userId);

  const profile = profileRow ? parseJsonFields(profileRow) : null;

  return {
    profile: profile
      ? {
          skinType: profile.skin_type,
          concerns: profile.concerns,
          allergies: profile.allergies,
          sensitivity: profile.sensitivity,
          goals: profile.goals,
          updatedAt: profile.updated_at,
        }
      : null,
    preferences: preferenceRow || {
      timezone: "UTC",
      city: null,
    },
  };
}

export async function updateProfile(userId, body) {
  const timezone = body.timezone || "UTC";

  if (!isValidTimeZone(timezone)) {
    const error = new Error("Choose a valid timezone.");
    error.status = 400;
    throw error;
  }

  const city =
    body.city == null || body.city.trim() === ""
      ? null
      : body.city.trim();

  const profile = {
    skinType: body.skinType,
    concerns: body.concerns,
    allergies: body.allergies.map((item) => item.trim()).filter(Boolean),
    sensitivity: body.sensitivity,
    goals: body.goals,
  };

  await saveProfileAndPreferences(userId, profile, {
    timezone,
    city,
  });

  return { saved: true };
}
