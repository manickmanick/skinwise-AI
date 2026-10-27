export interface SkinAnalysisImage {
  width: number;
  height: number;
  format: string;
  resized: boolean;
}
export interface SkinAnalysisOutput {
  type: string;
  ui_score?: number;
  raw_score?: number;
  score?: number;
  skin_type?: string;
  region?: string;
}
export interface SkinAnalysisResponse {
  status: "success";
  message: string;
  analysisId: string | null;
  image: SkinAnalysisImage;
  results: { output: SkinAnalysisOutput[] };
}
