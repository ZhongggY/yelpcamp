const mongoose = require("mongoose");
const campdbs = require("../models/campdbs");
const citys = require("./citys");
const { places, descriptors } = require("./helper");
main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/yelp-camp");
  console.log("success");
  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}
const sample = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};
const seedDB = async () => {
  await campdbs.deleteMany({});
  for (let index = 0; index < 200; index++) {
    const randoms = Math.floor(Math.random() * 1000);
    const c = new campdbs({
      title: `${sample(descriptors)}, ${sample(places)}`,
      location: `${citys[randoms].city},${citys[randoms].state}`,
      image: {
        url: "https://res.cloudinary.com/dfmfr3v8g/image/upload/v1689445303/YelpCamp/hayrfvkmfkilxpgsyxj1.jpg",
        fileName: "YelpCamp/hayrfvkmfkilxpgsyxj1",
      },
      geometry: {
        type: "Point",
        coordinates: [citys[randoms].longitude, citys[randoms].latitude],
      },
      description: "hello worlddd ",
      price: randoms,
      author: "64a8d6a97e738f248b2c6193",
    });
    await c.save();
  }
};
seedDB();
