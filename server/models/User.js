import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, // 🎯 HAREK USER KE LIYE LOCK: Yeh line har user ke liye duplicate email block karegi
    trim: true,   // Extra spaces ko remove karne ke liye
    lowercase: true // Taaki 'Yashi@' aur 'yashi@' ko same mana jaye
  },
  password: { 
    type: String, 
    required: true 
  }
}, { timestamps: true }); // Isse user kab bana, uska time bhi track hoga

const User = mongoose.model("User", userSchema);
export default User;