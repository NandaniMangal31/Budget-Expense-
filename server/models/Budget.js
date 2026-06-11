import mongoose from "mongoose";

const BudgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  totalBudget: { type: String, default: "0" }, // e.g., "50000" or "5 Lakh"
  categoryTargets: {
    Food: { type: String, default: "0" },
    Travel: { type: String, default: "0" },
    Shopping: { type: String, default: "0" },
    Bills: { type: String, default: "0" },
    Entertainment: { type: String, default: "0" },
    Other: { type: String, default: "0" }
  }
}, { timestamps: true });

export default mongoose.model("Budget", BudgetSchema);