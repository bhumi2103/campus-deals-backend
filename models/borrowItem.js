const mongoose = require("mongoose");

// One sub-document per borrow request made on a listing.
const requestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message:  { type: String, default: "", trim: true },
    status:   { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  },
  { timestamps: true }
);

const borrowItemSchema = new mongoose.Schema(
  {
    lender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title:       { type: String, required: true, trim: true },
    desc:        { type: String, default: "", trim: true },
    category:    { type: String, default: "" },
    price:       { type: Number, required: true },   // price per week
    location:    { type: String, default: "", trim: true },
    duration:    { type: String, default: "" },       // e.g. "Up to 7 days"
    images:      [{ type: String }],                  // base64 or URLs
    available:   { type: Boolean, default: true },    // false once lent out
    requests:    [requestSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BorrowItem", borrowItemSchema);