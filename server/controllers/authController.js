import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ==========================================
// REGISTER CONTROLLER
// ==========================================
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Name Validation
    const namePattern = /^[a-zA-Z\s.\-]{2,50}$/;

    if (!namePattern.test(name)) {
      return res.status(400).json({
        message:
          "Invalid Name! Only alphabets, spaces, dots, and hyphens are allowed."
      });
    }

    // Email Validation & Normalization (Mobile Safeguard)
    const cleanEmail = email.toLowerCase().trim();

    // Check Existing User
    const existingUser = await User.findOne({
      email: cleanEmail
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email address"
      });
    }

    // Password Validation
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long"
      });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword
    });

    // Generate JWT
    const token = jwt.sign(
      { _id: user._id },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    return res.status(201).json({
      success: true,
      message: "Registration Successful!",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error("Register Backend Error:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server Error during registration"
    });
  }
};

// ==========================================
// LOGIN CONTROLLER (FIXED FOR MOBILE KEYS)
// ==========================================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // 🎯 CRITICAL FIXED LAYER: Mobile phone keyboard auto-capitalization safeguard
    const cleanEmail = email.toLowerCase().trim();

    // 1. FIND USER BY CLEAN EMAIL
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // 2. COMPARE PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" });
    }

    // 3. GENERATE JWT TOKEN
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    // 4. SUCCESS RESPONSE (Sanatized to prevent leaking password hashes)
    return res.json({ 
      success: true,
      token, 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }, 
      message: "Login Successful!" 
    });

  } catch (err) {
    console.error("Login Backend Error:", err);
    return res.status(500).json({ message: "Server Error during login" });
  }
};

// ==========================================
// IDENTITY & PROFILE UPDATE CONTROLLER
// ==========================================
export const updateProfile = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userId = req.params.id || req.params.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID parameter is missing in dynamic endpoint request." });
    }

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User workspace not found" });
    }

    // Email uniqueness check with normalization
    if (email && email.toLowerCase().trim() !== user.email) {
      const cleanEmail = email.toLowerCase().trim();
      const emailExists = await User.findOne({ email: cleanEmail });
      if (emailExists) {
        return res.status(400).json({ message: "This email is already registered with another account" });
      }
      user.email = cleanEmail;
    }

    if (name) {
      const namePattern = /^[a-zA-Z\s.\-]{2,50}$/;
      if (!namePattern.test(name)) {
        return res.status(400).json({
          message: "Invalid Name! Only alphabets, spaces, dots, and hyphens are allowed."
        });
      }
      user.name = name.trim();
    }

    if (password && password.trim() !== "") {
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    await user.save();

    const updatedUser = {
      _id: user._id,
      name: user.name,
      email: user.email
    };

    return res.json({ 
      success: true, 
      message: "Profile updated successfully! 🎉", 
      user: updatedUser 
    });

  } catch (err) {
    console.error("Profile Engine Update Error:", err);
    return res.status(500).json({ message: "Server Error during profile adjustment execution" });
  }
};