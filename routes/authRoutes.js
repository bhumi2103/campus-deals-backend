const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const User = require("../models/user");
const sendEmail = require("../utils/sendEmails");
const protect = require("../middleware/authMiddleware");

// ── helper: generate 6-digit OTP ─────────────────────────────────────────────
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/auth/login/send-otp
router.post("/login/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res
        .status(404)
        .json({ message: "No account found with this email. Please sign up." });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
    await user.save();

    await sendEmail(email, otp, "login");

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login/verify-otp
router.post("/login/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP. Please try again." });
    }

    if (user.otpExpiry < Date.now()) {
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    // Clear OTP fields
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        photoUrl: user.photoUrl || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SIGNUP ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/auth/signup/send-otp
router.post("/signup/send-otp", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required." });
    }

    const existingUser = await User.findOne({
      email: email.trim().toLowerCase(),
      isVerified: true,
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists. Please log in." });
    }

    const otp = generateOtp();

    let user = await User.findOne({ email: email.trim().toLowerCase() });

    if (user) {
      user.name = name.trim();
      user.otp = otp;
      user.otpExpiry = Date.now() + 5 * 60 * 1000;
    } else {
      user = new User({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        otp,
        otpExpiry: Date.now() + 5 * 60 * 1000,
      });
    }

    await user.save();
    await sendEmail(email, otp, "signup");

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/signup/verify-otp
router.post("/signup/verify-otp", async (req, res) => {
  try {
    const { email, otp, name } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: "User not found. Please sign up again." });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP. Please try again." });
    }

    if (user.otpExpiry < Date.now()) {
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    // Finalise registration
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    if (name) user.name = name.trim();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Account created successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        photoUrl: user.photoUrl || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE (protected)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/auth/update-profile
// Headers: { Authorization: "Bearer <token>", Content-Type: "multipart/form-data" }
// Body: { name, phone, photo (file) }
router.post("/update-profile", protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const photoFile = req.files?.photo;

    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required." });
    }

    // Update basic fields
    req.user.name = name.trim();
    
    // Update phone if provided
    if (phone !== undefined) {
      req.user.phone = phone.trim();
    }

    // Handle photo upload if provided
    if (photoFile) {
      // Validate file type
      const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedMimes.includes(photoFile.mimetype)) {
        return res.status(400).json({ message: "Invalid image format. Allowed: JPG, PNG, GIF, WebP" });
      }

      // Validate file size (5MB max)
      if (photoFile.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "File size exceeds 5MB limit." });
      }

      // Generate unique filename
      const ext = path.extname(photoFile.name);
      const filename = `${req.user._id}-${Date.now()}${ext}`;
      const filepath = path.join(uploadsDir, filename);

      // Save file
      await photoFile.mv(filepath);

      // Delete old photo if exists
      if (req.user.photoUrl) {
        const oldFilename = req.user.photoUrl.replace("/uploads/", "");
        const oldPath = path.join(uploadsDir, oldFilename);
        try {
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        } catch (fileErr) {
          console.warn("Could not delete old photo:", fileErr.message);
        }
      }

      // Store relative path for database
      req.user.photoUrl = `/uploads/${filename}`;
    }

    await req.user.save();

    res.json({
      message: "Profile updated successfully.",
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || "",
        photoUrl: req.user.photoUrl || null,
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: err.message || "Failed to update profile." });
  }
});

module.exports = router;