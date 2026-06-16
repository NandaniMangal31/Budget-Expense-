import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true, // ensures unique constraints are applied
    });
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("🚨 Database Connection Error:", error.message);
    process.exit(1);
  }
};

export default connectDB;
