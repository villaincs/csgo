const mongoose = require("mongoose");
connectMongoose().catch((err) => console.log(err));
async function connectMongoose() {
  await mongoose.connect("mongodb://localhost:27017/csgodb");
}

const Player = require("./Player");
//TODO: use virtual for players
const schema = new mongoose.Schema({
  _id: String,
  name: String,
  position: Number,
  logo: String,
});

schema.virtual("players", {
  ref: "players",
  localField: "_id",
  foreignField: "team",
});

module.exports = new mongoose.model("teams", schema);
