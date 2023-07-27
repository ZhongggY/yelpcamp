const joi = require("joi");
const campSchema = joi.object({
  title: joi.string().required(),
  price: joi.number().min(0).required(),
  // image: joi.string().required(),
  location: joi.string().required(),
  description: joi.string().required(),
  deleteImage: joi.array(),
});
module.exports.campSchema = campSchema;
const reviewSchema = joi.object({
  rating: joi.number().required(),
  body: joi.string().required(),
});
module.exports.reviewSchema = reviewSchema;
