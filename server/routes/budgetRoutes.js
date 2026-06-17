import express from "express"; 
import Budget from "../models/Budget.js";
import { verifyToken } from "../middleware/authMiddleware.js"; // 🔒 Security layer

const router = express.Router();

/**
 * 🔍 Fetch unique budget configuration dataset records
 */
router.get("/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || userId === "undefined" || userId === "null") {
      return res.status(400).json({ msg: "Active context user ID parameter is completely missing." });
    }

    let userBudget = await Budget.findOne({ userId });
    
    // 🎯 FIX: Updated fallback structures to return pure numbers instead of strings
    if (!userBudget) {
      return res.status(200).json({ 
        totalBudget: 0, 
        categoryTargets: {
          "Food & Drinks": 0,
          "Travel & Transport": 0,
          "Shopping": 0,
          "Bills & Utilities": 0,
          "Entertainment": 0,
          "Other": 0
        } 
      });
    }
    
    return res.status(200).json(userBudget);
  } catch (err) {
    console.error("🚨 Exception tracked inside GET /api/budgets route:", err);
    return res.status(500).json({ msg: "Internal Server Error fetching budget profiles." });
  }
});

/**
 * ⚡ Sync or instantiate budget allocation benchmarks
 */
router.post("/set", verifyToken, async (req, res) => {
  const { userId, totalBudget, categoryTargets } = req.body;

  if (!userId) {
    return res.status(400).json({ msg: "Bad Request: Missing unique identification user reference context." });
  }

  try {
    // ⚡ UPSERT ENGINE: Safe, direct arithmetic validation schema syncing
    const updatedBudget = await Budget.findOneAndUpdate(
      { userId },
      { 
        // 🎯 FIX: Stripped string defaults to align completely with schema Numbers
        totalBudget: Number(totalBudget) || 0, 
        categoryTargets: categoryTargets || {} 
      },
      { new: true, upsert: true, runValidators: true } 
    );

    return res.status(200).json({ 
      msg: "Budget milestones updated successfully! 🎯", 
      budget: updatedBudget 
    });
  } catch (err) {
    console.error("🚨 Exception tracked inside POST /api/budgets/set route:", err);
    return res.status(500).json({ msg: "Failed to sync personalized target limit data profiles." });
  }
});

export default router;