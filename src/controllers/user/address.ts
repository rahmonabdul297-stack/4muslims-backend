import type { NextFunction, Request, Response } from "express";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/helper.ts";
import { User } from "../../models/User.ts";
import { validationResult } from "express-validator";

export const getAddresses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).id;
    // Select user name & phone along with addresses so the frontend can populate defaults easily
    const user = await User.findById(userId).select("name phone addresses");

    if (!user) {
      return sendErrorResponse(res, "User not found", 404);
    }

    return sendSuccessResponse(res, "Addresses fetched successfully", {
      userDefaultName: user.name,
      userDefaultPhone: user.phone,
      addresses: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/users/addresses
export const addAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(res, errors.array()[0]!.msg, 400);
    }

    const userId = (req as any).id;
    const user = await User.findById(userId);

    if (!user) {
      return sendErrorResponse(res, "User not found", 404);
    }

    if (!user.addresses) {
      user.addresses = [];
    }

    const {
      street,
      city,
      state,
      country,
      postalCode,
      isDefault,
      recipientName,
      recipientPhone,
    } = req.body;

    const addresses = user.addresses;
    const setAsDefault = isDefault || addresses.length === 0;

    if (setAsDefault) {
      addresses.forEach((addr: any) => {
        addr.isDefault = false;
      });
    }

    const newAddress = {
      street,
      city,
      state,
      country: country || "Nigeria",
      postalCode,
      recipientName,
      recipientPhone,
      isDefault: setAsDefault,
    };

    addresses.push(newAddress as any);
    await user.save();

    return sendSuccessResponse(
      res,
      "Address added successfully",
      user.addresses,
    );
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/users/addresses/:addressId
export const updateAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(res, errors.array()[0]!.msg, 400);
    }

    const userId = (req as any).id;
    const { addressId } = req.params;

    const user = await User.findById(userId);
    if (!user || !user.addresses) {
      return sendErrorResponse(res, "User or address not found", 404);
    }

    const address = user.addresses.find(
      (addr: any) => addr._id.toString() === addressId,
    );
    if (!address) {
      return sendErrorResponse(res, "Address not found", 404);
    }

    if (req.body.isDefault) {
      user.addresses.forEach((addr: any) => {
        addr.isDefault = false;
      });
    }

    Object.assign(address, req.body);
    await user.save();
    return sendSuccessResponse(
      res,
      "Address updated successfully",
      user.addresses,
    );
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/users/addresses/:addressId/default
export const setDefaultAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(res, errors.array()[0]!.msg, 400);
    }

    const userId = (req as any).id;
    const { addressId } = req.params;

    const user = await User.findById(userId);
    if (!user || !user.addresses) {
      return sendErrorResponse(res, "User or address not found", 404);
    }

    let found = false;
    user.addresses.forEach((addr: any) => {
      if (addr._id.toString() === addressId) {
        addr.isDefault = true;
        found = true;
      } else {
        addr.isDefault = false;
      }
    });

    if (!found) {
      return sendErrorResponse(res, "Address not found", 404);
    }

    await user.save();

    return sendSuccessResponse(
      res,
      "Default address updated successfully",
      user.addresses,
    );
  } catch (error) {
    next(error);
  }
};
export const deleteAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendErrorResponse(res, errors.array()[0]!.msg, 400);
    }

    const userId = (req as any).id;
    const { addressId } = req.params;

    const user = await User.findById(userId);
    if (!user || !user.addresses) {
      return sendErrorResponse(res, "User or address not found", 404);
    }

    const addressIndex = user.addresses.findIndex(
      (addr: any) => addr._id.toString() === addressId,
    );

    if (addressIndex === -1) {
      return sendErrorResponse(res, "Address not found", 404);
    }

    const wasDefault = user.addresses[addressIndex]!.isDefault;
    user.addresses.splice(addressIndex, 1);

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0]!.isDefault = true;
    }

    await user.save();

    return sendSuccessResponse(
      res,
      "Address deleted successfully",
      user.addresses,
    );
  } catch (error) {
    next(error);
  }
};
