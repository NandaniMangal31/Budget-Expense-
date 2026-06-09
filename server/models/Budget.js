import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema({
  userId: String,
  monthlyBudget: Number
});

export default mongoose.model("Budget", budgetSchema);