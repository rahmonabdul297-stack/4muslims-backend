// src/config/redis.ts
import dotenv from "dotenv";
dotenv.config();
import type { ConnectionOptions } from "bullmq";

const parsedPort = Number(process.env.REDIS_PORT) || 6379;

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST,
  port: parsedPort,
  password: process.env.REDIS_PASSWORD || undefined,
  tls: {
    rejectUnauthorized: false,
  },
  maxRetriesPerRequest: null,
};
