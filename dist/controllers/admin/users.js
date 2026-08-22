"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = exports.deleteUser = void 0;
const User_ts_1 = require("../../models/User.ts");
const helper_ts_1 = require("../../utils/helper.ts");
const mongoose_1 = require("mongoose");
const deleteUser = async (req, res) => {
    const { id } = req.params;
    if (!(0, mongoose_1.isValidObjectId)(id)) {
        return (0, helper_ts_1.sendErrorResponse)(res, "Invalid ID format!");
    }
    try {
        const deletedUser = await User_ts_1.User.findByIdAndDelete(id);
        if (!deletedUser) {
            return (0, helper_ts_1.sendErrorResponse)(res, "No user found with that ID!");
        }
        return (0, helper_ts_1.sendSuccessResponse)(res, "User successfully deleted!", deletedUser);
    }
    catch (error) {
        console.error("Error deleting user:", error);
        // 3. Updated the error message to match the operation
        return (0, helper_ts_1.sendErrorResponse)(res, "An error occurred while deleting the user", 500);
    }
};
exports.deleteUser = deleteUser;
const getAllUsers = async (req, res) => {
    try {
        const users = await User_ts_1.User.find();
        if (!users) {
            return (0, helper_ts_1.sendErrorResponse)(res, "no user found!");
        }
        return (0, helper_ts_1.sendSuccessResponse)(res, "here they are!", users);
    }
    catch (error) {
        return (0, helper_ts_1.sendErrorResponse)(res, "An error occurred while fetching users", 500);
    }
};
exports.getAllUsers = getAllUsers;
//# sourceMappingURL=users.js.map