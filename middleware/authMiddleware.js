const jwt = require("jsonwebtoken");
const User = require("../models/user");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized. No token." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-otp -otpExpiry");
    if (!user) return res.status(401).json({ message: "User not found." });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token invalid or expired." });
  }
};

module.exports = protect;