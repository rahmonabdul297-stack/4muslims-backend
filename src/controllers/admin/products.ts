import type { Request, Response } from "express";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import {
  deleteImageFromCloudinary,
  uploadMultipleImagesToCloudinary,
} from "../../cloudinary.ts";
import { Product } from "../../models/products.ts";
import { Category } from "../../models/category.ts";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      price,
      discountPrice,
      category: categoryInput,
      stock,
      isPublished,
    } = req.body || {};

    const files = req.files as Express.Multer.File[];

    if (!title || !description || !price || !categoryInput) {
      return sendErrorResponse(
        res,
        "Title, description, price, and category are required.",
        400,
      );
    }

    if (!files || files.length === 0) {
      return sendErrorResponse(
        res,
        "Please upload at least one product image.",
        400,
      );
    }

    let existingCategory = await Category.findById(categoryInput).catch(
      () => null,
    );

    if (!existingCategory) {
      existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryInput}$`, "i") },
      });
    }

    if (!existingCategory) {
      return sendErrorResponse(res, "Selected category does not exist.", 404);
    }

    const categoryId = existingCategory._id;
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    const uploadedImages = await uploadMultipleImagesToCloudinary(
      files,
      "products",
    );

    const newProduct = new Product({
      title,
      slug,
      description,
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : 0,
      category: categoryId,
      stock: Number(stock) || 0,
      images: uploadedImages,
      isPublished: isPublished !== undefined ? isPublished : true,
    });

    await newProduct.save();
    await newProduct.populate("category", "name slug");

    return sendSuccessResponse(res, "Product created successfully!", {
      product: newProduct,
    });
  } catch (error) {
    console.error("Create Product Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};


// get all products
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const products = await Product.find()
      .populate("category", "name slug")
      .sort({ createdAt: -1 });

    return sendSuccessResponse(res, "Products fetched successfully!", {
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get All Products Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};

// get product by id
export const getSingleProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(res, "Product ID or slug is required.", 400);
    }

    // Check if `id` is a valid 24-character Mongoose ObjectId string
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    // Query directly based on whether it's an _id or a slug
    const product = isObjectId
      ? await Product.findById(id).populate("category", "name slug")
      : await Product.findOne({ slug: id }).populate("category", "name slug");

    if (!product) {
      return sendErrorResponse(res, "Product not found.", 404);
    }

    return sendSuccessResponse(res, "Product retrieved successfully!", {
      product,
    });
  } catch (error) {
    console.error("Get Single Product Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};

//  Toggle Product Published Status (Publish / Draft)
export const toggleProductPublish = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return sendErrorResponse(res, "Product not found.", 404);
    }

    product.isPublished = !product.isPublished;
    await product.save();

    const status = product.isPublished ? "published" : "draft";
    return sendSuccessResponse(res, `Product status changed to ${status}.`, {
      isPublished: product.isPublished,
    });
  } catch (error) {
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};

//  Delete a Single Image from Product
export const deleteSingleProductImage = async (req: Request, res: Response) => {
  try {
    const { id, public_id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return sendErrorResponse(res, "Product not found.", 404);
    }

    if (product.images.length <= 1) {
      return sendErrorResponse(
        res,
        "Cannot delete the only image. A product must have at least one image.",
        400,
      );
    }

    // Decode URL-encoded public_id if it contains slashes (e.g., "products/img123")
    const targetPublicId = decodeURIComponent(public_id);

    // Filter out the target image
    const initialCount = product.images.length;
    product.images = product.images.filter(
      (img) => img.public_id !== targetPublicId,
    );

    if (product.images.length === initialCount) {
      return sendErrorResponse(res, "Image not found on this product.", 404);
    }

    // Delete image from Cloudinary
    await deleteImageFromCloudinary(targetPublicId).catch((err) =>
      console.error(`Cloudinary deletion failed for ${targetPublicId}:`, err),
    );

    await product.save();

    return sendSuccessResponse(res, "Image removed successfully!", {
      images: product.images,
    });
  } catch (error) {
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};

// Update Product by ID
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      price,
      discountPrice,
      category: categoryInput,
      stock,
      isPublished,
      imagesToKeep,
    } = req.body || {};

    const files = req.files as Express.Multer.File[];
    const product = await Product.findById(id);
    if (!product) {
      return sendErrorResponse(res, "Product not found", 404);
    }
    if (categoryInput) {
      let existingCategory = await Category.findById(categoryInput).catch(
        () => null,
      );
      if (!existingCategory) {
        existingCategory = await Category.findOne({
          name: { $regex: new RegExp(`^${categoryInput}$`, "i") },
        });
      }
      if (!existingCategory) {
        return sendErrorResponse(res, "Selected category does not exist.", 404);
      }
      product.category = existingCategory._id as any;
    }
    if (title) {
      product.title = title.trim();
      const baseSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      product.slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }
    if (description) product.description = description.trim();
    if (price !== undefined) product.price = Number(price);
    if (discountPrice !== undefined)
      product.discountPrice = Number(discountPrice);
    if (stock !== undefined) product.stock = Number(stock);
    if (isPublished !== undefined) product.isPublished = Boolean(isPublished);

    let keptImages = product.images;

    if (imagesToKeep !== undefined) {
      const parsedKeepIds: string[] =
        typeof imagesToKeep === "string"
          ? JSON.parse(imagesToKeep)
          : imagesToKeep;

      const removedImages = product.images.filter(
        (img) => !parsedKeepIds.includes(img.public_id),
      );

      for (const img of removedImages) {
        await deleteImageFromCloudinary(img.public_id).catch((err) =>
          console.error(`Failed to delete old image ${img.public_id}:`, err),
        );
      }

      keptImages = product.images.filter((img) =>
        parsedKeepIds.includes(img.public_id),
      );
    }

    let newlyUploadedImages: Array<{ url: string; public_id: string }> = [];
    if (files && files.length > 0) {
      newlyUploadedImages = await uploadMultipleImagesToCloudinary(
        files,
        "products",
      );
    }

    const finalImages = [...keptImages, ...newlyUploadedImages];

    if (finalImages.length === 0) {
      return sendErrorResponse(
        res,
        "Product must have at least one image.",
        400,
      );
    }

    product.images = finalImages;
    await product.save();
    await product.populate("category", "name slug");

    return sendSuccessResponse(res, "Product updated successfully!", {
      product,
    });
  } catch (error) {
    console.error("Update Product Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};

// delete product by ID
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return sendErrorResponse(res, "Product not found", 404);
    }

    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        await deleteImageFromCloudinary(img.public_id).catch((err) =>
          console.error(
            `Failed to delete Cloudinary image ${img.public_id}:`,
            err,
          ),
        );
      }
    }

    await product.deleteOne();

    return sendSuccessResponse(
      res,
      "Product and its associated images deleted successfully!",
      null,
    );
  } catch (error) {
    console.error("Delete Product Error:", (error as Error).message);
    return sendErrorResponse(res, (error as Error).message, 500);
  }
};
