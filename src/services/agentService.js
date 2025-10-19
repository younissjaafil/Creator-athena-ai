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
      creator_id,
      agent_type,
      domain,
      campus,
      region = "Lebanon",
      courses = [],
      personality = {},
    } = agentData;

    const query = `
      INSERT INTO agents (
        creator_id, agent_type, domain, campus, region, 
        courses, personality
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [
      creator_id,
      agent_type,
      domain,
      campus,
      region,
      JSON.stringify(courses),
      JSON.stringify(personality),
    ];

    const result = await client.query(query, values);

    return {
      success: true,
      message: "Agent created successfully",
      data: result.rows[0],
    };
  } catch (error) {
    if (error.code === "23514") {
      // Check constraint violation
      throw new Error(
        "Invalid agent_type. Must be: instructor, it_support, or administration"
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all agents for a creator
 * @param {String} creatorId - Creator user ID
 * @returns {Promise<Object>} List of agents
 */
async function getAgentsByCreator(creatorId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM agents 
      WHERE creator_id = $1 
      ORDER BY created_at DESC;
    `;

    const result = await client.query(query, [creatorId]);

    return {
      success: true,
      message: "Agents retrieved successfully",
      data: result.rows,
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a single agent by ID
 * @param {String} agentId - Agent UUID
 * @param {String} creatorId - Creator user ID (for ownership verification)
 * @returns {Promise<Object>} Agent details
 */
async function getAgentById(agentId, creatorId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM agents 
      WHERE id = $1 AND creator_id = $2;
    `;

    const result = await client.query(query, [agentId, creatorId]);

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
 * @param {String} agentId - Agent UUID
 * @param {String} creatorId - Creator user ID (for ownership verification)
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated agent
 */
async function updateAgent(agentId, creatorId, updates) {
  const client = await pool.connect();

  try {
    // First verify ownership
    const checkQuery = `SELECT id FROM agents WHERE id = $1 AND creator_id = $2`;
    const checkResult = await client.query(checkQuery, [agentId, creatorId]);

    if (checkResult.rows.length === 0) {
      throw new Error("Agent not found or access denied");
    }

    // Build dynamic update query
    const allowedFields = [
      "agent_type",
      "domain",
      "campus",
      "region",
      "courses",
      "personality",
    ];

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        // Stringify JSON fields
        if (["courses", "personality"].includes(key)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error("No valid fields to update");
    }

    values.push(agentId);
    values.push(creatorId);

    const updateQuery = `
      UPDATE agents 
      SET ${updateFields.join(", ")}
      WHERE id = $${paramCount} AND creator_id = $${paramCount + 1}
      RETURNING *;
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
        "Invalid agent_type. Must be: instructor, it_support, or administration"
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete an agent
 * @param {String} agentId - Agent UUID
 * @param {String} creatorId - Creator user ID (for ownership verification)
 * @returns {Promise<Object>} Deletion result
 */
async function deleteAgent(agentId, creatorId) {
  const client = await pool.connect();

  try {
    const query = `
      DELETE FROM agents 
      WHERE id = $1 AND creator_id = $2
      RETURNING id;
    `;

    const result = await client.query(query, [agentId, creatorId]);

    if (result.rows.length === 0) {
      throw new Error("Agent not found or access denied");
    }

    return {
      success: true,
      message: "Agent deleted successfully",
      data: { id: result.rows[0].id },
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createAgent,
  getAgentsByCreator,
  getAgentById,
  updateAgent,
  deleteAgent,
};
