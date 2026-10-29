
import crypto from "node:crypto";

import { validateSkinAnalysisImage } from "../../services/imageValidationService.js";
import {
  normalizedMetrics,
} from "../../services/analysisMetrics.js";

import {
  pollSkinAnalysis,
  startSkinAnalysis,
} from "../../services/skinAnalysis/skinAnalysisService.js";

import {
  createTask,
  attachProviderTask,
  getTask,
  completeTask,
  failTask,
  expireTask,
  isTaskExpired,
  acquirePollingLock,
  releasePollingLock,
} from "../../services/skinAnalysis/skinAnalysisTaskService.js";

import {
  saveSkinAnalysis,
} from "../../repository/skinAnalysis/skinAnalysisRepository.js";

// CHANGED: Task முதலில் MySQL-ல் உருவாகிறது.
// பிறகு YouCam analysis தொடங்கப்படுகிறது.
export async function analyzeSkin(req, res) {
  let task = null;

  try {
    if (req.body?.consent !== "true") {
      return res.status(400).json({
        success: false,
        message:
          "Confirm the photo-processing notice before submitting an image.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a JPEG or PNG image.",
      });
    }

    const metadata = await validateSkinAnalysisImage(req.file);

    // CHANGED: Local Map capacity check நீக்கப்பட்டது.
    // முதலில் persistent task record உருவாக்கப்படுகிறது.
    task = await createTask({
      sessionId: req.sessionID,
      userId: req.session?.userId || null,
      imageMetadata: metadata,
    });

    try {
      // EXISTING: உன்னுடைய YouCam workflow மாற்றப்படவில்லை.
      const started = await startSkinAnalysis(req.file, metadata);

      // NEW: YouCam providerTaskId-ஐ MySQL + Redis-ல் பதிவு செய்.
      await attachProviderTask(
        task.id,
        started.providerTaskId,
        started.image,
      );

      return res.status(202).json({
        success: true,
        taskId: task.id,
        status: "pending",
        retryAfterMs: 10000,
      });
    } catch (error) {
      // NEW: YouCam start தோல்வியடைந்தால் failure-ஐ persist செய்.
      await failTask(task.id, error);
      throw error;
    }
  } catch (error) {
    logAnalysisError(req, error.operation || "task_start", error);

    return res.status(error.statusCode || 502).json({
      success: false,
      message:
        error.message ||
        "Skin analysis could not be started. Please try again.",
      code: error.code || "ANALYSIS_START_FAILED",
      requestId: req.id,
    });
  }
}

// CHANGED: Redis/MySQL-லிருந்து task retrieve செய்யும் async controller.
export async function getAnalysisTask(req, res) {
  const { taskId } = req.params;

  let task;

  try {
    task = await getTask(taskId);
  } catch (error) {
    logAnalysisError(req, "task_lookup", error);

    return res.status(503).json({
      success: false,
      message: "Unable to retrieve your analysis right now.",
      code: "TASK_LOOKUP_FAILED",
      requestId: req.id,
    });
  }

  // IMPORTANT: Session authorization Redis cache-க்கும் DB fallback-க்கும் பொருந்தும்.
  if (!task || task.sessionId !== req.sessionID) {
    return res.status(404).json({
      success: false,
      message: "Analysis task not found or expired.",
      code: "TASK_NOT_FOUND",
    });
  }

  if (isTaskExpired(task) &&
      !["success", "failed", "timed_out"].includes(task.status)) {
    try {
      await expireTask(taskId);
    } catch (error) {
      logAnalysisError(req, "task_expiration", error);
    }

    return res.status(410).json({
      success: false,
      message: "This analysis task expired. Please start again.",
      code: "TASK_EXPIRED",
    });
  }

  // NEW: ஏற்கெனவே complete ஆன task-க்கு YouCam-ஐ மீண்டும் poll செய்ய வேண்டாம்.
  if (task.status === "success" && task.metrics) {
    return res.json({
      success: true,
      status: "success",
      analysisId: task.id,
      image: task.image || task.imageMetadata,
      results: task.metrics,
    });
  }

  if (task.status === "failed" || task.status === "timed_out") {
    return res.status(422).json({
      success: false,
      status: "error",
      message: task.errorMessage || "Skin analysis failed.",
      code: task.errorCode || "ANALYSIS_FAILED",
    });
  }

  if (!task.providerTaskId) {
    return res.json({
      success: true,
      status: "pending",
      retryAfterMs: 10000,
    });
  }

  // NEW: ஒவ்வொரு backend instance-க்கும் பகிரப்பட்ட Redis lock.
  const lockToken = crypto.randomUUID();
  let lockAcquired = false;

  try {
    lockAcquired = await acquirePollingLock(taskId, lockToken);
  } catch (error) {
    // Redis unavailable: இந்த request-ல் provider-ஐ poll செய்யாமல்
    // MySQL task state-ஐ வைத்து pending response கொடுக்கிறோம்.
    logAnalysisError(req, "poll_lock", error);

    return res.status(503).json({
    success: false,
    status: "error",
    message: "Analysis service is temporarily unavailable. Please try again later.",
    code: "REDIS_UNAVAILABLE",
    requestId: req.id,
  });
  }

  if (!lockAcquired) {
    return res.json({
      success: true,
      status: "pending",
      retryAfterMs: 10000,
    });
  }

  try {
    // CHANGED: YouCam polling இன்னும் existing service மூலமே நடக்கிறது.
    const state = await pollSkinAnalysis(task.providerTaskId);

    if (state.status === "pending") {
      return res.json({
        success: true,
        status: "pending",
        retryAfterMs: 10000,
      });
    }

    const metrics = normalizedMetrics(state.results);

    // NEW: Login செய்த user-ன் history-ஐ persist செய்.
    // task.id-ஐ analysisId ஆகப் பயன்படுத்துவதால் retries-ல் அதே ID கிடைக்கும்.
    if (task.userId) {
      await saveSkinAnalysis(task.id, task.userId, metrics);
    }

    // NEW: Final task result-ஐ MySQL-ல் சேமி.
    // அதன் பிறகுதான் Redis cache நீக்கப்படும்.
    await completeTask(taskId, metrics, task.image);

    return res.json({
      success: true,
      status: "success",
      analysisId: task.userId ? task.id : null,
      image: task.image || task.imageMetadata,
      results: metrics,
    });
  } catch (error) {
    logAnalysisError(req, error.operation || "task_poll", error);

    // CHANGED: Task record-ஐ அழித்துவிடாமல் failure-ஐ persist செய்கிறோம்.
    try {
      await failTask(taskId, error);
    } catch (persistenceError) {
      logAnalysisError(req, "task_failure_persistence", persistenceError);
    }

    return res.status(error.statusCode || 502).json({
      success: false,
      status: "error",
      message:
        error.message ||
        "Skin analysis could not be completed. Please try again.",
      code: error.code || "ANALYSIS_FAILED",
      requestId: req.id,
    });
  } finally {
    // NEW: Lock-ஐ owner token மூலம் release செய்கிறோம்.
    try {
      await releasePollingLock(taskId, lockToken);
    } catch (error) {
      logAnalysisError(req, "poll_lock_release", error);
    }
  }
}

function logAnalysisError(req, operation, error) {
  console.error(
    JSON.stringify({
      level: "error",
      requestId: req.id,
      provider: "YouCam",
      operation,
      statusCode: error.statusCode || 502,
      code: error.code || error.name || "AnalysisError",
    }),
  );
}
