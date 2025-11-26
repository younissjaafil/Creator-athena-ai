const pool = require("../config/database");
const axiosWithRetry = require("../utils/axiosWithRetry");

const TRAINING_API_URL =
  process.env.TRAINING_API_URL || "https://training-service.vercel.app";

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
      name,
      description = null,
      personality_name = null,
      tone = null,
      trait_array = null,
      system_prompt = null,
      model = "gpt-4",
      temperature = 0.7,
      max_tokens = 2000,
      is_active = true,
      role = "free",
      price_amount = null,
      price_currency = "USD",
    } = agentData;

    // Validate required fields
    if (!creator_id || !name) {
      throw new Error("creator_id and name are required");
    }

    // Validate role
    const validRoles = ["free", "paid"];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
    }

    // Register agent with Training API first
    let trainingApiUuid = null;
    try {
      const trainingApiPayload = {
        name,
        description: description || `AI Agent: ${name}`,
        personality_name: personality_name || "default",
        tone: tone || "professional",
        trait_array: trait_array || [],
        system_prompt:
          system_prompt || `You are ${name}, a helpful AI assistant.`,
        model,
        temperature,
        max_tokens,
      };

      console.log(
        `Registering agent with Training API: ${TRAINING_API_URL}/api/agents`
      );
      const trainingResponse = await axiosWithRetry.post(
        `${TRAINING_API_URL}/api/agents`,
        trainingApiPayload
      );

      // Extract UUID from Training API response
      trainingApiUuid =
        trainingResponse.data?.data?.agent_id ||
        trainingResponse.data?.agent_id;
      console.log(
        `Training API registered agent with UUID: ${trainingApiUuid}`
      );
    } catch (trainingError) {
      console.error(
        "Failed to register with Training API:",
        trainingError.message
      );
      // Continue with agent creation even if Training API fails
      // This prevents blocking agent creation if Training service is down
    }

    const query = `
      INSERT INTO agents (
        creator_id, name, description, personality_name, tone,
        trait_array, system_prompt, model, temperature, max_tokens,
        is_active, role, price_amount, price_currency, training_api_uuid
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING 
        id, creator_id, name, description, personality_name, tone,
        trait_array, system_prompt, model, temperature, max_tokens,
        is_active, role, price_amount, price_currency, training_api_uuid,
        created_at, updated_at;
    `;

    const values = [
      creator_id,
      name,
      description,
      personality_name,
      tone,
      trait_array,
      system_prompt,
      model,
      temperature,
      max_tokens,
      is_active,
      role,
      price_amount,
      price_currency,
      trainingApiUuid,
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
      throw new Error("Invalid creator_id - user does not exist");
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all agents for a creator
 * @param {Number} creatorId - Creator user ID (from users table)
 * @returns {Promise<Object>} List of agents
 */
async function getAgentsByCreator(creatorId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT 
        a.id, a.creator_id, a.name, a.description,
        a.personality_name, a.tone, a.trait_array,
        a.system_prompt, a.model, a.temperature, a.max_tokens,
        a.is_active, a.role, a.price_amount, a.price_currency,
        a.training_api_uuid,
        a.created_at, a.updated_at,
        u.user_id, u.name as creator_name, u.email as creator_email
      FROM agents a
      LEFT JOIN users u ON a.creator_id = u.id
      WHERE a.creator_id = $1 
      ORDER BY a.created_at DESC;
    `;

    const result = await client.query(query, [creatorId]);

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
 * Get a single agent by ID
 * @param {Number} agentId - Agent integer ID
 * @param {Number} creatorId - Creator user ID (for ownership verification)
 * @returns {Promise<Object>} Agent details
 */
async function getAgentById(agentId, creatorId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT 
        a.id, a.creator_id, a.name, a.description,
        a.personality_name, a.tone, a.trait_array,
        a.system_prompt, a.model, a.temperature, a.max_tokens,
        a.is_active, a.role, a.price_amount, a.price_currency,
        a.training_api_uuid,
        a.created_at, a.updated_at,
        u.user_id, u.name as creator_name, u.email as creator_email
      FROM agents a
      LEFT JOIN users u ON a.creator_id = u.id
      WHERE a.id = $1 AND a.creator_id = $2;
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
 * @param {Number} agentId - Agent integer ID
 * @param {Number} creatorId - Creator user ID (for ownership verification)
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
      "name",
      "description",
      "personality_name",
      "tone",
      "trait_array",
      "system_prompt",
      "model",
      "temperature",
      "max_tokens",
      "is_active",
      "role",
      "price_amount",
      "price_currency",
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
    values.push(creatorId);

    const updateQuery = `
      UPDATE agents 
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount} AND creator_id = $${paramCount + 1}
      RETURNING 
        id, creator_id, name, description, personality_name, tone,
        trait_array, system_prompt, model, temperature, max_tokens,
        is_active, role, price_amount, price_currency, training_api_uuid,
        created_at, updated_at;
    `;

    const result = await client.query(updateQuery, values);

    return {
      success: true,
      message: "Agent updated successfully",
      data: result.rows[0],
    };
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete an agent
 * @param {Number} agentId - Agent integer ID
 * @param {Number} creatorId - Creator user ID (for ownership verification)
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
      data: {
        id: result.rows[0].id,
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
  getAgentsByCreator,
  getAgentById,
  updateAgent,
  deleteAgent,
};
