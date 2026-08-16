import mongoose from "mongoose";
const mongoURI = process.env.LIVE_MONGODB_URI;
const stringifyURI = String(mongoURI)
const connectDB = async (): Promise<void> => {
  try {
    const conns = await mongoose.connect(stringifyURI);
    console.log(`DB connected: host ${conns.connection.host}`);
  } catch (error) {
    console.error(`DB error: ${(error as Error).message}`);
  }
};

export default connectDB;
