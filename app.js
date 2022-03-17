const Player = require("./models/Player");
const Team = require("./models/Team");
const Database = require("./Database");
const dbError = require("./error");
const errorCodes = require("./error/errorCodes");

const { playerCollection, teamCollection, highlightCollection } = require("./mongo");

const express = require("express");
const app = express();
app.use(
  express.urlencoded({
    extended: true,
  })
);
const port = 3000;

let db = new Database();

function sortByStat(stat, order) {
  let playerStatArray = db.completePlayers.map((player) => {
    return { name: player.playerInfo.name, [stat]: player.statistics[stat] };
  });
  playerStatArray.sort((a, b) => {
    if (a[stat] > b[stat]) {
      return order == "desc" ? -1 : 1;
    } else if (a[stat] < b[stat]) {
      return order == "desc" ? 1 : -1;
    }
    return 0;
  });
  return playerStatArray;
}

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
  let playerArray = await db.getCompletePlayers();
  // TODO: Maybe consider changing the sorting algorithm to use mongoose query with sorting.
  if (req.query.sort) {
    if (req.query.sort in (await playerArray[0].statistics)) {
      let orders = ["desc", "asc"];
      let order = req.query.order ?? "desc";
      if (!orders.includes(order)) {
        res.send(`Order arguments invalid, must be either asc or desc`);
      }
      res.send(sortByStat(req.query.sort, order));
    } else {
      res.send(`${req.query.sort} is not a stat`);
    }
  }

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

app.get("/team-ranking", (req, res) => {
  // TODO: FIX IT
  res.send(db.teamArray);
});

/* Expected req.body
 {
   playerId: string,
   name: string,
   url: string
  }
*/
// TODO: FIX IT
app.post("/highlight", async (req, res) => {
  if (!(req.body.name && req.body.url && req.body.playerId)) {
    res.status(400).send(`Error: highlightName, highlightUrl, playerId can't be empty`);
    return;
  }

  try {
    await db.addHighlightByPlayerId(req.body.playerId, req.body.highlightName, req.body.highlightUrl);
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
// TODO: FIX IT
app.delete("/highlight", async (req, res) => {
  if (isEmptyString(req.body.id)) {
    res.status(400).send(`Error: id can't be empty`);
  }

  await db.deleteHighlightById(req.body.id);
  res.send(`Successfully deleted highlight from ${highlightToDelete.player.playerInfo.name}`);
});

app.post("/update-team-ranking", async (req, res) => {
  await db.getHltvTop20Ranking();
  res.send(`Successfully updated team ranking`);
});

// TODO: We need it. Bring it back.
app.get("/fix-liquipedia-urls", (req, res) => {
  res.send(db.playerUrlExceptions);
});

/**
 * {
 *  playerId: string,
 *  liquipediaUrl: string
 * }
 */
// TODO: Fix this as well. You want to be able to distinguish which player data has invalid liquipedia url.
app.post("/fix-liquipedia-urls", async (req, res) => {
  try {
    let missingUrlPlayer = await db.fixLiquipediaUrlById(req.body.playerId, req.body.liquipediaUrl);
    res.send(`successfully parsed ${missingUrlPlayer.playerInfo.name}`);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
