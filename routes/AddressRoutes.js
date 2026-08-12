import express from "express";
import auth from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import {
  createAddressSchema,
  updateAddressSchema,
} from "../validations/AddressValidation.js";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/AddressController.js";

const router = express.Router();

router.use(auth);

router.get("/", getAddresses);
router.post("/", validate(createAddressSchema), createAddress);
router.put("/:id", validate(updateAddressSchema), updateAddress);
router.delete("/:id", deleteAddress);

export default router;
