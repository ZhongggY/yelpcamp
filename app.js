require("dotenv").config();

const multer = require("multer");
const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const campdbs = require("./models/campdbs");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const asyncCatch = require("./models/tools/asyncCatch");
const errorHandler = require("./models/tools/errorHandler");
const session = require("express-session");
const { campSchema, reviewSchema } = require("./views/schemas/validateSc");
const reviews = require("./models/reviews");
const flash = require("connect-flash");
const passport = require("passport");
const passportLocal = require("passport-local");
const User = require("./models/user");
const { LoginIn, storeReturnTo } = require("./models/tools/loginMiddle");
const { cloudinary, storage } = require("./cloudinary");
const upload = multer({ storage });
const mbxGeo = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAPBOX_TOKEN;
const geoCoder = mbxGeo({ accessToken: mapToken });
const mongoURL = process.env.MONGO_URL;
const MongoDBStore = require("connect-mongo")(session);
main().catch((err) => console.log(err));

async function main() {
  //"mongodb://127.0.0.1:27017/yelp-camp"
  await mongoose.connect(mongoURL);
  console.log("success");
}
const store = new MongoDBStore({
  url: mongoURL,
  secret: "hello world",
  touchAfter: 24 * 60 * 60,
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
const sessionConfig = {
  store,
  secret: "hello world",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};
app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public")));
passport.use(new passportLocal(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");

  next();
});

const validateCamp = (req, res, next) => {
  const { error } = campSchema.validate(req.body);

  if (error) {
    const msg = error.details.map((el) => el.message).join(",");

    throw new errorHandler(msg, 400);
  } else {
    next();
  }
};
const validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);

  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new errorHandler(msg, 400);
  } else {
    next();
  }
};
const authorization = async (req, res, next) => {
  const { id } = req.params;
  const camps = await campdbs.findById(id);
  if (!camps.author.equals(req.user._id)) {
    req.flash("error", "You can not edit this information");
    return res.redirect(`/camp/${id}`);
  }
  next();
};
const reviewAuthorization = async (req, res, next) => {
  const { id, reviewID } = req.params;
  const review = await reviews.findById(reviewID);
  if (!review.author.equals(req.user._id)) {
    req.flash("error", "You can not delete this review!");
    return res.redirect(`/camp/${id}`);
  }
  next();
};
app.get("/", (req, res) => {
  res.render("home");
});
app.get(
  "/camp",
  asyncCatch(async (req, res) => {
    const camps = await campdbs.find({});
    res.render("camps", { camps });
  })
);
// app.post("/camp", upload.array("image"), (req, res) => {
//   console.log(req.files);
// });
app.post(
  "/camp",
  LoginIn,
  upload.array("image"),
  validateCamp,

  asyncCatch(async (req, res) => {
    const getData = await geoCoder
      .forwardGeocode({
        query: req.body.location,
        limit: 1,
      })
      .send();

    if (!req.body) {
      throw new errorHandler("data is invalid", 400);
    }
    const camp = new campdbs(req.body);
    camp.geometry = getData.body.features[0].geometry;
    camp.image = req.files.map((file) => ({
      url: file.path,
      fileName: file.filename,
    }));

    camp.author = req.user._id;
    await camp.save();
    console.log(camp);
    req.flash("success", "success made a new camp");
    res.redirect(`/camp/${camp._id}`);
  })
);
app.post(
  "/camp/:id/reviews",
  LoginIn,
  validateReview,
  asyncCatch(async (req, res) => {
    const camp = await campdbs.findById(req.params.id);
    const review = new reviews(req.body);
    review.author = req.user._id;
    await review.save();

    camp.reviews.push(review);
    await camp.save();
    req.flash("success", "you made a new comment successfully");
    res.redirect(`/camp/${camp._id}`);
  })
);
app.get(
  "/camp/new",
  LoginIn,
  asyncCatch(async (req, res) => {
    const camps = await campdbs.find({});

    res.render("newCamp");
  })
);
app.get(
  "/camp/:id",
  asyncCatch(async (req, res) => {
    const camps = await campdbs
      .findById(req.params.id)
      .populate({
        path: "reviews",
        populate: {
          path: "author",
        },
      })
      .populate("author");

    if (!camps) {
      req.flash("error", "This camp can not be found!");
      return res.redirect("/camp");
    }
    console.log(camps.geometry);
    res.render("campsDetail", { camps });
  })
);
app.put(
  "/camp/:id",
  LoginIn,
  authorization,
  upload.array("image"),
  validateCamp,
  asyncCatch(async (req, res) => {
    const { id } = req.params;
    console.log(req.body.deleteImage);
    const camps = await campdbs.findByIdAndUpdate(id, {
      ...req.body,
    });
    const images = req.files.map((file) => ({
      url: file.path,
      fileName: file.filename,
    }));
    camps.image.push(...images);
    await camps.save();
    if (req.body.deleteImage) {
      for (let firename of req.body.deleteImage) {
        await cloudinary.uploader.destroy(firename);
      }
      await camps.updateOne({
        $pull: { image: { fileName: { $in: req.body.deleteImage } } },
      });
    }

    req.flash("success", "your updating is done successfully");

    res.redirect(`/camp/${camps._id}`);
  })
);
app.delete(
  "/camp/:id",
  LoginIn,
  authorization,
  asyncCatch(async (req, res) => {
    const camps = await campdbs.findByIdAndDelete(req.params.id, {
      ...req.body,
    });
    req.flash("success", "you successfully delete a camp!");
    res.redirect(`/camp`);
  })
);
app.delete(
  "/camp/:id/reviews/:reviewID",
  LoginIn,
  reviewAuthorization,
  asyncCatch(async (req, res) => {
    const { id, reviewID } = req.params;
    await campdbs.findByIdAndUpdate(id, { $pull: { reviews: reviewID } });
    await reviews.findOneAndDelete(reviewID);
    req.flash("success", "your review is deleted successfully");
    res.redirect(`/camp/${id}`);
  })
);
app.get(
  "/camp/:id/edit",
  LoginIn,
  authorization,
  asyncCatch(async (req, res) => {
    const { id } = req.params;
    const camps = await campdbs.findById(id);
    if (!camps) {
      req.flash("error", "You can not edit this information");
      return res.redirect(`/camp/${id}`);
    }

    res.render("edit", { camps });
  })
);
app.get(
  "/register",
  asyncCatch(async (req, res) => {
    res.render("register");
  })
);
app.post(
  "/register",
  asyncCatch(async (req, res, next) => {
    try {
      const { username, email, password } = req.body;
      const newUser = new User({ username, email });
      const registeredUser = await User.register(newUser, password);
      req.login(registeredUser, (err) => {
        if (err) return next(err);
        req.flash("success", `hello my friend ${username}`);
        res.redirect("/camp");
      });
    } catch (error) {
      req.flash("error", error.massage);
      res.redirect("/register");
    }
  })
);
app.get(
  "/login",
  asyncCatch((req, res) => {
    res.render("login");
  })
);

app.post(
  "/login",
  storeReturnTo,
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    req.flash("success", `welcome back`);
    const redirectUrl = res.locals.returnTo || "/camp";

    res.redirect(redirectUrl);
  }
);
app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.flash("success", "Goodbye!");
    res.redirect("/camp");
  });
});
app.all("*", (req, res, next) => {
  next(new errorHandler("page not found"), 404);
});
app.use((err, req, res, next) => {
  const { statusC = 500, message = "something goes wrong!!" } = err;

  res.status(statusC).render("error", { err });
});

app.listen(3000, () => {
  console.log("you are here 3000");
});
