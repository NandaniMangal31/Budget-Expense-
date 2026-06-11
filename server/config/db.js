import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // 🎯 FIX: autoIndex ko true kiya taaki unique constraints database mein automatic apply ho sakein
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true, 
    });
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("Database Connection Error:", error);
    process.exit(1);
  }
};

export default connectDB;