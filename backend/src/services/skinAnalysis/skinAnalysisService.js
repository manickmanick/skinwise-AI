import crypto from "node:crypto";
import { getYouCamConfig, SD_SKIN_CONCERNS } from "../../config/youcam.js";

const REQUEST_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_DURATION_MS = 180_000;

/**
 * Creates an AbortController-based timeout for fetch requests.
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Converts YouCam API responses into predictable JavaScript objects.
 */
async function parseJsonResponse(response, operation) {
  let data;

  try {
    data = await response.json();
  } catch {
    const error = new Error("YouCam API returned an invalid JSON response.");

    error.statusCode = 502;
    error.code = "YOUCAM_INVALID_RESPONSE";
    error.operation = operation;

    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error?.message ||
        `YouCam API request failed with status ${response.status}.`,
    );

    error.statusCode =
      response.status === 401 || response.status === 403
        ? 503
        : response.status === 429
          ? 503
          : 502;

    error.code =
      response.status === 401 || response.status === 403
        ? "YOUCAM_AUTH_FAILED"
        : response.status === 429
          ? "YOUCAM_RATE_LIMITED"
          : "YOUCAM_API_ERROR";

    error.operation = operation;
    error.providerStatusCode = response.status;

    throw error;
  }

  return data;
}

/**
 * Makes an authenticated JSON request to YouCam.
 */
async function youCamJsonRequest(url, operation, body = null) {
  const config = getYouCamConfig();

  const options = {
    method: body === null ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
      ...(body === null ? {} : { "Content-Type": "application/json" }),
    },
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetchWithTimeout(url, options);

    return await parseJsonResponse(response, operation);
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    const normalizedError = new Error(
      error.name === "AbortError"
        ? "YouCam API request timed out."
        : "Unable to communicate with YouCam API.",
    );

    normalizedError.statusCode = error.name === "AbortError" ? 504 : 502;

    normalizedError.code =
      error.name === "AbortError" ? "YOUCAM_TIMEOUT" : "YOUCAM_NETWORK_ERROR";

    normalizedError.operation = operation;

    throw normalizedError;
  }
}

/**
 * Requests an upload URL and file ID from YouCam.
 */
async function createUploadRequest(file, metadata, config) {
  const extension = metadata.format === "png" ? "png" : "jpg";

  const body = {
    files: [
      {
        content_type: metadata.mimeType,
        file_name: `skinwise-${crypto.randomUUID()}.${extension}`,
        file_size: file.buffer.length,
      },
    ],
  };

  const data = await youCamJsonRequest(
    config.fileEndpoint,
    "create_upload_request",
    body,
  );

  const uploadFile = data?.data?.files?.[0];
  const uploadRequest = uploadFile?.requests?.[0];

  if (!uploadFile?.file_id || !uploadRequest?.url || !uploadRequest?.method) {
    const error = new Error(
      "YouCam did not return the required upload details.",
    );

    error.statusCode = 502;
    error.code = "YOUCAM_INVALID_UPLOAD_RESPONSE";

    throw error;
  }

  return {
    fileId: uploadFile.file_id,
    uploadRequest,
  };
}

/**
 * Uploads the original image bytes to the URL provided by YouCam.
 */
async function uploadOriginalImage(file, uploadRequest) {
  let uploadUrl;

  try {
    uploadUrl = new URL(uploadRequest.url);
  } catch {
    const error = new Error("YouCam returned an invalid upload URL.");

    error.statusCode = 502;
    error.code = "YOUCAM_INVALID_UPLOAD_URL";

    throw error;
  }

  if (
    uploadUrl.protocol !== "https:" ||
    !uploadUrl.hostname.endsWith(".amazonaws.com")
  ) {
    const error = new Error("YouCam returned an unsupported upload URL.");

    error.statusCode = 502;
    error.code = "YOUCAM_INVALID_UPLOAD_URL";

    throw error;
  }

  const headers = uploadRequest.headers || {};

  let response;

  try {
    response = await fetchWithTimeout(uploadUrl.toString(), {
      method: uploadRequest.method,
      headers,
      body: file.buffer,
    });
  } catch (error) {
    const normalizedError = new Error(
      error.name === "AbortError"
        ? "Image upload timed out."
        : "Unable to upload the image to YouCam.",
    );

    normalizedError.statusCode = error.name === "AbortError" ? 504 : 502;

    normalizedError.code =
      error.name === "AbortError"
        ? "YOUCAM_UPLOAD_TIMEOUT"
        : "YOUCAM_UPLOAD_FAILED";

    normalizedError.operation = "upload_image";

    throw normalizedError;
  }

  if (!response.ok) {
    const error = new Error(
      `YouCam image upload failed with status ${response.status}.`,
    );

    error.statusCode = 502;
    error.code = "YOUCAM_UPLOAD_FAILED";
    error.operation = "upload_image";

    throw error;
  }
}

