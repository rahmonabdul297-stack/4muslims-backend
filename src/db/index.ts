import mongoose from "mongoose";
import dotenv from "dotenv";


const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.LIVE_MONGODB_URI;
    const conns = await mongoose.connect(mongoURI);
    console.log(`DB connected: host ${conns.connection.host}`);
  } catch (error) {
    console.error(`DB error: ${(error as Error).message}`);
  }
};

export default connectDB;
