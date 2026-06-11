import express from "express"; 
const router = express.Router();
import Budget from "../models/Budget.js";

router.post("/set", async (req, res) => {
  const { userId, totalBudget, categoryTargets } = req.body;

  // 🚨 PAYLOAD SANITIZATION: Bad request validation
  if (!userId) {
    return res.status(400).json({ msg: "Bad Request: Missing unique identification user reference token context" });
  }

  try {
    // ⚡ UPSERT ALGORITHM: Agar record hai toh modify karo, nahi hai toh instantly create karo
    const updatedBudget = await Budget.findOneAndUpdate(
      { userId },
      { 
        totalBudget: totalBudget || "0", 
        categoryTargets: categoryTargets || {} 
      },
      { new: true, upsert: true, runValidators: true } 
    );

    return res.status(200).json({ 
      msg: "Budget milestones updated successfully! 🎯", 
      budget: updatedBudget 
    });
  } catch (err) {
    console.error("Critical Exception in POST /api/budgets/set configuration matrix:", err);
    return res.status(500).json({ msg: "Failed to sync personalized target limit data profiles" });
  }
});



router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // 🚨 STAGE 1 SAFETY CHECK: ID valid hai ya nahi validator matrix
    if (!userId || userId === "undefined" || userId === null) {
      return res.status(400).json({ msg: "Active context user ID parameter is completely missing." });
    }

    let userBudget = await Budget.findOne({ userId });
    
    // 🚨 STAGE 2 FALLBACK: Agar database me entry nahi milti toh frontend crash hone se bachao
    if (!userBudget) {
      return res.status(200).json({ 
        totalBudget: "0", 
        categoryTargets: {
          "Food & Drinks": "0",
          "Travel & Transport": "0",
          "Shopping": "0",
          "Bills & Utilities": "0",
          "Entertainment": "0",
          "Other": "0"
        } 
      });
    }
    
    return res.status(200).json(userBudget);
  } catch (err) {
    console.error("Critical Exception in GET /api/budgets pipeline:", err);
    return res.status(500).json({ msg: "Internal Server Error fetching budget data profiles" });
  }
});


export default router;