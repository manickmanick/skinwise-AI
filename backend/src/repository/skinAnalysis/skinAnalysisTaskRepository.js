import { pool } from "../../config/database.js";

export async function createTaskRecord({
  id,
  sessionId,
  userId,
  imageMetadata = null,
}) {
  await pool.execute(
    `INSERT INTO skin_analysis_tasks
      (id, session_id, user_id, status, image_metadata)
     VALUES (?, ?, ?, 'pending', ?)`,
    [
      id,
      sessionId,
      userId,
      imageMetadata ? JSON.stringify(imageMetadata) : null,
    ],
  );
}

export async function getTaskRecord(taskId) {
  const [rows] = await pool.execute(
    `SELECT
       id,
       session_id AS sessionId,
       user_id AS userId,
       provider_task_id AS providerTaskId,
       status,
       image_metadata AS imageMetadata,
       metrics,
       error_code AS errorCode,
       error_message AS errorMessage,
       created_at AS createdAt,
       updated_at AS updatedAt,
       completed_at AS completedAt
     FROM skin_analysis_tasks
     WHERE id = ?
     LIMIT 1`,
    [taskId],
  );

  if (!rows.length) return null;

  const row = rows[0];

  const parseJson = (value) => {
    if (value == null) return null;
    if (typeof value !== "string") return value;

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  return {
    ...row,
    imageMetadata: parseJson(row.imageMetadata),
    metrics: parseJson(row.metrics),
  };
}


export async function setTaskProviderDetails(
  taskId,
  providerTaskId,
  imageMetadata,
) {
  await pool.execute(
    `UPDATE skin_analysis_tasks
     SET provider_task_id = ?,
         image_metadata = ?,
         status = 'processing',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [providerTaskId, JSON.stringify(imageMetadata), taskId],
  );
}


export async function updateTaskStatus(taskId, status) {
  await pool.execute(
    `UPDATE skin_analysis_tasks
     SET status = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, taskId],
  );
}


export async function completeTaskRecord(taskId, metrics) {
  await pool.execute(
    `UPDATE skin_analysis_tasks
     SET metrics = ?,
         status = 'success',
         error_code = NULL,
         error_message = NULL,
         completed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [JSON.stringify(metrics), taskId],
  );
}


export async function failTaskRecord(taskId, errorCode, errorMessage) {
  await pool.execute(
    `UPDATE skin_analysis_tasks
     SET status = 'failed',
         error_code = ?,
         error_message = ?,
         completed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      String(errorCode || "ANALYSIS_FAILED").slice(0, 100),
      String(errorMessage || "Analysis failed").slice(0, 500),
      taskId,
    ],
  );
}


export async function expireOldTasks(ttlMinutes = 15) {
  await pool.execute(
    `UPDATE skin_analysis_tasks
     SET status = 'timed_out',
         error_code = 'TASK_EXPIRED',
         error_message = 'Analysis task expired.',
         completed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('pending', 'processing')
       AND created_at < DATE_SUB(
         CURRENT_TIMESTAMP,
         INTERVAL ? MINUTE
       )`,
    [ttlMinutes],
  );
}
