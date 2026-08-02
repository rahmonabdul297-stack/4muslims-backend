import { Router } from "express";
import { deleteUser, getAllUsers } from "../../controllers/admin/users.ts";

 
const router = Router();
// audience
router.get("/users", getAllUsers);
router.delete("/delete/:id", deleteUser);

export default router;
