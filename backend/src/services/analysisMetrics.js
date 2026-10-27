import crypto from "node:crypto";

export function normalizedMetrics(providerResults) {
  const output = providerResults?.output;
  if (!Array.isArray(output)) return { output: [] };
  return {
    output: output
      .filter(
        (item) =>
          item &&
          typeof item.type === "string" &&
          (typeof item.ui_score === "number" ||
            typeof item.raw_score === "number" ||
            typeof item.score === "number" ||
            typeof item.skin_type === "string"),
      )
      .map((item) => ({
        type: item.type,
        ...(typeof item.region === "string" ? { region: item.region } : {}),
        ...(typeof item.skin_type === "string"
          ? { skin_type: item.skin_type }
          : {}),
        ...(typeof item.ui_score === "number" && Number.isFinite(item.ui_score)
          ? { ui_score: item.ui_score }
          : {}),
        ...(typeof item.raw_score === "number" &&
        Number.isFinite(item.raw_score)
          ? { raw_score: item.raw_score }
          : {}),
        ...(typeof item.score === "number" && Number.isFinite(item.score)
          ? { score: item.score }
          : {}),
      })),
  };
}

export const newAnalysisId = () => crypto.randomUUID();
