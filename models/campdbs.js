const mongoose = require("mongoose");
// const products = require("./models/product");
const schema = mongoose.Schema;
const campSchema = new schema({
  title: String,
  price: Number,
  image: [
    {
      url: String,
      fileName: String,
    },
  ],
  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  description: String,
  location: String,
  author: {
    type: schema.Types.ObjectId,
    ref: "users",
  },
  reviews: [
    {
      type: schema.Types.ObjectId,
      ref: "reviews",
    },
  ],
});
module.exports = mongoose.model("campGround", campSchema);
