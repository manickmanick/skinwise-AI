import { getYouCamConfig, SD_SKIN_CONCERNS } from "../config/youcam.js";
import crypto from "node:crypto";

const REQUEST_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 90;

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function parseJsonResponse(response) {
  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok) {
    console.error("[YouCam] HTTP request failed:", {
      status: response.status,
    });

    const error = new Error(
      response.status === 429
        ? "The skin analysis provider is busy. Please try again later."
        : "The skin analysis provider could not complete the request.",
    );
    error.statusCode = response.status === 429 ? 503 : 502;
    throw error;
  }

  if (!data || typeof data !== "object") {
    throw new Error("YouCam returned an invalid JSON response.");
  }

  return data;
}

async function youCamJsonRequest(url, apiKey, body) {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response);
}

async function createUploadRequest(file, metadata, config) {
  const response = await youCamJsonRequest(config.fileEndpoint, config.apiKey, {
    files: [
      {
        content_type: metadata.mimeType,
        file_name: `skinwise-${crypto.randomUUID()}.${metadata.format === "jpeg" ? "jpg" : "png"}`,
        file_size: file.buffer.length,
      },
    ],
  });

  const fileInfo = response?.data?.files?.[0];
  const uploadRequest = fileInfo?.requests?.[0];

  if (!fileInfo?.file_id || !uploadRequest?.url) {
    throw new Error("YouCam did not return the expected file upload details.");
  }

  return {
    fileId: fileInfo.file_id,
    uploadRequest,
  };
}

async function uploadOriginalImage(file, uploadRequest, metadata) {
  const uploadUrl = new URL(uploadRequest.url);

  // Only send image bytes to the provider's returned upload URL.
  if (uploadUrl.protocol !== "https:") {
    throw new Error("YouCam returned an invalid upload URL.");
  }

  const headers = {
    ...(uploadRequest.headers || {}),
  };

  // Use the provider-supplied upload headers, as required.
  const response = await fetchWithTimeout(uploadUrl, {
    method: uploadRequest.method || "PUT",
    headers,
    body: file.buffer,
  });

  if (!response.ok) {
    console.error("[YouCam] Image upload failed:", {
      status: response.status,
    });
    throw new Error("Failed to upload the image to YouCam.");
  }

  return metadata;
}

async function startAnalysis(fileId, config) {
  const response = await youCamJsonRequest(config.taskEndpoint, config.apiKey, {
    dst_actions: SD_SKIN_CONCERNS,
    miniserver_args: {
      enable_mask_overlay: false,
    },
    format: "json",
    pf_camera_kit: false,
    src_file_id: fileId,
  });

  const taskId = response?.data?.task_id;

  if (!taskId) {
    throw new Error("YouCam did not return a task ID.");
  }

  return taskId;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollAnalysis(taskId, config) {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const url = `${config.taskEndpoint}/${encodeURIComponent(taskId)}`;

    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    const payload = await parseJsonResponse(response);
    const data = payload?.data;

    if (data?.task_status === "success") {
      return data.results;
    }

    if (data?.task_status === "error") {
      console.warn("[YouCam] Analysis task failed:", {
        error: data.error,
        errorMessage: data.error_message,
      });

      const error = new Error(
        data.error_message || "YouCam could not process this image.",
      );
      error.statusCode = 422;
      throw error;
    }

    if (attempt < MAX_POLL_ATTEMPTS) {
      await wait(POLL_INTERVAL_MS);
    }
  }

  const error = new Error("Skin analysis took too long. Please try again.");
  error.statusCode = 504;
  throw error;
}

export async function analyzeSkinImage(file, metadata) {
  const config = getYouCamConfig();

  // Upload the original bytes. Never resize or re-encode here.
  let results;
  try {
    const { fileId, uploadRequest } = await createUploadRequest(
      file,
      metadata,
      config,
    );
    await uploadOriginalImage(file, uploadRequest, metadata);
    const taskId = await startAnalysis(fileId, config);
    results = await pollAnalysis(taskId, config);
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      const timeout = new Error("Skin analysis timed out. Please try again.");
      timeout.statusCode = 504;
      throw timeout;
    }
    if (!error.statusCode) {
      const provider = new Error(
        "Skin analysis is temporarily unavailable. Please try again.",
      );
      provider.statusCode = 502;
      throw provider;
    }
    throw error;
  }

  return {
    image: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      resized: false,
    },
    results,
  };
}
