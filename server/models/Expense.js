import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  userId: String,
  amount: Number,
  category: String,
  description: String,
  date: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Expense", expenseSchema);