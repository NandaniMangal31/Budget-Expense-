import express from "express";
import { register, login, updateProfile } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.put("/update/:id", verifyToken, updateProfile);

export default router;
