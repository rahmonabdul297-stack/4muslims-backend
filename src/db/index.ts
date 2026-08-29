import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.LIVE_MONGODB_URI;
  const conns = await mongoose.connect(String(mongoURI));
  console.log(`DB connected: host ${conns.connection.host}`);
};

export default connectDB;
