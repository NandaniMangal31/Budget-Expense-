import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  try {
    // 1. Request headers se authorization token nikalein
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access Denied: Token nahi mila bhai!" });
    }

    // "Bearer <token_string>" me se token string alag karein
    const token = authHeader.split(" ")[1];

    // 2. Token ko verify karein secret key ke sath
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    // User metadata ko request object me attach kar dein taaki controllers use kar sakein
    req.user = verified;
    
    next(); // Valid token hai, agle step/controller par jao
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    res.status(403).json({ message: "Invalid or Expired Token! Fir se login karo." });
  }
};