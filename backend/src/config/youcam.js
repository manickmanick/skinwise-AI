const API_BASE_URL = "https://yce-api-01.makeupar.com/s2s/v2.1";

export function getYouCamConfig() {
  const apiKey = process.env.YOUCAM_API_KEY;

  if (!apiKey) {
    const error = new Error(
      "YouCam API key is missing from backend environment.",
    );
    error.statusCode = 500;
    throw error;
  }

  return {
    apiKey,
    fileEndpoint: `${API_BASE_URL}/file/skin-analysis`,
    taskEndpoint: `${API_BASE_URL}/task/skin-analysis`,
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
