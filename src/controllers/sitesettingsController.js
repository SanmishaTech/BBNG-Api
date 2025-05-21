/**
 * Controller for handling Site Setting-related operations.
 *
 * Provides functions to manage site settings (key-value pairs),
 * including retrieving, creating, updating, and deleting settings,
 * mirroring the structure of categoryController.
 *
 * @module controllers/siteSettingsController
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest"); // Assuming this utility exists based on userController

const POLICY_TEXT_KEY = "sitePolicyText"; // Define the special key for policy text

// --- Zod Schemas ---
const siteSettingCreateSchema = z.object({
  key: z.string().min(1, "Key is required.")
    .refine(async (key) => {
      // Need to trim key before checking uniqueness
      const trimmedKey = key?.trim();
      if (!trimmedKey) return true; // Let min(1) handle empty strings after trim
      const existing = await prisma.siteSetting.findUnique({ where: { key: trimmedKey } });
      return !existing;
    }, { message: "A setting with this key already exists." }),
  value: z.string(), // Allow empty string
});

const siteSettingUpdateSchema = z.object({
  key: z.string().min(1, "Key is required."),
  value: z.string(), // Allow empty string
}).superRefine(async (data, ctx) => {
  // Access req from context if passed by validateRequest utility
  // Ensure your validateRequest passes the 'req' object in the meta context
  const idParam = ctx.meta?.req?.params?.id;
  if (!idParam) return;

  const settingId = parseInt(idParam, 10);
  if (isNaN(settingId)) return;

  const trimmedKey = data.key?.trim();
   if (!trimmedKey) return; // Let min(1) handle empty strings after trim

  const existing = await prisma.siteSetting.findFirst({
    where: {
      key: trimmedKey,
      id: { not: settingId } // Check if another setting uses this key
    }
  });

  if (existing) {
    ctx.addIssue({
      path: ["key"],
      message: `Another setting with key '${trimmedKey}' already exists.`,
    });
  }
});


// --- Controller Functions ---

/**
 * @function getSettings
 * @description Retrieves a list of all site settings.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of settings or an error message.
 */
exports.getSettings = async (req, res, next) => {
  try {
    // Basic Sorting (can be expanded later)
    const sortBy = req.query.sortBy || "key";
    const sortOrder = req.query.sortOrder === "desc" ? "desc" : "asc";

    const settings = await prisma.siteSetting.findMany({
      orderBy: { [sortBy]: sortOrder },
    });
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching site settings:", error);
    next(error); // Pass error to middleware
  }
};

/**
 * @function getSettingByKey
 * @description Retrieves a single site setting by its key.
 * @param {object} req - Express request object. Expected params: { key: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the setting data or an error message.
 */
exports.getSettingByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    const trimmedKey = key?.trim();

    if (!trimmedKey) {
      // Use a consistent error structure
      return res.status(400).json({
        errors: { key: "Setting key must be provided and be a non-empty string." }
      });
    }

    const setting = await prisma.siteSetting.findUnique({
      where: { key: trimmedKey },
    });

    if (!setting) {
       // Consistent error structure
      return res.status(404).json({ errors: { message: `Setting with key '${trimmedKey}' not found.` } });
    }
    res.status(200).json(setting);
  } catch (error) {
    console.error(`Error fetching setting with key ${req.params.key}:`, error);
    next(error);
  }
};

/**
 * @function createSetting
 * @description Creates a new site setting.
 * @param {object} req - Express request object. Expected body: { key: string, value: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created setting or an error message.
 */
exports.createSetting = async (req, res, next) => {
  // Validate request body using Zod
  // Pass 'req' to validateRequest if needed by schema context (like in update schema)
  const validationResult = await validateRequest(siteSettingCreateSchema, req.body, res, req);
  if (!validationResult) return; // Validation failed, response already sent

  const { key, value } = validationResult; // Use validated data

  try {
    // Ensure key is trimmed before creating
    const trimmedKey = key.trim();
    const newSetting = await prisma.siteSetting.create({
      data: { key: trimmedKey, value: value },
    });
    res.status(201).json(newSetting);
  } catch (error) {
    // This catch block might be less necessary if validation covers unique checks well
     if (error.code === 'P2002' && error.meta?.target?.includes('key')) {
         return res.status(400).json({ errors: { key: `Setting key '${req.body.key?.trim()}' already exists.` } });
     }
    console.error("Error creating site setting:", error);
    next(error);
  }
};

