import mongoose from "mongoose";
const connectDB = async () => {
  try {
    // 🎯 FIX: Global Mongoose configuration rule setup instead of inline options
    mongoose.set("autoIndex", true); 

    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error("🚨 Database Connection Error Failure Trace:", error.message);
    
    // Terminate server process instantly to prevent unhandled operational loop states
    process.exit(1);
  }
};

export default connectDB;