const express = require("express");
const router = express.Router();
const Item = require("../models/item");
const protect = require("../middleware/authMiddleware");

const jwt = require("jsonwebtoken");
const User = require("../models/user");

const optionalAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      const token = auth.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-otp -otpExpiry");
    }
  } catch (_) {}
  next();
};

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ CRITICAL: Specific routes MUST come BEFORE generic routes like /:id
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/items — create listing (must be logged in)
router.post("/", protect, async (req, res) => {
  try {
    const { title, desc, category, condition, price, location, images } = req.body;
    if (!title || !price)
      return res.status(400).json({ message: "Title and price are required." });

    const item = await Item.create({
      seller: req.user._id,
      title: title.trim(),
      desc: desc?.trim() || "",
      category: category || "",
      condition: condition || "",
      price: Number(price),
      location: location?.trim() || "",
      images: Array.isArray(images) ? images : [],
    });

    await item.populate("seller", "name email phone photoUrl");

    res.status(201).json({ message: "Listing created.", item });
  } catch (err) {
    console.error("Create item error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 🔒 PROTECTED ROUTES (must come before public routes)
// ──────────────────────────────────────────────────────────────────────────

// GET /api/items/user/my-items — current user's own listings (PROTECTED)
router.get("/user/my-items", protect, async (req, res) => {
  try {
    console.log("📦 Fetching items for user:", req.user._id);
    
    const items = await Item.find({ seller: req.user._id })
      .populate("seller", "name email phone photoUrl")
      .sort({ createdAt: -1 });

    console.log("✅ Found", items.length, "items for user");
    res.json({ items: items || [] });
  } catch (err) {
    console.error("❌ Get user items error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 🌍 PUBLIC ROUTES (after protected routes)
// ──────────────────────────────────────────────────────────────────────────

// GET /api/items — all unsold items (excludes user's own if logged in)
router.get("/", optionalAuth, async (req, res) => {
  try {
    console.log("📋 Fetching all items. User logged in:", !!req.user);
    
    const filter = { sold: false };
    
    // If user is logged in, exclude their own items
    if (req.user) {
      filter.seller = { $ne: req.user._id };
      console.log("🚫 Excluding items from seller:", req.user._id);
    }

    const items = await Item.find(filter)
      .populate("seller", "name email phone photoUrl")
      .sort({ createdAt: -1 });

    console.log("✅ Returning", items.length, "items");
    res.json({ items });
  } catch (err) {
    console.error("❌ Get items error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/items/category/:category — filter items by category
router.get("/category/:category", optionalAuth, async (req, res) => {
  try {
    const filter = { sold: false, category: req.params.category };
    if (req.user) filter.seller = { $ne: req.user._id };

    const items = await Item.find(filter)
      .populate("seller", "name email phone photoUrl")
      .sort({ createdAt: -1 });

    res.json({ items });
  } catch (err) {
    console.error("Get category items error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/items/search/query — search items by title or description
router.get("/search/query", optionalAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ items: [] });

    const filter = {
      sold: false,
      $or: [
        { title: { $regex: q, $options: "i" } },
        { desc: { $regex: q, $options: "i" } },
      ],
    };

    if (req.user) filter.seller = { $ne: req.user._id };

    const items = await Item.find(filter)
      .populate("seller", "name email phone photoUrl")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ items });
  } catch (err) {
    console.error("Search items error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/items/:id — get single item by ID (AFTER specific routes)
// ──────────────────────────────────────────────────────────────────────────
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate(
      "seller",
      "name email phone photoUrl"
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    res.json({ item });
  } catch (err) {
    console.error("Get single item error:", err);
    // Handle invalid ObjectId format
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Item not found." });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/items/:id — edit own listing (must be logged in, must be owner)
router.put("/:id", protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found." });

    if (item.seller.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorised to edit this listing." });

    const { title, desc, category, condition, price, location, images } = req.body;

    if (title) item.title = title.trim();
    if (desc !== undefined) item.desc = desc.trim();
    if (category) item.category = category;
    if (condition !== undefined) item.condition = condition;
    if (price !== undefined) item.price = Number(price);
    if (location) item.location = location.trim();
    if (images) item.images = Array.isArray(images) ? images : item.images;

    await item.save();
    await item.populate("seller", "name email phone photoUrl");

    res.json({ message: "Listing updated.", item });
  } catch (err) {
    console.error("Update item error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/items/:id — delete own listing (must be logged in, must be owner)
router.delete("/:id", protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found." });

    if (item.seller.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorised to delete this listing." });

    await item.deleteOne();
    res.json({ message: "Listing deleted." });
  } catch (err) {
    console.error("Delete item error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;