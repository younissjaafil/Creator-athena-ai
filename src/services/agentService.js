const pool = require("../config/database");

/**
 * Create a new agent
 * @param {Object} agentData - Agent data
 * @returns {Promise<Object>} Created agent
 */
async function createAgent(agentData) {
  const client = await pool.connect();

  try {
    const {
      instructor_id, // Now using instructor_id (references users.id)
      name,
      description = null,
      avatar_url = null,
      model_type = "gpt-5",
      temperature = 0.7,
      visibility = "private",
    } = agentData;

    // Validate required fields
    if (!instructor_id || !name) {
      throw new Error("instructor_id and name are required");
    }

    // Validate visibility
    const validVisibility = ["private", "campus", "public"];
    if (!validVisibility.includes(visibility)) {
      throw new Error(
        `Invalid visibility. Must be one of: ${validVisibility.join(", ")}`
      );
    }

    const query = `
      INSERT INTO agents (
        instructor_id, name, description, avatar_url, 
        model_type, temperature, visibility
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id, agent_id, instructor_id, name, description, 
        avatar_url, model_type, temperature, visibility, 
        created_at, updated_at;
    `;

    const values = [
      instructor_id,
      name,
      description,
      avatar_url,
      model_type,
      temperature,
      visibility,
    ];

    const result = await client.query(query, values);

    return {
      success: true,
      message: "Agent created successfully",
      data: result.rows[0],
    };
  } catch (error) {
    if (error.code === "23503") {
      // Foreign key violation
      throw new Error("Invalid instructor_id - user does not exist");
    }
    if (error.code === "23514") {
      // Check constraint violation
      throw new Error(
        "Invalid visibility. Must be: private, campus, or public"
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all agents for an instructor
 * @param {Number} instructorId - Instructor user ID (from users table)
 * @returns {Promise<Object>} List of agents
 */
async function getAgentsByInstructor(instructorId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT 
        a.id, a.agent_id, a.instructor_id, a.name, a.description,
        a.avatar_url, a.model_type, a.temperature, a.visibility,
        a.created_at, a.updated_at,
        u.user_id, u.name as instructor_name, u.email as instructor_email
      FROM agents a
      LEFT JOIN users u ON a.instructor_id = u.id
      WHERE a.instructor_id = $1 
      ORDER BY a.created_at DESC;
    `;

    const result = await client.query(query, [instructorId]);

    return {
      success: true,
      message: "Agents retrieved successfully",
      data: result.rows,
      count: result.rows.length,
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a single agent by UUID or ID
 * @param {String|Number} agentId - Agent UUID or integer ID
 * @param {Number} instructorId - Instructor user ID (for ownership verification)
 * @returns {Promise<Object>} Agent details
 */
async function getAgentById(agentId, instructorId) {
  const client = await pool.connect();

  try {
    // Check if agentId is UUID or integer ID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        agentId
      );

    const query = isUUID
      ? `
        SELECT 
          a.id, a.agent_id, a.instructor_id, a.name, a.description,
          a.avatar_url, a.model_type, a.temperature, a.visibility,
          a.created_at, a.updated_at,
          u.user_id, u.name as instructor_name, u.email as instructor_email
        FROM agents a
        LEFT JOIN users u ON a.instructor_id = u.id
        WHERE a.agent_id = $1 AND a.instructor_id = $2;
      `
      : `
        SELECT 
          a.id, a.agent_id, a.instructor_id, a.name, a.description,
          a.avatar_url, a.model_type, a.temperature, a.visibility,
          a.created_at, a.updated_at,
          u.user_id, u.name as instructor_name, u.email as instructor_email
        FROM agents a
        LEFT JOIN users u ON a.instructor_id = u.id
        WHERE a.id = $1 AND a.instructor_id = $2;
      `;

    const result = await client.query(query, [agentId, instructorId]);

    if (result.rows.length === 0) {
      throw new Error("Agent not found or access denied");
    }

    return {
      success: true,
      message: "Agent retrieved successfully",
      data: result.rows[0],
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update an agent
 * @param {String|Number} agentId - Agent UUID or integer ID
 * @param {Number} instructorId - Instructor user ID (for ownership verification)
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated agent
 */
async function updateAgent(agentId, instructorId, updates) {
  const client = await pool.connect();

  try {
    // Check if agentId is UUID or integer ID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        agentId
      );

    // First verify ownership
    const checkQuery = isUUID
      ? `SELECT id FROM agents WHERE agent_id = $1 AND instructor_id = $2`
      : `SELECT id FROM agents WHERE id = $1 AND instructor_id = $2`;
    const checkResult = await client.query(checkQuery, [agentId, instructorId]);

    if (checkResult.rows.length === 0) {
      throw new Error("Agent not found or access denied");
    }

    // Build dynamic update query
    const allowedFields = [
      "name",
      "description",
      "avatar_url",
      "model_type",
      "temperature",
      "visibility",
    ];

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error("No valid fields to update");
    }

    values.push(agentId);
    values.push(instructorId);

    const updateQuery = isUUID
      ? `
        UPDATE agents 
        SET ${updateFields.join(", ")}
        WHERE agent_id = $${paramCount} AND instructor_id = $${paramCount + 1}
        RETURNING 
          id, agent_id, instructor_id, name, description, 
          avatar_url, model_type, temperature, visibility, 
          created_at, updated_at;
      `
      : `
        UPDATE agents 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramCount} AND instructor_id = $${paramCount + 1}
        RETURNING 
          id, agent_id, instructor_id, name, description, 
          avatar_url, model_type, temperature, visibility, 
          created_at, updated_at;
      `;

    const result = await client.query(updateQuery, values);

    return {
      success: true,
      message: "Agent updated successfully",
      data: result.rows[0],
    };
  } catch (error) {
    if (error.code === "23514") {
      throw new Error(
        "Invalid visibility. Must be: private, campus, or public"
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete an agent
 * @param {String|Number} agentId - Agent UUID or integer ID
 * @param {Number} instructorId - Instructor user ID (for ownership verification)
 * @returns {Promise<Object>} Deletion result
 */
async function deleteAgent(agentId, instructorId) {
  const client = await pool.connect();

  try {
    // Check if agentId is UUID or integer ID
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        agentId
      );

    const query = isUUID
      ? `
        DELETE FROM agents 
        WHERE agent_id = $1 AND instructor_id = $2
        RETURNING id, agent_id;
      `
      : `
        DELETE FROM agents 
        WHERE id = $1 AND instructor_id = $2
        RETURNING id, agent_id;
      `;

    const result = await client.query(query, [agentId, instructorId]);

    if (result.rows.length === 0) {
      throw new Error("Agent not found or access denied");
    }

    return {
      success: true,
      message: "Agent deleted successfully",
      data: {
        id: result.rows[0].id,
        agent_id: result.rows[0].agent_id,
      },
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createAgent,
  getAgentsByInstructor,
  getAgentById,
  updateAgent,
  deleteAgent,
};
