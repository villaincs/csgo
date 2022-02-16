class Highlight {
  constructor(name, url, id) {
    this.name = name;
    this.url = url;
    this.id = id;
  }
}

const mongoose = require("mongoose");
connectMongoose().catch((err) => console.log(err));
async function connectMongoose() {
  await mongoose.connect("mongodb://localhost:27017/csgodb");
}

const Player = require("./Player");

const schema = new mongoose.Schema({
  name: String,
  url: String,
  id: String,
  player: { type: Schema.Types.ObjectId, ref: "Player" },
});

module.exports = new mongoose.model("playerHighlights", schema);
