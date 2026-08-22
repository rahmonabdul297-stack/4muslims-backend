"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
// src/config/redis.ts
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const parsedPort = Number(process.env.REDIS_PORT) || 6379;
exports.redisConnection = {
    host: process.env.REDIS_HOST,
    port: parsedPort,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: {
        rejectUnauthorized: false,
    },
    maxRetriesPerRequest: null,
};
//# sourceMappingURL=redis.js.map