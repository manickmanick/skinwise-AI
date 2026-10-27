const STEP = (
  period,
  position,
  title,
  instructions,
  reason,
  caution = null,
) => ({
  period,
  position,
  title,
  instructions,
  frequency: "Daily",
  reason,
  caution,
});

export function generateRoutine(profile, latestMetrics = []) {
  const type = profile?.skin_type || "unsure";
  const concerns = Array.isArray(profile?.concerns) ? profile.concerns : [];
  const goals = Array.isArray(profile?.goals) ? profile.goals : [];
  const allergies = Array.isArray(profile?.allergies) ? profile.allergies : [];
  const sensitive = ["often", "sometimes"].includes(profile?.sensitivity);
  const goalSet = new Set(goals);
  const allergyNote = allergies.length
    ? `Check the full ingredient list and avoid declared allergens: ${allergies.join(", ")}.`
    : null;
  const analysisTypes = new Set(latestMetrics.map((metric) => metric.type));
  const cleanserReason =
    type === "oily"
      ? "A gentle cleanse can remove daily oil and buildup without adding treatment actives."
      : concerns.includes("acne")
        ? "A mild cleanser supports a simple routine without making treatment claims."
        : "A gentle cleanse removes daily buildup while keeping the routine simple.";
  const moistureReason =
    type === "dry" || concerns.includes("dryness")
      ? "Your self-reported dryness makes basic moisture support a useful routine step."
      : goalSet.has("hydration")
        ? "You selected hydration as a goal, so this routine includes basic moisturizer without interpreting any analysis score."
        : type === "sensitive" || sensitive
          ? "A basic moisturizer can support a comfortable, low-complexity routine."
          : analysisTypes.has("moisture")
            ? "Your analysis included a moisture metric. This routine includes basic moisturizer without interpreting its value."
            : "Moisturizer helps support skin comfort as part of a basic routine.";
  const sunscreenReason = goalSet.has("sun-protection")
    ? "You chose sun protection as a goal. Follow the product label; this guidance does not diagnose or treat skin conditions."
    : goalSet.has("even-tone")
      ? "Sun protection is a conservative skincare step related to your self-reported goal; no promise about changing skin tone is implied."
      : "Daily sun protection is a conservative skincare step. Skin analysis does not determine sun exposure needs.";
  const steps = [
    STEP(
      "morning",
      1,
      "Gentle cleanser",
      "Use a mild cleanser with lukewarm water, then pat dry.",
      cleanserReason,
      allergyNote,
    ),
    STEP(
      "morning",
      2,
      "Moisturizer",
      "Apply a comfortable layer to clean skin.",
      moistureReason,
      allergyNote,
    ),
    STEP(
      "morning",
      3,
      "Broad-spectrum sunscreen",
      "Apply broad-spectrum SPF 30 or higher as directed on the label; reapply as directed when outdoors.",
      sunscreenReason,
      allergyNote,
    ),
    STEP(
      "night",
      1,
      "Gentle cleanser",
      "Cleanse to remove sunscreen and daily buildup, then pat dry.",
      cleanserReason,
      allergyNote,
    ),
    STEP(
      "night",
      2,
      "Moisturizer",
      "Apply a comfortable layer after cleansing.",
      moistureReason,
      allergyNote,
    ),
  ];
  return {
    version: 1,
    steps,
    inputs: {
      skinType: type,
      concerns,
      goals,
      sensitivity: profile?.sensitivity || "unsure",
      allergyCount: allergies.length,
      availableMetricTypes: [...analysisTypes].sort(),
      ruleset: "conservative-basic-v1",
    },
  };
}
