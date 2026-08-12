import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import validate from "../middleware/validate.js";
import {
  createContactSchema,
  updateContactStatusSchema,
} from "../validations/ContactValidation.js";
import {
  createContact,
  getContacts,
  updateContactStatus,
} from "../controllers/ContactController.js";

const router = express.Router();

router.post("/", validate(createContactSchema), createContact);
router.get("/", auth, admin, getContacts);
router.put(
  "/:id/status",
  auth,
  admin,
  validate(updateContactStatusSchema),
  updateContactStatus
);

export default router;
