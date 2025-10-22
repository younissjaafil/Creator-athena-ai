const pool = require("../config/database");

/**
 * Save a voice_id for a user (clone built-in voice)
 * @param {String} userId - User ID
 * @param {String} voiceId - Voice ID to clone/save
 * @returns {Promise<Object>} Saved voice record
 */
async function cloneBuiltInVoice(userId, voiceId) {
  const client = await pool.connect();

  try {
    const query = `
      INSERT INTO user_voices (user_id, voice_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, voice_id) DO NOTHING
      RETURNING *;
    `;

    const values = [userId, voiceId];
    const result = await client.query(query, values);

    // If no rows returned, it means the combination already exists
    if (result.rows.length === 0) {
      // Fetch the existing record
      const existingQuery = `
        SELECT * FROM user_voices 
        WHERE user_id = $1 AND voice_id = $2;
      `;
      const existingResult = await client.query(existingQuery, [
        userId,
        voiceId,
      ]);

      return {
        success: true,
        message: "Voice already saved for this user",
        data: existingResult.rows[0],
      };
    }

    return {
      success: true,
      message: "Voice saved successfully",
      data: result.rows[0],
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all saved voices for a user
 * @param {String} userId - User ID
 * @returns {Promise<Object>} List of saved voices
 */
async function getUserVoices(userId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM user_voices 
      WHERE user_id = $1 
      ORDER BY created_at DESC;
    `;

    const result = await client.query(query, [userId]);

    return {
      success: true,
      message: "User voices retrieved successfully",
      data: result.rows,
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a saved voice for a user
 * @param {String} userId - User ID
 * @param {String} voiceId - Voice ID to remove
 * @returns {Promise<Object>} Deletion result
 */
async function deleteUserVoice(userId, voiceId) {
  const client = await pool.connect();

  try {
    const query = `
      DELETE FROM user_voices 
      WHERE user_id = $1 AND voice_id = $2
      RETURNING id;
    `;

    const result = await client.query(query, [userId, voiceId]);

    if (result.rows.length === 0) {
      throw new Error("Voice not found for this user");
    }

    return {
      success: true,
      message: "Voice deleted successfully",
      data: { id: result.rows[0].id },
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  cloneBuiltInVoice,
  getUserVoices,
  deleteUserVoice,
};
