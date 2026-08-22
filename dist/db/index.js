"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const mongoURI = process.env.LIVE_MONGODB_URI;
const stringifyURI = String(mongoURI);
const connectDB = async () => {
    try {
        const conns = await mongoose_1.default.connect(stringifyURI);
        console.log(`DB connected: host ${conns.connection.host}`);
    }
    catch (error) {
        console.error(`DB error: ${error.message}`);
    }
};
exports.default = connectDB;
//# sourceMappingURL=index.js.map