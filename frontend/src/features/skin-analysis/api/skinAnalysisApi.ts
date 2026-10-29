import { apiRequest } from "../../../lib/api";
import type {
  PendingSkinAnalysisResponse,
  SkinAnalysisResponse,
  SkinAnalysisTaskResponse,
} from "../types/skinAnalysis.types";

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(done, ms);
    function done() {
      signal?.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function analyzeSkin(
  image: File,
  signal?: AbortSignal,
): Promise<SkinAnalysisResponse> {
  const form = new FormData();
  form.append("image", image);
  form.append("consent", "true");
  const task = await apiRequest<SkinAnalysisTaskResponse>("/skin-analyses", {
    method: "POST",
    body: form,
    signal,
  });
  const deadline = Date.now() + 15 * 60_000;
  let delay = Math.max(10_000, task.retryAfterMs || 10_000);
  while (Date.now() < deadline) {
    await wait(delay, signal);
    const state = await apiRequest<
      PendingSkinAnalysisResponse | SkinAnalysisResponse
    >(`/skin-analyses/tasks/${encodeURIComponent(task.taskId)}`, { signal });
    if (state.status === "success") return state;
    delay = Math.max(
      10_000,
      "retryAfterMs" in state ? state.retryAfterMs : 10_000,
    );
  }
  throw new Error("Analysis is taking longer than expected. Please try again.");
}
