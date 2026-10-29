const API_HOST = "https://yce-api-01.makeupar.com/s2s";

export function getYouCamConfig() {
  const apiKey = process.env.YOUCAM_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "YouCam API key is missing from backend environment.",
    );
    error.statusCode = 503;
    error.code = "YOUCAM_NOT_CONFIGURED";
    throw error;
  }

  return {
    apiKey,
    // Perfect Corp's current File Management API is versioned independently
    // from the v2.1 skin-analysis task API.
    fileEndpoint: `${API_HOST}/v2.0/file`,
    taskEndpoint: `${API_HOST}/v2.1/task/skin-analysis`,
  };
}

export const SD_SKIN_CONCERNS = [
  "acne",
  "dark_circle_v2",
  "droopy_lower_eyelid",
  "droopy_upper_eyelid",
  "eye_bag",
  "firmness",
  "moisture",
  "oiliness",
  "pore",
  "radiance",
  "redness",
  "age_spot",
  "texture",
  "wrinkle",
  "skin_type",
  "tear_trough",
];
