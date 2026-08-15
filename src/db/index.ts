import mongoose from "mongoose";

mongoose.set("bufferCommands", false);

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.LIVE_MONGODB_URI;
    if (!mongoURI) {
      throw new Error("LIVE_MONGODB_URI is not defined");
    }

    const conns = await mongoose.connect(mongoURI);
    console.log(`DB connected: host ${conns.connection.host}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`DB error: ${message}`);
    throw error;
  }
};

export default connectDB;
