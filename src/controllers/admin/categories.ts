import type { Request, Response } from "express";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { Category } from "../../models/category.ts";
import { Product } from "../../models/products.ts";

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, isActive } = req.body || {};

    if (!name || !name.trim()) {
      return sendErrorResponse(res, "Category name is required.", 400);
    }
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingCategory) {
      return sendErrorResponse(res, `Category '${name}' already exists.`, 400);
    }
    const slug = generateSlug(name);
    const newCategory = new Category({
      name: name.trim(),
      slug,
      description: description ? description.trim() : "",
      isActive: isActive !== undefined ? isActive : true,
    });
    await newCategory.save();
    return sendSuccessResponse(res, "Category created successfully!", {
      category: newCategory,
    });
  } catch (error) {
    console.error("Create Category Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};


// get all categories
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("name slug description createdAt")
      .sort({ name: 1 });

    return sendSuccessResponse(res, "Categories retrieved successfully!", {
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get Categories Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};

// Edit category by ID
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return sendErrorResponse(res, "Category not found", 404);
    }

    if (name) {
      category.name = name.trim();
      category.slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    if (description !== undefined) category.description = description.trim();
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    return sendSuccessResponse(res, "Category updated successfully", { category });
  } catch (error) {
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};

//  Admin Endpoint: Safe Delete Category
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return sendErrorResponse(res, "Category not found", 404);
    }
    const productsCount = await Product.countDocuments({ category: id });
    if (productsCount > 0) {
      return sendErrorResponse(
        res,
        `Cannot delete category. It is currently assigned to ${productsCount} product(s). Please reassign or delete those products first.`,
        400
      );
    }
    await category.deleteOne();

    return sendSuccessResponse(res, "Category deleted successfully", null);
  } catch (error) {
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};