/**
 * @function updateSetting
 * @description Updates an existing site setting by its ID. Can update both key and value.
 * @param {object} req - Express request object. Expected params: { id: number }. Body: { key: string, value: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated setting or an error message.
 */
exports.updateSetting = async (req, res, next) => {
  let settingId;
  try {
    // Basic ID validation first
    const { id } = req.params;
    settingId = parseInt(id, 10);
    if (isNaN(settingId)) {
       // Consistent error structure
      return res.status(400).json({ errors: { message: "Invalid Setting ID provided." } });
    }

    // Validate request body using Zod, passing req for context
    const validationResult = await validateRequest(siteSettingUpdateSchema, req.body, res, req);
    if (!validationResult) return; // Validation failed

    const { key, value } = validationResult; // Use validated data

    // Ensure key is trimmed
    const trimmedKey = key.trim();

    if (trimmedKey === POLICY_TEXT_KEY) {
      // Special handling for site policy text
      // We are updating the SitePolicy table, not SiteSetting for this key.
      // The `id` from req.params might not be relevant here if we always update the single active policy.
      // Or, the admin UI might be passing the ID of the SiteSetting record that traditionally held the policy.
      // For robust re-agreement, we must update SitePolicy.text where isActive:true.

      const activePolicyUpdate = await prisma.sitePolicy.updateMany({
        where: { isActive: true },
        data: { text: value }, // `value` here is the new policy text
      });

      if (activePolicyUpdate.count === 0) {
        return res.status(404).json({ errors: { message: `No active site policy found to update. Setting with key '${POLICY_TEXT_KEY}' (ID: ${settingId}) could not be mapped to an active policy.` } });
      }
      // Successfully updated the active policy in SitePolicy table.
      // We need to return a response consistent with what the frontend expects.
      // If it expects a SiteSetting-like object, we can construct one or fetch the original SiteSetting if it still exists.
      // For now, let's return a success message. The frontend might need adjustment if it strictly expects the updated SiteSetting object for 'sitePolicyText'.
      res.status(200).json({ 
        message: "Site policy updated successfully in the dedicated policy table.", 
        key: trimmedKey, 
        value: value, 
        id: settingId // Return original ID for consistency if frontend uses it
      });

    } else {
      // Default behavior for all other site settings
      const updatedSetting = await prisma.siteSetting.update({
        where: { id: settingId },
        data: { key: trimmedKey, value: value },
      });
      res.status(200).json(updatedSetting);
    }

  } catch (error) {
    if (error.code === 'P2025') {
       // Consistent error structure
      return res.status(404).json({ errors: { message: `Setting with ID ${settingId || req.params.id} not found.` } });
    }
     // Consistent P2002 check (might be redundant)
    if (error.code === 'P2002' && error.meta?.target?.includes('key')) {
        return res.status(400).json({ errors: { key: `Setting key '${req.body.key?.trim()}' already exists.` } });
    }
    console.error(`Error updating setting with ID ${settingId || req.params.id}:`, error);
    next(error);
  }
};

/**
 * @function deleteSetting
 * @description Deletes a site setting by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion or an error message.
 */
exports.deleteSetting = async (req, res, next) => {
  let settingId;
  try {
    const { id } = req.params;
    settingId = parseInt(id, 10);
    if (isNaN(settingId)) {
      // Consistent error structure
      return res.status(400).json({ errors: { message: "Invalid Setting ID provided." } });
    }

    // Fetch first to potentially get key for message, or handle not found early
    const settingToDelete = await prisma.siteSetting.findUnique({
      where: { id: settingId },
      select: { key: true }
    });

    if (!settingToDelete) {
        // Consistent error structure
       return res.status(404).json({ errors: { message: `Setting with ID ${settingId} not found.` } });
    }

    await prisma.siteSetting.delete({ where: { id: settingId } });
    res.status(200).json({
      message: `Setting '${settingToDelete.key}' (ID: ${settingId}) deleted successfully`
    });
  } catch (error) {
     // Consistent P2025 check (likely redundant)
    if (error.code === "P2025") {
       // Consistent error structure
      return res.status(404).json({ errors: { message: `Setting with ID ${settingId || req.params.id} not found.` } });
    }
    console.error(`Error deleting setting with ID ${settingId || req.params.id}:`, error);
    next(error);
  }
};
