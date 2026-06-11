import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
// 🚨 Variable renamed to 'budgetRoutes' for clean structural naming
import budgetRoutes from "./routes/budgetRoutes.js";

dotenv.config();
connectDB();

const app = express();

// 1. CORS CONFIGURATION
app.use(cors({
  origin: [
    "https://smart-spending-frontend.vercel.app/",
    "https://smart-spending-frontend.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ], 
  credentials: true
}));

// 2. PARSER MIDDLEWARES (🚨 CRITICAL: Always place these BEFORE any app.use("/api/...") routes!)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 3. API ROUTE ROUTERS REGISTER
app.use("/api/budgets", budgetRoutes); // Fixed: Properly placed here so it can read req.body safely
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});