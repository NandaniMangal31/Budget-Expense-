import jwt from "jsonwebtoken";
export const verifyToken = (req, res, next) => {
  try {
    // 🎯 Case-insensitive extraction layer
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "Access Denied: No authorization header token found." 
      });
    }

    // Split out token string safely
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Access Denied: Empty authentication parameters parsed." 
      });
    }

    // Verify token identity payload matches system secret key signature
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    // Inject decrypted token context (_id) directly into req pipeline lifecycle
    req.user = verified;
    
    return next(); 
  } catch (error) {
    console.error("🚨 JWT Verification Operational Failure:", error.message);
    
    // 🎯 FIX: Return 401 instead of 403 so frontend Axios response interceptors trigger logouts cleanly
    return res.status(401).json({ 
      success: false,
      message: "Invalid or Expired Token! Please reauthenticate to access workspace." 
    });
  }
};