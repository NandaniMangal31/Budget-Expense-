import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ==========================================
// REGISTER CONTROLLER (FIXED DUPLICATE ISSUE)
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

    // Email Validation
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

    // MongoDB Duplicate Key Error
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
// LOGIN CONTROLLER (CLEANED UP FOR FRONTEND)
// ==========================================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. FIND USER BY EMAIL
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" }); // 'msg' ki jagah 'message' kiya for consistency
    }

    // 2. COMPARE PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" }); // 'msg' ki jagah 'message' kiya
    }

    // 3. GENERATE JWT TOKEN
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    // 4. SUCCESS RESPONSE
    res.json({ token, user, message: "Login Successful!" });

  } catch (err) {
    console.error("Login Backend Error:", err);
    res.status(500).json({ message: "Server Error during login" });
  }
};