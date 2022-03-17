const mongoose = require("mongoose");
connectMongoose().catch((err) => console.log(err));
async function connectMongoose() {
  await mongoose.connect("mongodb://localhost:27017/csgodb");
}

const Player = require("./Player");

const schema = new mongoose.Schema({
  _id: String,
  highlightId: String,
  name: String,
  url: String,
  player: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
});

module.exports = new mongoose.model("playerhighlights", schema);
