import { Router } from "express";
import { deleteUser, getAllUsers } from "../../controllers/admin/users.ts";
import {
  createProduct,
  deleteProduct,
  deleteSingleProductImage,
  getAllProducts,
  getSingleProduct,
  toggleProductPublish,
  updateProduct,
} from "../../controllers/admin/products.ts";
import fileUpload from "../../multer.ts";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  updateCategory,
} from "../../controllers/admin/categories.ts";
const router = Router();
// audience
router.get("/users", getAllUsers);
router.delete("/delete/:id", deleteUser);

// category
router.post("/category", createCategory);
router.get("/categories", getAllCategories);
router.put("/category/:id", updateCategory);
router.delete("/category/:id", deleteCategory);

// product

// frontend
router.get("/products", getAllProducts);
router.get("/products/:id", getSingleProduct);
// admin
router.post("/products", fileUpload.array("images", 5), createProduct);
router.put("/products/:id", fileUpload.array("images", 5), updateProduct);
router.delete("/products/:id", deleteProduct);
router.patch("/products/:id/toggle-publish", toggleProductPublish);
router.delete("/products/:id/images/:public_id", deleteSingleProductImage);

export default router;
