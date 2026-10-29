import { getYouCamConfig, SD_SKIN_CONCERNS } from "../config/youcam.js";
import crypto from "node:crypto";

const REQUEST_TIMEOUT_MS = 30_000;
const LEGACY_POLL_INTERVAL_MS = 10_000;

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function logProviderFailure(operation, details = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      provider: "YouCam",
      operation,
      ...details,
    }),
  );
}

async function parseJsonResponse(response, operation) {
  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok) {
    const rawCode = data?.error_code || data?.data?.error_code;
    const providerCode =
      typeof rawCode === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(rawCode)
        ? rawCode
        : undefined;
    logProviderFailure(operation, { status: response.status, providerCode });

    const authFailure = [401, 403].includes(response.status);
    const error = new Error(
      authFailure
        ? "Skin analysis is not configured correctly. Contact the site administrator."
        : response.status === 429
          ? "The skin analysis provider is busy. Please try again later."
          : "The skin analysis provider could not complete the request.",
    );
    error.statusCode = authFailure || response.status === 429 ? 503 : 502;
    error.code = authFailure ? "YOUCAM_AUTH_FAILED" : "YOUCAM_UPSTREAM_ERROR";
    error.operation = operation;
    throw error;
  }

  if (!data || typeof data !== "object") {
    throw new Error("YouCam returned an invalid JSON response.");
  }

  return data;
}

async function youCamJsonRequest(url, apiKey, body, operation) {
  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return await parseJsonResponse(response, operation);
  } catch (error) {
    error.operation ||= operation;
    throw error;
  }
}

async function createUploadRequest(file, metadata, config) {
  const response = await youCamJsonRequest(
    config.fileEndpoint,
    config.apiKey,
    {
      files: [
        {
          content_type: metadata.mimeType,
          file_name: `skinwise-${crypto.randomUUID()}.${metadata.format === "jpeg" ? "jpg" : "png"}`,
          file_size: file.buffer.length,
        },
      ],
    },
    "file_initialization",
  );

  const fileInfo = response?.data?.files?.[0];
  const uploadRequest = fileInfo?.requests?.[0];

  if (!fileInfo?.file_id || !uploadRequest?.url) {
    const error = new Error(
      "The analysis provider returned invalid upload details.",
    );
    error.operation = "file_initialization";
    throw error;
  }

  return {
    fileId: fileInfo.file_id,
    uploadRequest,
  };
}

async function uploadOriginalImage(file, uploadRequest, metadata) {
  const uploadUrl = new URL(uploadRequest.url);

  // Only send image bytes to the provider's returned upload URL.
  if (
    uploadUrl.protocol !== "https:" ||
    !uploadUrl.hostname.endsWith(".amazonaws.com")
  ) {
    const error = new Error(
      "The analysis provider returned an invalid upload URL.",
    );
    error.code = "YOUCAM_INVALID_UPLOAD_URL";
    error.operation = "image_upload";
    throw error;
  }

  const headers = {
    ...(uploadRequest.headers || {}),
  };

  // Use the provider-supplied upload headers, as required.
  let response;
  try {
    response = await fetchWithTimeout(uploadUrl, {
      method: uploadRequest.method || "PUT",
      headers,
      body: file.buffer,
    });
  } catch (error) {
    error.operation = "image_upload";
    throw error;
  }

  if (!response.ok) {
    logProviderFailure("image_upload", { status: response.status });
    const error = new Error(
      "The image could not be uploaded to the analysis provider. Please try again.",
    );
    error.statusCode = response.status === 429 ? 503 : 502;
    error.code = "YOUCAM_UPLOAD_FAILED";
    error.operation = "image_upload";
    throw error;
  }

  return metadata;
}

async function startAnalysis(fileId, config) {
  const response = await youCamJsonRequest(
    config.taskEndpoint,
    config.apiKey,
    {
      dst_actions: SD_SKIN_CONCERNS,
      miniserver_args: {
        enable_mask_overlay: false,
      },
      format: "json",
      pf_camera_kit: false,
      src_file_id: fileId,
    },
    "task_creation",
  );

  const taskId = response?.data?.task_id;

  if (!taskId) {
    const error = new Error("The analysis provider did not return a task ID.");
    error.operation = "task_creation";
    throw error;
  }

  return taskId;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function analyzeSkinImage(file, metadata) {
  try {
    const task = await startSkinAnalysis(file, metadata);
    const results = await waitForSkinAnalysis(task.providerTaskId);
    return { image: task.image, results };
  } catch (error) {
    throw normalizeProviderError(error);
  }
}

export async function startSkinAnalysis(file, metadata) {
  try {
    const config = getYouCamConfig();
    const { fileId, uploadRequest } = await createUploadRequest(
      file,
      metadata,
      config,
    );
    await uploadOriginalImage(file, uploadRequest, metadata);
    const providerTaskId = await startAnalysis(fileId, config);
    return {
      providerTaskId,
      image: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        resized: false,
      },
    };
  } catch (error) {
    throw normalizeProviderError(error);
  }
}

export async function pollSkinAnalysis(providerTaskId) {
  try {
    const config = getYouCamConfig();
    const response = await fetchWithTimeout(
      `${config.taskEndpoint}/${encodeURIComponent(providerTaskId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${config.apiKey}` },
      },
    );
    const payload = await parseJsonResponse(response, "task_polling");
    const data = payload?.data;
    if (data?.task_status === "success")
      return { status: "success", results: data.results };
    if (data?.task_status === "error") {
      const error = new Error(
        "The analysis provider couldn't process this photo. Try a clear, front-facing image in even lighting.",
      );
      error.statusCode = 422;
      error.code = "YOUCAM_TASK_FAILED";
      error.operation = "task_execution";
      const rawCode = data.error_code || data.error;
      logProviderFailure("task_execution", {
        providerCode:
          typeof rawCode === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(rawCode)
            ? rawCode
            : undefined,
      });
      throw error;
    }
    if (["running", "pending", "queued"].includes(data?.task_status))
      return { status: "pending" };
    const error = new Error(
      "The provider returned an unrecognized task status.",
    );
    error.code = "YOUCAM_INVALID_TASK_STATUS";
    throw error;
  } catch (error) {
    error.operation ||= "task_polling";
    throw normalizeProviderError(error);
  }
}

async function waitForSkinAnalysis(providerTaskId) {
  const expiresAt = Date.now() + 180_000;
  while (Date.now() < expiresAt) {
    const state = await pollSkinAnalysis(providerTaskId);
    if (state.status === "success") return state.results;
    await wait(LEGACY_POLL_INTERVAL_MS);
  }
  const error = new Error("Skin analysis took too long. Please try again.");
  error.statusCode = 504;
  error.code = "YOUCAM_TIMEOUT";
  throw error;
}

function normalizeProviderError(error) {
  if (error.statusCode) return error;
  const timeout = error.name === "TimeoutError" || error.name === "AbortError";
  const normalized = new Error(
    timeout
      ? "Skin analysis timed out. Please try again."
      : "Skin analysis is temporarily unavailable. Please try again.",
  );
  normalized.statusCode = timeout ? 504 : 502;
  normalized.code = timeout ? "YOUCAM_TIMEOUT" : "YOUCAM_NETWORK_ERROR";
  normalized.operation = error.operation || "provider_request";
  logProviderFailure(normalized.operation, {
    error: error.code || error.name || normalized.code,
  });
  return normalized;
}
