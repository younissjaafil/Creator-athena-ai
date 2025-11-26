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
    if (!data.creator_id) errors.push("creator_id is required");
    if (!data.name) errors.push("name is required");
  }

  // Validate visibility if provided
  if (data.visibility) {
    const validVisibility = ["private", "campus", "public"];
    if (!validVisibility.includes(data.visibility)) {
      errors.push(`visibility must be one of: ${validVisibility.join(", ")}`);
    }
  }

  // Validate temperature if provided
  if (data.temperature !== undefined) {
    if (
      typeof data.temperature !== "number" ||
      data.temperature < 0 ||
      data.temperature > 2
    ) {
      errors.push("temperature must be a number between 0 and 2");
    }
  }

  // Validate model_type if provided
  if (data.model_type && typeof data.model_type !== "string") {
    errors.push("model_type must be a string");
  }

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
 * GET /api/creator/agents?creator_id=xxx
 * Get all agents for a creator
 */
router.get("/agents", async (req, res) => {
  try {
    const { creator_id } = req.query;

    if (!creator_id) {
      return res.status(400).json({
        success: false,
        message: "creator_id query parameter is required",
      });
    }

    // Convert creator_id to integer
    const creatorIdInt = parseInt(creator_id);
    if (isNaN(creatorIdInt)) {
      return res.status(400).json({
        success: false,
        message: "creator_id must be a valid number",
      });
    }

    const result = await agentService.getAgentsByCreator(creatorIdInt);
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
 * Get a single agent by ID (UUID or integer)
 */
router.get("/agents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { creator_id } = req.query;

    if (!creator_id) {
      return res.status(400).json({
        success: false,
        message: "creator_id query parameter is required",
      });
    }

    // Convert creator_id to integer
    const creatorIdInt = parseInt(creator_id);
    if (isNaN(creatorIdInt)) {
      return res.status(400).json({
        success: false,
        message: "creator_id must be a valid number",
      });
    }

    const result = await agentService.getAgentById(id, creatorIdInt);
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
    const { creator_id, ...updates } = req.body;

    if (!creator_id) {
      return res.status(400).json({
        success: false,
        message: "creator_id is required in request body",
      });
    }

    // Convert creator_id to integer
    const creatorIdInt = parseInt(creator_id);
    if (isNaN(creatorIdInt)) {
      return res.status(400).json({
        success: false,
        message: "creator_id must be a valid number",
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

    const result = await agentService.updateAgent(id, creatorIdInt, updates);
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
    const { creator_id } = req.query;

    if (!creator_id) {
      return res.status(400).json({
        success: false,
        message: "creator_id query parameter is required",
      });
    }

    // Convert creator_id to integer
    const creatorIdInt = parseInt(creator_id);
    if (isNaN(creatorIdInt)) {
      return res.status(400).json({
        success: false,
        message: "creator_id must be a valid number",
      });
    }

    const result = await agentService.deleteAgent(id, creatorIdInt);
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
