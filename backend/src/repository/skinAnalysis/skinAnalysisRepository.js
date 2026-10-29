import { pool } from "../../config/database.js";

export async function saveSkinAnalysis(analysisId, userId, metrics) {

  await pool.execute(
    `INSERT IGNORE INTO skin_analyses
       (id, user_id, metrics)
     VALUES (?, ?, ?)`,
    [analysisId, userId, JSON.stringify(metrics)],
  );

  return analysisId;
}
