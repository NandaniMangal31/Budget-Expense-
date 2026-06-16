import mongoose from "mongoose";

const BudgetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    totalBudget: { type: Number, default: 0 }, // ✅ store as Number for calculations
    categoryTargets: {
      "Food & Drinks": { type: Number, default: 0 },
      "Travel & Transport": { type: Number, default: 0 },
      "Shopping": { type: Number, default: 0 },
      "Bills & Utilities": { type: Number, default: 0 },
      "Entertainment": { type: Number, default: 0 },
      "Other": { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Budget", BudgetSchema);
