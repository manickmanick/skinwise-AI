import { pool } from "../../config/database.js";

export async function findProfileByUserId(userId) {
  const skinProfileQuery = `SELECT skin_type, concerns, allergies, sensitivity, goals, updated_at
       FROM skin_profiles
       WHERE user_id = ?`;

  const userPreferenceQuery = `
    SELECT timezone, city
       FROM user_preferences
       WHERE user_id = ?
`;

  const [[profileRows], [preferenceRows]] = await Promise.all([
    pool.execute(skinProfileQuery, [userId]),

    pool.execute(userPreferenceQuery, [userId]),
  ]);

  return {
    profile: profileRows[0] || null,
    preferences: preferenceRows[0] || null,
  };
}

export async function saveProfileAndPreferences(userId, profile, preferences) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO skin_profiles
         (user_id, skin_type, concerns, allergies, sensitivity, goals)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         skin_type = VALUES(skin_type),
         concerns = VALUES(concerns),
         allergies = VALUES(allergies),
         sensitivity = VALUES(sensitivity),
         goals = VALUES(goals),
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        profile.skinType,
        JSON.stringify(profile.concerns),
        JSON.stringify(profile.allergies),
        profile.sensitivity,
        JSON.stringify(profile.goals),
      ],
    );

    await connection.execute(
      `INSERT INTO user_preferences (user_id, timezone, city)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         timezone = VALUES(timezone),
         city = VALUES(city),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, preferences.timezone, preferences.city],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
