import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  // 👥 User Reference Layer tied cleanly to relational IDs
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true, 
    index: true // Kept! Speeds up dashboard queries dramatically
  },
  
  // 💰 Strict Numeric Allocation Buffer
  amount: {
    type: Number, 
    required: true,
    default: 0
  },
  
  // 🏷️ Categorization Struct
  category: {
    type: String,
    default: "Other",
    trim: true,
    // Restricts collection records to match frontend strings exactly
    enum: ["Groceries", "Food & Drinks", "Travel & Transport", "Shopping", "Bills & Utilities", "Entertainment", "Other"]
  },
  
  // 📝 Text Fields
  description: {
    type: String,
    default: "Scanned via Universal AI Scanner",
    trim: true
  },
  
  // 📎 Automation Metadata Metadata Guardrails
  scannedDocumentName: {
    type: String,
    default: null
  },
  
  // 📅 Temporal Engineering Layer
  date: {
    type: Date,
    default: Date.now
  },

  // 💸 expense = money out · received = credited / refund / income
  transactionType: {
    type: String,
    enum: ["expense", "received"],
    default: "expense",
    index: true,
  },
}, {
  timestamps: true 
});

export default mongoose.model("Expense", expenseSchema);