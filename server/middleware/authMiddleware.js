import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  try {
    // 🎯 FIX: Case-insensitive check (Mobile safeguard)
    // Yeh check karega 'Authorization' aur 'authorization' dono ko!
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access Denied: Token nahi mila bhai!" });
    }

    // "Bearer <token_string>" me se token string alag karein
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Access Denied: Empty token value string." });
    }

    // 2. Token ko verify karein secret key ke sath
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    // User metadata ko request object me attach kar dein
    req.user = verified;
    
    next(); 
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    // Agar token expire ho gaya ho ya corrupted ho
    return res.status(403).json({ message: "Invalid or Expired Token! Fir se login karo." });
  }
};