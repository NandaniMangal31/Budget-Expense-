import express from "express";
import { categorizeExpense, getInsights } from "../controllers/aiController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/categorize", verifyToken, categorizeExpense);
router.post("/insights", verifyToken, getInsights);

export default router;
