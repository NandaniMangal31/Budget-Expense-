import express from "express"; 
import Budget from "../models/Budget.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET user budget
router.get("/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || userId === "undefined" || userId === null) {
      return res.status(400).json({ msg: "Missing user ID parameter." });
    }

    let userBudget = await Budget.findOne({ userId });

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
    console.error("🚨 GET /api/budgets error:", err);
    return res.status(500).json({ msg: "Internal Server Error fetching budget data." });
  }
});

// SET or UPDATE budget
router.put("/set", verifyToken, async (req, res) => {
  const { userId, totalBudget, categoryTargets } = req.body;

  if (!userId) {
    return res.status(400).json({ msg: "Missing user ID in request body." });
  }

  try {
    const updatedBudget = await Budget.findOneAndUpdate(
      { userId },
      { 
        totalBudget: Number(totalBudget) || 0, 
        categoryTargets: Object.fromEntries(
          Object.entries(categoryTargets || {}).map(([k, v]) => [k, Number(v) || 0])
        )
      },
      { new: true, upsert: true, runValidators: true } 
    );

    return res.status(200).json({ 
      msg: "Budget updated successfully 🎯", 
      budget: updatedBudget 
    });
  } catch (err) {
    console.error("🚨 POST /api/budgets/set error:", err);
    return res.status(500).json({ msg: "Failed to update budget." });
  }
});

export default router;
