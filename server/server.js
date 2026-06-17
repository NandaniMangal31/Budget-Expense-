import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// Gateway Routing Implementations
import authRoutes from "./routes/authRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";

// Initialize Environment Vector Matrices
dotenv.config();

// Initialize MongoDB Cluster Connection Layer
connectDB();

const app = express();

/**
 * 🔒 CORS CORS CONFIGURATION POLICY MATRIX
 * Restricts cross-origin resource allocations to explicit client domains only
 */
app.use(cors({
  origin: [
    "https://smart-spending-frontend.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  credentials: true
}));

/**
 * 🎚️ MEMORY STREAM INBOUND PARSERS
 * Headroom configurations tailored explicitly to accept heavy AI multi-page document buffers
 */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/**
 * 🩺 ARCHITECTURE HEALTH DEPLOYMENT CHECK ROUTE
 */
app.get("/", (req, res) => {
  return res.status(200).send("🚀 Smart Spending Core Backend Pipeline is fully operational!");
});

/**
 * 🗺️ SYSTEM ENDPOINT GATEWAYS
 */
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/budgets", budgetRoutes);

/**
 * 🚨 CENTRAL REJECTION SAFETY LAYER MIDDLEWARE
 * Traps runtime operational exceptions preventing raw engineering error stack leaks
 */
app.use((err, req, res, next) => {
  console.error("🚨 CRITICAL CORE EXCEPTION INTERCEPTED:", err.stack || err.message || err);
  
  return res.status(500).json({ 
    success: false, 
    message: "An unexpected system operation anomaly was encountered. Core pipeline secure." 
  });
});

const PORT = process.env.PORT || 5000;

// Instantiate active HTTP listener context
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

/**
 * ⚡ HIGH-VOLUME TIMEOUT SAFETY TUNING
 * Extends connection lifecycles to 2 minutes exclusively for heavy background operations
 * (e.g., parsing 50+ line items through your budgetAlertEngine without connection drops)
 */
server.timeout = 120000; 

export default app;