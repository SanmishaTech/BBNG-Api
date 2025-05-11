const express = require("express");
const router = express.Router();
const requirementController = require("../controllers/requirementController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");

// POST /requirements
router.post(
  "/",
  auth,
  acl("requirements.write"),
  requirementController.createRequirement
);

// GET /requirements
router.get(
  "/",
  auth,
  acl("requirements.read"),
  requirementController.getAllRequirements
);

// GET /requirements/member/:memberId
router.get(
  "/member/:memberId",
  auth,
  acl("requirements.read"),
  requirementController.getRequirementsByMember
);

// DELETE /requirements/:id
router.delete(
  "/:id",
  auth,
  acl("requirements.delete"),
  requirementController.deleteRequirement
);

module.exports = router;
