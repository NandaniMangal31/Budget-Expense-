import mongoose from "mongoose";

const BudgetSchema = new mongoose.Schema({
  // 👥 Linked via relational Object IDs for faster pipeline populations
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    unique: true 
  },
  // 🎯 FIX: Changed from String to Number to handle math validations
  totalBudget: { 
    type: Number, 
    default: 0 
  }, 
  // 🎯 FIX: Numeric targets enable instant comparison with expense fields
  categoryTargets: {
    "Food & Drinks": { type: Number, default: 0 },
    "Travel & Transport": { type: Number, default: 0 },
    "Shopping": { type: Number, default: 0 },
    "Bills & Utilities": { type: Number, default: 0 },
    "Entertainment": { type: Number, default: 0 },
    "Other": { type: Number, default: 0 }
  }
}, { timestamps: true });

export default mongoose.model("Budget", BudgetSchema);