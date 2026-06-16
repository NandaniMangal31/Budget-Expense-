import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  try {
    // 🎯 Case-insensitive check for Authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access Denied: Token not provided." });
    }

    // Extract token string
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Access Denied: Empty token value." });
    }

    // Verify token
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user metadata to request
    req.user = verified;

    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(403).json({ message: "Token expired. Please log in again." });
    }

    return res.status(403).json({ message: "Invalid token. Please log in again." });
  }
};
