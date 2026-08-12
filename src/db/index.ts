import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.LIVE_MONGODB_URI;
    if (!mongoURI) {
      throw new Error("LIVE_MONGODB_URI is not defined");
    }

    const conns = await mongoose.connect(mongoURI);
    console.log(`DB connected: host ${conns.connection.host}`);
  } catch (error) {
    console.error(`DB error: ${(error as Error).message}`);
  }
};

export default connectDB;
