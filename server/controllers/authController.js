import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// NAME VALIDATION REGEX PATTERN MATCH
const NAME_PATTERN = /^[a-zA-Z\s.\-]{2,50}$/;

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !NAME_PATTERN.test(name)) {
      return res.status(400).json({
        message: "Invalid Name! Only alphabets, spaces, dots, and hyphens are allowed (2-50 chars)."
      });
    }

    const cleanEmail = email?.toLowerCase().trim();
    if (!cleanEmail) {
      return res.status(400).json({ message: "A valid email address is required" });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email address"
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword
    });

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

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
    console.error("🚨 Register Backend Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error occurred during registration."
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials provided" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials provided" });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

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
    console.error("🚨 Login Backend Error:", err);
    return res.status(500).json({ message: "Internal Server Error during login verification." });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userId = req.params.id || req.params.userId;

    if (!userId) {
      return res.status(400).json({ message: "User Identity parameter tracking missing." });
    }

    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User workspace target not found" });
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      const cleanEmail = email.toLowerCase().trim();
      const emailExists = await User.findOne({ email: cleanEmail });
      if (emailExists) {
        return res.status(400).json({ message: "This email is already linked to another user account" });
      }
      user.email = cleanEmail;
    }

    if (name) {
      if (!NAME_PATTERN.test(name)) {
        return res.status(400).json({ message: "Invalid character configurations formatted on name parameter." });
      }
      user.name = name.trim();
    }

    if (password && password.trim() !== "") {
      if (password.length < 8) {
        return res.status(400).json({ message: "Password updates must contain 8 characters minimum." });
      }
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    return res.json({ 
      success: true, 
      message: "Profile updated successfully! 🎉", 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      } 
    });

  } catch (err) {
    console.error("🚨 Profile Engine Update Error Failure Trace:", err);
    return res.status(500).json({ message: "An operational failure occurred updating profile parameters." });
  }
};