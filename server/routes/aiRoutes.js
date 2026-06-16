import express from "express";
import { categorizeExpense, getInsights } from "../controllers/aiController.js";

const router = express.Router();

router.post("/categorize", categorizeExpense);
router.post("/insights", getInsights);

export default router;