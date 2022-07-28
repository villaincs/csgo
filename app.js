const Database = require("./Database");

const express = require("express");
const app = express();
app.use(
  express.urlencoded({
    extended: true,
  })
);
const port = 3000;

let db = new Database();

function isEmptyString(...strings) {
  for (str of strings) {
    if (str.trim() == "") {
      return true;
    }
  }
  return false;
}

app.get("/", async (req, res) => {
  // console.log(await Player.findOne({ playerId: "7998" }));
  res.send("Hello World!");
});

app.get("/players", async (req, res) => {
  // send player list in order of ascending or descending statistic
  let playerArray = await db.getCompletePlayers(req.query.sort, req.query.order);

  res.send(playerArray);
});

app.get("/players/:playerId", async (req, res) => {
  try {
    let player = await db.getPlayerById(req.params.playerId);
    res.send(player);
  } catch (error) {
    // console.log(error);
    res.status(404).send(error);
  }
});

app.get("/teams", async (req, res) => {
  let teamArray = await db.getTeamArray(req.query.sort, req.query.order);

  res.send(teamArray);
});

app.get("/highlights", async (req, res) => {
  res.send(await db.getHighlightArray());
});

app.get("/highlights/:highlightId", async (req, res) => {
  try {
    let highlight = await db.getHighlightById(req.params.highlightId);
    res.send(highlight);
  } catch (error) {
    // console.log(error);
    res.status(404).send(error);
  }
});

/* Expected req.body
 {
   playerId: string,
   name: string,
   url: string
  }
*/
app.post("/highlight", async (req, res) => {
  if (!(req.body.name && req.body.url && req.body.playerId)) {
    res.status(400).send(`Error: highlightName, url, id can't be empty`);
    return;
  }

  try {
    await db.addHighlightByPlayerId(req.body.playerId, req.body.name, req.body.url);
    res.send(`Successfully added highlight to player`);
  } catch (error) {
    // if (error.isErrorCode(errorCodes.PLAYER_NOT_FOUND.code)) {
    //   res.status(400).send(error);
    // }
    console.log(error);
  }
});

/**
 * {
 *  id: string,
 * }
 */
app.delete("/highlight", async (req, res) => {
  if (isEmptyString(req.body.id)) {
    res.status(400).send(`Error: id can't be empty`);
  }

  try {
    await db.deleteHighlightById(req.body.id);
    res.send("Successfully deleted highlight");
  } catch (error) {
    res.send(error);
  }
});

app.post("/update-team-ranking", async (req, res) => {
  await db.getHltvTop20Ranking();
  res.send(`Successfully updated team ranking`);
});

app.get("/fix-liquipedia-urls", (req, res) => {
  res.send(db.getInvalidLiquipediaUrlPlayers());
});

/**
 * {
 *  playerId: string,
 *  correctUrl: string
 * }
 */
app.post("/fix-liquipedia-urls", async (req, res) => {
  try {
    await db.fixLiquipediaUrlByPlayerId(req.body.playerId, req.body.correctUrl);
    res.send(`Successfully fixed Liquipedia url`);
  } catch (error) {
    console.log(error);
    res.status(400).send(error);
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