/**
 * Starts a skin analysis task with YouCam.
 */
async function startAnalysis(fileId, config) {
  const body = {
    dst_actions: SD_SKIN_CONCERNS,
    miniserver_args: {
      enable_mask_overlay: false,
    },
    format: "json",
    pf_camera_kit: false,
    src_file_id: fileId,
  };

  const data = await youCamJsonRequest(
    config.taskEndpoint,
    "start_analysis",
    body,
  );

  const providerTaskId = data?.data?.task_id;

  if (!providerTaskId) {
    const error = new Error("YouCam did not return an analysis task ID.");

    error.statusCode = 502;
    error.code = "YOUCAM_INVALID_TASK_RESPONSE";

    throw error;
  }

  return providerTaskId;
}

/**
 * Starts the complete asynchronous analysis workflow:
 * request upload URL -> upload image -> create analysis task.
 */
export async function startSkinAnalysis(file, metadata) {
  const config = getYouCamConfig();

  try {
   
    const { fileId, uploadRequest } = await createUploadRequest(
      file,
      metadata,
      config,
    );

    await uploadOriginalImage(file, uploadRequest);

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
    console.error(
      JSON.stringify({
        provider: "youcam",
        operation: error.operation || "start_skin_analysis",
        code: error.code || "YOUCAM_ANALYSIS_FAILED",
        statusCode: error.statusCode || 502,
        message: error.message,
      }),
    );

    throw error;
  }
}

/**
 * Checks the current status of a YouCam analysis task.
 */
export async function pollSkinAnalysis(providerTaskId) {
  const config = getYouCamConfig();

  const url = `${config.taskEndpoint}/${encodeURIComponent(providerTaskId)}`;

  const data = await youCamJsonRequest(url, "poll_analysis");

  const taskData = data?.data;

  if (!taskData) {
    const error = new Error("YouCam returned an invalid task status response.");

    error.statusCode = 502;
    error.code = "YOUCAM_INVALID_TASK_RESPONSE";

    throw error;
  }

  const status = String(taskData.task_status || "").toLowerCase();

  if (["running", "pending", "queued", "processing"].includes(status)) {
    return {
      status: "pending",
    };
  }

  if (["success", "completed", "finished"].includes(status)) {
    if (!taskData.results) {
      const error = new Error(
        "YouCam completed the task but returned no results.",
      );

      error.statusCode = 502;
      error.code = "YOUCAM_MISSING_RESULTS";

      throw error;
    }

    return {
      status: "success",
      results: taskData.results,
    };
  }

  if (["error", "failed", "failure"].includes(status)) {
    const error = new Error(
      taskData.error?.message ||
        taskData.message ||
        "YouCam skin analysis failed.",
    );

    error.statusCode = 422;
    error.code = "YOUCAM_TASK_FAILED";

    throw error;
  }

  const error = new Error(
    `YouCam returned an unknown task status: ${status || "empty"}.`,
  );

  error.statusCode = 502;
  error.code = "YOUCAM_UNKNOWN_TASK_STATUS";

  throw error;
}

/**
 * Waits for an analysis task to finish.
 * This helper is useful for synchronous workflows and tests.
 *
 * The main SkinWise API uses startSkinAnalysis() and pollSkinAnalysis()
 * separately so the frontend can poll without holding one request open.
 */
export async function waitForSkinAnalysis(providerTaskId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < MAX_POLL_DURATION_MS) {
    const result = await pollSkinAnalysis(providerTaskId);

    if (result.status === "success") {
      return result.results;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const error = new Error("Skin analysis took too long to complete.");

  error.statusCode = 504;
  error.code = "YOUCAM_ANALYSIS_TIMEOUT";

  throw error;
}

/**
 * Optional synchronous wrapper retained for compatibility with
 * code that may still use the older analyzeSkinImage() function.
 */
export async function analyzeSkinImage(file, metadata) {
  const started = await startSkinAnalysis(file, metadata);

  const results = await waitForSkinAnalysis(started.providerTaskId);

  return {
    image: started.image,
    results,
  };
}
