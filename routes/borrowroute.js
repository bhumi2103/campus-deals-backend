const express    = require("express");
const router     = express.Router();
const BorrowItem = require("../models/borrowItem");
const protect    = require("../middleware/authMiddleware");

// ── optional auth middleware ──────────────────────────────────────────────────
// Attaches req.user if a valid token is present, but does NOT block the request.
// Same pattern as itemroute.js, used so guests can browse the Borrow page.
const jwt  = require("jsonwebtoken");
const User = require("../models/user");

const optionalAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      const token   = auth.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-otp -otpExpiry");
    }
  } catch (_) {
    // invalid / expired token → just continue as guest
  }
  next();
};

const ALLOWED_CATEGORIES = [
  "Textbooks", "Electronics", "Furniture", "Clothing",
  "Bikes", "Sports", "Appliances", "Gaming", "Others",
];

const ALLOWED_SORTS = {
  newest:     { createdAt: -1 },
  oldest:     { createdAt: 1 },
  "price-low":  { price: 1 },
  "price-high": { price: -1 },
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/borrow  — create a lend listing  (must be logged in)
// Body: { title, desc, category, price, location, duration, images }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", protect, async (req, res) => {
  try {
    const { title, desc, category, price, location, duration, images } = req.body;

    if (!title || !price || !location) {
      return res
        .status(400)
        .json({ message: "Title, price and location are required." });
    }

    const item = await BorrowItem.create({
      lender:   req.user._id,
      title:    title.trim(),
      desc:     desc?.trim()     || "",
      category: category         || "",
      price:    Number(price),
      location: location.trim(),
      duration: duration?.trim() || "",
      images:   Array.isArray(images) ? images : [],
    });

    res.status(201).json({ message: "Listing created.", item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/borrow  — browse listings on the Borrow tab  (no login required)
//   • If logged in  → excludes the user's own listings
//   • If guest      → shows everything
//   • Only shows items still marked available
//
// Query params:
//   category  e.g. ?category=Electronics   (omit or "All" → no category filter)
//   search    e.g. ?search=camera          (matches title or desc, case-insensitive)
//   sort      e.g. ?sort=price-low         (newest | oldest | price-low | price-high)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { category, search, sort } = req.query;

    const filter = { available: true };
    if (req.user) filter.lender = { $ne: req.user._id };

    if (category && category !== "All" && ALLOWED_CATEGORIES.includes(category)) {
      filter.category = category;
    }

    if (search && search.trim()) {
      const re = new RegExp(search.trim(), "i");
      filter.$or = [{ title: re }, { desc: re }];
    }

    const sortOption = ALLOWED_SORTS[sort] || ALLOWED_SORTS.newest;

    const items = await BorrowItem.find(filter)
      .populate("lender", "name email")
      .sort(sortOption);

    res.json({ items, count: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/borrow/mine  — current user's own lend listings  (must be logged in)
// Used by the "My Lend Listings" tab. Includes pending requests on each item.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/mine", protect, async (req, res) => {
  try {
    const items = await BorrowItem.find({ lender: req.user._id })
      .populate("requests.requester", "name email")
      .sort({ createdAt: -1 });

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/borrow/:id  — delete own lend listing  (must be logged in)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", protect, async (req, res) => {
  try {
    const item = await BorrowItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Listing not found." });

    if (item.lender.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorised to delete this listing." });

    await item.deleteOne();
    res.json({ message: "Listing deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/borrow/:id/availability  — toggle available on/off  (lender only)
// Body: { available: boolean }
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/availability", protect, async (req, res) => {
  try {
    const item = await BorrowItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Listing not found." });

    if (item.lender.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorised to update this listing." });

    item.available = !!req.body.available;
    await item.save();

    res.json({ message: "Availability updated.", item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/borrow/:id/request  — send a borrow request  (must be logged in)
// Body: { message }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/request", protect, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "A message to the lender is required." });
    }

    const item = await BorrowItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Listing not found." });

    if (item.lender.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You can't request your own listing." });
    }

    if (!item.available) {
      return res.status(400).json({ message: "This item is currently unavailable." });
    }

    const alreadyRequested = item.requests.some(
      (r) => r.requester.toString() === req.user._id.toString() && r.status === "pending"
    );
    if (alreadyRequested) {
      return res.status(409).json({ message: "You've already requested this item." });
    }

    item.requests.push({ requester: req.user._id, message: message.trim() });
    await item.save();

    res.status(201).json({ message: "Request sent to the lender." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/borrow/:id/requests/:requestId  — accept/decline a request  (lender only)
// Body: { status: "accepted" | "declined" }
// Accepting a request automatically marks the listing unavailable.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/requests/:requestId", protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'accepted' or 'declined'." });
    }

    const item = await BorrowItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Listing not found." });

    if (item.lender.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorised to manage this listing." });

    const request = item.requests.id(req.params.requestId);
    if (!request) return res.status(404).json({ message: "Request not found." });

    request.status = status;
    if (status === "accepted") item.available = false;

    await item.save();
    res.json({ message: `Request ${status}.`, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;