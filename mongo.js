const { MongoClient } = require("mongodb");
const uri = "mongodb://csgoDB:csgoDBPassword@127.0.0.1/csgodb?retryWrites=true&w=majority";
const client = new MongoClient(uri);

(async function run() {
  try {
    await client.connect();
  } finally {
  }
})();

exports.playerCollection = client.db("csgodb").collection("players");
exports.teamCollection = client.db("csgodb").collection("teams");
exports.highlightCollection = client.db("csgodb").collection("playerHighlights");
