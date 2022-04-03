const { mongoose } = require("../mongo");

const Player = require("./Player");
const schema = new mongoose.Schema({
  teamId: String,
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
