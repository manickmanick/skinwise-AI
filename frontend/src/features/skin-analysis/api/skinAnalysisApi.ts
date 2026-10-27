import { apiRequest } from "../../../lib/api";
import type { SkinAnalysisResponse } from "../types/skinAnalysis.types";
export async function analyzeSkin(
  image: File,
  signal?: AbortSignal,
): Promise<SkinAnalysisResponse> {
  const form = new FormData();
  form.append("image", image);
  form.append("consent", "true");
  return apiRequest<SkinAnalysisResponse>("/skin-analyses", {
    method: "POST",
    body: form,
    signal,
  });
}
