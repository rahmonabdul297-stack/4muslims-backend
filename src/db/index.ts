import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | undefined;

const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.LIVE_MONGODB_URI;

  if (!mongoURI) {
    throw new Error("LIVE_MONGODB_URI is not configured.");
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (mongoose.connection.readyState === 0) {
    connectionPromise = undefined;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(mongoURI)
      .then((connection) => {
        console.log(`DB connected: host ${connection.connection.host}`);
        return connection;
      })
      .catch((error: unknown) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  await connectionPromise;
};

export default connectDB;
