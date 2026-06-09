import express from "express";
import { addExpense, getExpenses,scanReceiptAndProcess } from "../controllers/expenseController.js";
import Expense from "../models/Expense.js"; 
import User from "../models/User.js";
import sendEmail from "../utils/sendemail.js"; 
// 🔒 Step 1: Authentication Middleware Import karein
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// 📝 1. ADD EXPENSE ROUTE PIPELINE (Secured via verifyToken)
router.post("/add", verifyToken, async (req, res) => {
  try {
    const { description, amount, category } = req.body;
    
    // 🎯 TOKEN PAYLOAD INTEGRATION: Front-end se userId mangne ki zaroorat nahi, token se nikalenge
    const userId = req.user._id; 
    const monthlyBudget = 1000; 
    // Naya expense database me save karein
    const newExpense = new Expense({ userId, description, amount, category });
    await newExpense.save();

    // User ka email dhundhein
    const user = await User.findById(userId);
    if (!user || !user.email) {
      return res.status(201).json(newExpense); 
    }

    // Purane saare expenses ka total sum nikalein (MongoDB Aggregation)
    const totalExpensesData = await Expense.aggregate([
      { $match: { userId: newExpense.userId } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    
    const totalSpent = totalExpensesData[0]?.total || 0;
    const usagePercentage = (totalSpent / monthlyBudget) * 100;

    // Threshold Checking Pipeline & Email Automation Triggers
    if (totalSpent >= monthlyBudget) {
      // 100% Exceed Alert
      await sendEmail(
        user.email,
        "⚠️ CRITICAL ALERT: Budget Limit Exceeded!",
        `Bhai ${user.name},\n\nAapka total expense ₹${totalSpent.toLocaleString()} ho gaya hai, jo aapke ₹${monthlyBudget.toLocaleString()} ke budget limit ko cross kar chuka hai! 🚨\n\nAb thoda haath rok lo aur fuzool kharchi band karo!`
      );
    } else if (usagePercentage >= 80) {
      // 80% Warning Alert
      await sendEmail(
        user.email,
        "🚨 WARNING: 80% Budget Used!",
        `Bhai ${user.name},\n\nDhyan do! Aapne apne monthly budget ka ${usagePercentage.toFixed(0)}% (₹${totalSpent.toLocaleString()}) use kar liya hai.\n\nLimit cross hone wali hai, sambhal kar kharch karo.`
      );
    }

    res.status(201).json(newExpense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});
router.post("/scan", verifyToken, scanReceiptAndProcess);
// 🗑️ 2. DELETE ROUTE PIPELINE (Secured via verifyToken)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const expenseId = req.params.id;
    const userId = req.user._id; // Current logged-in user

    // 🛡️ Security Check: Pehle verify karo ki yeh expense usi user ka hai jo delete kar raha hai
    const expense = await Expense.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ message: "Bhai yeh expense log record database me nahi mila!" });
    }

    if (expense.userId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized: Aap kisi aur ka expense delete nahi kar sakte bhai!" });
    }

    // Agar verification pass ho jaye, toh delete kar do
    await Expense.findByIdAndDelete(expenseId);

    return res.status(200).json({ message: "Expense record successfully wiped from database ecosystem." });
  } catch (error) {
    console.error("Backend DB Deletion Error Stack:", error);
    return res.status(500).json({ message: "Internal Server Error during deletion tracking pipeline." });
  }
});

// Existing boilerplate routes ko bhi secure kar diya hai
router.post("/", verifyToken, addExpense);
router.get("/:userId", verifyToken, getExpenses);

export default router;