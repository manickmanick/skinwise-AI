import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeSkin } from "../api/skinAnalysisApi";
import type { SkinAnalysisResponse } from "../types/skinAnalysis.types";

export function useSkinAnalysis() {
  const [data, setData] = useState<SkinAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setData(null);
    setLoading(false);
    setError(null);
  }, []);
  const runAnalysis = useCallback(async (file: File) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await analyzeSkin(file, controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (e: unknown) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }, []);
  return { data, loading, error, runAnalysis, reset };
}
