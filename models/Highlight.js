const { mongoose } = require("../mongo");

const schema = new mongoose.Schema({
  highlightId: String,
  name: String,
  url: String,
  player: { type: mongoose.Schema.Types.ObjectId, ref: "players" },
});

module.exports = new mongoose.model("playerhighlights", schema);
