import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true }, // ✅ numeric for calculations
    category: {
      type: String,
      enum: [
        "Food & Drinks",
        "Travel & Transport",
        "Shopping",
        "Bills & Utilities",
        "Entertainment",
        "Other",
      ],
      default: "Other",
    },
    description: { type: String, trim: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", ExpenseSchema);
