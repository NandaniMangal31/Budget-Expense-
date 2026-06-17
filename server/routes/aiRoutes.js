import express from "express";
import { categorizeExpense, getInsights } from "../controllers/aiController.js";
import { verifyToken } from "../middleware/authMiddleware.js"; // 🔒 Import security guard

const router = express.Router();

// Enforce token verification to protect AI billing balances
router.post("/categorize", verifyToken, categorizeExpense);
router.post("/insights", verifyToken, getInsights);

export default router;