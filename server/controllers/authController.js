import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// REGISTER
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const namePattern = /^[a-zA-Z\s.\-]{2,50}$/;
    if (!namePattern.test(name)) {
      return res.status(400).json({ message: "Invalid name format." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: cleanEmail, password: hashedPassword });

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.status(201).json({
      success: true,
      message: "Registration successful!",
      token,
      user: { _id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error("Register Error:", err);
    return res.status(500).json({ success: false, message: "Server error during registration." });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(400).json({ message: "User not found." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Wrong password." });

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email },
      message: "Login successful!"
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userId = req.params.id || req.params.userId;

    if (!userId) return res.status(400).json({ message: "User ID missing." });

    let user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (email && email.toLowerCase().trim() !== user.email) {
      const cleanEmail = email.toLowerCase().trim();
      const emailExists = await User.findOne({ email: cleanEmail });
      if (emailExists) return res.status(400).json({ message: "Email already in use." });
      user.email = cleanEmail;
    }

    if (name) {
      const namePattern = /^[a-zA-Z\s.\-]{2,50}$/;
      if (!namePattern.test(name)) return res.status(400).json({ message: "Invalid name format." });
      user.name = name.trim();
    }

    if (password && password.trim() !== "") {
      if (password.length < 8) return res.status(400).json({ message: "Password too short." });
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    return res.json({
      success: true,
      message: "Profile updated successfully!",
      user: { _id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    return res.status(500).json({ message: "Server error during profile update." });
  }
};
