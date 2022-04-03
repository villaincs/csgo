const { mongoose } = require("../mongo");
const Player = require("./Player");

const schema = new mongoose.Schema({
  highlightId: String,
  name: String,
  url: String,
  player: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
});

module.exports = new mongoose.model("playerhighlights", schema);
