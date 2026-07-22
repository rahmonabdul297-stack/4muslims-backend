import { Router } from "express";

import {
  getUserProfile,
  updateUserProfile,
} from "../../controllers/user/user-profile-controller.ts";
import fileUpload from "../../multer.ts";
import { verifyUsersigninToken } from "../../utils/helper.ts";
import { addAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from "../../controllers/user/address.ts";
import { validateAddAddress, validateAddressIdParam, validateUpdateAddress } from "../../middlewares/Validators.ts";
const router = Router();
router.get("/user-profile", verifyUsersigninToken, getUserProfile);
router.put(
  "/update-profile",
  verifyUsersigninToken,
  fileUpload.single("image"),
  updateUserProfile,
);

router.get("/get-address", verifyUsersigninToken, getAddresses);
// POST /api/v1/users/addresses - Add a new address
router.post("/address", validateAddAddress,verifyUsersigninToken, addAddress);

// PUT /api/v1/users/addresses/:addressId - Update an existing address
router.put("/address/:addressId", validateUpdateAddress, verifyUsersigninToken, updateAddress);

// DELETE /api/v1/users/addresses/:addressId - Remove an address
router.delete("/address/:addressId", validateAddressIdParam, verifyUsersigninToken,deleteAddress);

// PATCH /api/v1/users/addresses/:addressId/default - Set an address as default
router.patch("/address:addressId/default", validateAddressIdParam,verifyUsersigninToken, setDefaultAddress);

export default router;
