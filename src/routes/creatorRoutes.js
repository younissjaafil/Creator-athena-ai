const express = require("express");
const router = express.Router();
const agentService = require("../services/agentService");

/**
 * Input validation helper
 */
function validateAgentInput(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate) {
    // Required fields for creation
    if (!data.user_id) errors.push("user_id is required");
    if (!data.agent_type) errors.push("agent_type is required");
    if (!data.domain) errors.push("domain is required");
    if (!data.campus) errors.push("campus is required");
  }

  // Validate agent_type if provide
  if (data.agent_type) {
    const validTypes = ["instructor", "it_support", "administration"];
    if (!validTypes.includes(data.agent_type)) {
      errors.push(`agent_type must be one of: ${validTypes.join(", ")}`);
    }
  }

  // Validate JSON fields if provided
  const jsonFields = ["courses", "personality", "ai_config", "tools"];
  jsonFields.forEach((field) => {
    if (data[field] !== undefined) {
      if (field === "courses" || field === "tools") {
        if (!Array.isArray(data[field])) {
          errors.push(`${field} must be an array`);
        }
      } else {
        if (typeof data[field] !== "object" || Array.isArray(data[field])) {
          errors.push(`${field} must be an object`);
        }
      }
    }
  });

  return errors;
}

/**
 * POST /api/creator/agents
 * Create a new agent
 */
router.post("/agents", async (req, res) => {
  try {
    const errors = validateAgentInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const result = await agentService.createAgent(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create agent",
    });
  }
});

/**
 * GET /api/creator/agents?user_id=xxx
 * Get all agents for a creator
 */
router.get("/agents", async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id query parameter is required",
      });
    }

    const result = await agentService.getAgentsByCreator(user_id);
    res.json(result);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch agents",
    });
  }
});

/**
 * GET /api/creator/agents/:id
 * Get a single agent by ID
 */
router.get("/agents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id query parameter is required",
      });
    }

    const result = await agentService.getAgentById(id, user_id);
    res.json(result);
  } catch (error) {
    console.error("Error fetching agent:", error);
    const status = error.message.includes("not found") ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch agent",
    });
  }
});

/**
 * PUT /api/creator/agents/:id
 * Update an agent
 */
router.put("/agents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, ...updates } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id is required in request body",
      });
    }

    const errors = validateAgentInput(updates, true);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const result = await agentService.updateAgent(id, user_id, updates);
    res.json(result);
  } catch (error) {
    console.error("Error updating agent:", error);
    const status = error.message.includes("not found") ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Failed to update agent",
    });
  }
});

/**
 * DELETE /api/creator/agents/:id
 * Delete an agent
 */
router.delete("/agents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id query parameter is required",
      });
    }

    const result = await agentService.deleteAgent(id, user_id);
    res.json(result);
  } catch (error) {
    console.error("Error deleting agent:", error);
    const status = error.message.includes("not found") ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Failed to delete agent",
    });
  }
});

module.exports = router;
