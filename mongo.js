require("dotenv").config();
const { MongoClient } = require("mongodb");
const uri = process.env.ATLAS_URL;
const client = new MongoClient(uri);

(async function run() {
  try {
    await client.connect();
  } finally {
  }
})();

const mongoose = require("mongoose");
connectMongoose().catch((err) => console.log(err));
async function connectMongoose() {
  await mongoose.connect(process.env.ATLAS_URL);
}

exports.mongoose = mongoose;
