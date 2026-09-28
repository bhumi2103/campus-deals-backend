const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true, // For faster search
    },
    desc: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Textbooks",
        "Electronics",
        "Furniture",
        "Gaming",
        "Transport",
        "Appliances",
        "Sports",
        "Others",
      ],
      default: "Others",
      index: true, // For faster filtering
    },
    condition: {
      type: String,
      enum: ["Like New", "Good", "Fair", "Used"],
      default: "Like New",
    },
    price: {
      type: Number,
      required: true,
      index: true, // For sorting by price
    },
    location: {
      type: String,
      default: "On Campus",
      trim: true,
    },
    images: [
      {
        type: String, // base64 or URLs
      },
    ],
    sold: {
      type: Boolean,
      default: false,
      index: true, // For filtering unsold items
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
itemSchema.index({ sold: 1, createdAt: -1 });
itemSchema.index({ sold: 1, category: 1 });
itemSchema.index({ seller: 1, sold: 1 });

module.exports = mongoose.model("Item", itemSchema);