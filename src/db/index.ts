import mongoose from "mongoose";

const mongoURI = process.env.LIVE_MONGODB_URI;
const stringifyURI = String(mongoURI);

const connectDB = async (): Promise<void> => {
  try {
    const conns = await mongoose.connect(stringifyURI);
    console.log(`DB connected: host ${conns.connection.host}`);

    // Handle runtime connection errors after initial successful connect
    mongoose.connection.on("error", (error) => {
      console.error(`DB connection error: ${error.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("DB disconnected; attempting to reconnect in 5s...");
      setTimeout(() => {
        mongoose.connect(stringifyURI).catch((err) => {
          console.error(`DB reconnect failed: ${err.message}`);
        });
      }, 5000);
    });
  } catch (error) {
    console.error(`DB connection failed: ${(error as Error).message}`);
    // Fail fast: don't silently continue without a DB
    throw new Error(`MongoDB connection failed: ${(error as Error).message}`);
  }
};

export default connectDB;
