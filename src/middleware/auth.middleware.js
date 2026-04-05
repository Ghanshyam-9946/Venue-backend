const jwt = require("jsonwebtoken");



const authMiddleware = (req, res, next) => {
  try {
    let token;

    // token get
    if (req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized"
      });
    }

    // verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 MOST IMPORTANT LINE
    req.user = decoded;   // 👈 yahi fix hai

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};


const isAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only"
    });
  }

  next();
};

const isSuperadmin = (req, res, next) => {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Superadmin only"
    });
  }

  next();
};

module.exports = {
    authMiddleware,
    isAdmin,
    isSuperadmin
};