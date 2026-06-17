import express from "express";
import { register, login, updateProfile } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public Authentication Endpoints
router.post("/register", register);
router.post("/login", login);

// 🔒 Protected Profile Settings (Cleaned up URL parameter to rely on token identity)
router.post("/update", verifyToken, updateProfile);

export default router;