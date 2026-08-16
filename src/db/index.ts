import mongoose from "mongoose";
const mongoURI = process.env.LIVE_MONGODB_URI;
const connectDB = async (): Promise<void> => {
  try {
    const conns = await mongoose.connect(String(mongoURI));
    console.log(`DB connected: host ${conns.connection.host}`);
  } catch (error) {
    console.error(`DB error: ${(error as Error).message}`);
  }
};

export default connectDB;
