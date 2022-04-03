const { mongoose } = require("../mongo");

const Player = require("./Player");
const schema = new mongoose.Schema(
  {
    teamId: String,
    name: String,
    position: Number,
    logo: String,
  },
  {
    toJSON: { virtuals: true }, // So `res.json()` and other `JSON.stringify()` functions include virtuals
    toObject: { virtuals: true }, // So `console.log()` and other functions that use `toObject()` include virtuals
  }
);

schema.virtual("players", {
  ref: "players",
  localField: "_id",
  foreignField: "info.team",
});

module.exports = new mongoose.model("teams", schema);
