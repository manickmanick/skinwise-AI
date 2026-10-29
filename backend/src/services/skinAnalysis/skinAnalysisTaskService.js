import crypto from "node:crypto";

import {
  createTaskRecord,
  getTaskRecord,
  setTaskProviderDetails,
  completeTaskRecord,
  failTaskRecord,
  updateTaskStatus,
} from "../../repository/skinAnalysis/skinAnalysisTaskRepository.js";

import {
  cacheTask,
  getCachedTask,
  removeCachedTask,
  acquireTaskLock,
  releaseTaskLock,
} from "./skinAnalysisTaskStore.js";

// Task lifetime: 15 minutes.
const TASK_TTL_MS = 15 * 60_000;

// Check whether a task has exceeded its allowed lifetime.
export function isTaskExpired(task) {
  const createdAt = new Date(task.createdAt).getTime();

  return !Number.isNaN(createdAt) && Date.now() - createdAt >= TASK_TTL_MS;
}

// Create a persistent MySQL task record and cache it in Redis.
export async function createTask({ sessionId, userId, imageMetadata = null }) {
  const id = crypto.randomUUID();

  const task = {
    id,
    sessionId,
    userId,
    providerTaskId: null,
    image: null,
    status: "pending",
    metrics: null,
    analysisId: id,
    createdAt: new Date().toISOString(),
  };

  // Persist the task before starting the external analysis.
  await createTaskRecord({
    id,
    sessionId,
    userId,
    imageMetadata,
  });

  // Propagate Redis errors instead of silently ignoring them.
  await cacheTask(task);

  return task;
}

// Persist the YouCam task ID and update the Redis cache.
export async function attachProviderTask(taskId, providerTaskId, image) {
  await setTaskProviderDetails(taskId, providerTaskId, image);

  const task = await getTaskRecord(taskId);

  if (!task) {
    throw new Error("Task record not found after provider update.");
  }

  const updatedTask = {
    ...task,
    image,
    status: "processing",
  };

  // Propagate Redis errors so the caller can handle them.
  await cacheTask(updatedTask);

  return updatedTask;
}

// Read from Redis first and use MySQL only when the cache key is missing.
export async function getTask(taskId) {
  // Redis connection or command errors propagate to the caller.
  const cachedTask = await getCachedTask(taskId);

  if (cachedTask) {
    return cachedTask;
  }

  // A cache miss is not an error; retrieve the persistent record.
  const task = await getTaskRecord(taskId);

  if (!task) {
    return null;
  }

  // Cache the task retrieved from MySQL.
  // Redis write failures propagate to the caller.
  await cacheTask(task);

  return task;
}

// Persist successful results before attempting Redis cache cleanup.
export async function completeTask(taskId, metrics, image = null) {
  await completeTaskRecord(taskId, metrics);

  // Cache cleanup is best-effort because MySQL already stores the result.
  try {
    await removeCachedTask(taskId);
  } catch (error) {
    console.error(
      "[TASK] Redis cleanup failed after completion:",
      error.message,
    );
  }

  return {
    taskId,
    metrics,
    image,
    status: "success",
  };
}

// Persist task failure and then attempt to remove its cache entry.
export async function failTask(taskId, error) {
  await failTaskRecord(
    taskId,
    error?.code || "ANALYSIS_FAILED",
    error?.message || "Analysis failed.",
  );

  // Do not overwrite the persisted failure if cache cleanup fails.
  try {
    await removeCachedTask(taskId);
  } catch (cacheError) {
    console.error(
      "[TASK] Redis cleanup failed after task failure:",
      cacheError.message,
    );
  }
}

// Mark an expired task in MySQL and attempt to remove its cache entry.
export async function expireTask(taskId) {
  await updateTaskStatus(taskId, "timed_out");

  // Expiration remains persisted even if Redis cleanup fails.
  try {
    await removeCachedTask(taskId);
  } catch (error) {
    console.error(
      "[TASK] Redis cleanup failed after task expiration:",
      error.message,
    );
  }
}

// Acquire a distributed polling lock.
// Redis errors propagate to the controller.
export async function acquirePollingLock(taskId, token) {
  return acquireTaskLock(taskId, token);
}

// Release the distributed polling lock.
// Redis errors propagate to the caller.
export async function releasePollingLock(taskId, token) {
  return releaseTaskLock(taskId, token);
}
