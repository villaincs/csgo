let dbError = require("./error");
const got = require("got");
const { JSDOM } = require("jsdom");
const uuid = require("uuid").v4;

const Team = require("./models/Team");
const Player = require("./models/Player");
const Highlight = require("./models/Highlight");
const errorCodes = require("./error/errorCodes");

const { MongoClient } = require("mongodb");
const uri = "mongodb://csgoDB:csgoDBPassword@127.0.0.1/csgodb?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
  } finally {
  }
}
run().catch(console.dir);

module.exports = class Database {
  constructor() {
    this.playerCollection = client.db("csgodb").collection("players");
    this.teamCollection = client.db("csgodb").collection("teams");
    this.highlightCollection = client.db("csgodb").collection("playerHighlights");
  }

  async getPlayerById(id) {
    let player = await Player.find(id);
    if (!player) throw new dbError.PlayerNotFoundError(id);
    return player;
  }

  async deleteHighlightById(highlightId) {
    let highlightToDelete = this.getPlayerHighlightById(highlightId);
    let playerHighlightArray = highlightToDelete.player.career.highlights;
    playerHighlightArray.splice(playerHighlightArray.indexOf(highlightToDelete), 1);
  }

  async addHighlightByPlayerId(playerId, highlightName, highlightUrl) {
    let player = await this.getPlayerById(playerId);
    player.career.userAddedHighlights.push(new Highlight(highlightName, highlightUrl, uuid()));
    return;
  }

  //
  async updatePlayerObject(url) {
    let playerId = url.split("/")[url.split("/").length - 2];
    let playerObj = await Player.find(playerId);

    let isNewPlayer;
    if (!playerObj) {
      //add new player if ID doesn't exist
      playerObj = await Player.createPlayer(url);
      isNewPlayer = true;
    }
    try {
      await playerObj.populate();
    } catch (error) {
      if (error.isDatabaseError) {
      } else {
        throw error;
      }
    }
    return playerObj;
  }

  // Make team objects containing player objects
  async getHltvTop20Ranking() {
    return got("https://www.hltv.org/ranking/teams").then(async (response) => {
      const dom = new JSDOM(response.body);
      let teamDivs = dom.window.document.querySelectorAll("div.ranked-team.standard-box");
      teamDivs = [...teamDivs].slice(17);

      let teamsToParse = 1;
      for (let i = 0; i < teamsToParse; i++) {
        let hrefSplit = teamDivs[i].querySelector("a.moreLink:not(.details)").href.split("/");
        let teamId = hrefSplit[hrefSplit.length - 2];
        let teamName = teamDivs[i].querySelector("span.name").textContent;
        let teamPosition = teamDivs[i].querySelector("span.position").textContent.substring(1);
        let teamLogo = teamDivs[i].querySelector("img").src;
        let teamRoster = [];

        for (let playerDiv of teamDivs[i].querySelectorAll("td.player-holder a.pointer")) {
          // populate player object
          let playerUrl = `https://www.hltv.org${playerDiv.href}`;
          let playerObj = await this.updatePlayerObject(playerUrl);
          teamRoster.push(playerObj);
        }

        let teamObject = await Team.find(teamId);
        if (!teamObject) {
          teamObject = new Team(teamName, teamPosition, teamLogo, teamId, teamRoster);
          await teamObject.insert();
        } else {
          await teamObject.update(teamName, teamPosition, teamLogo, teamRoster);
        }
      }
      console.log(`Finished parsing ${teamsToParse} ${teamsToParse == 1 ? "team" : "teams"}`);
    });
  }

  async fixLiquipediaUrlById(id, liquipediaUrl) {
    let missingUrlPlayer = this.getPlayerById(id);
    missingUrlPlayer.liquipediaUrl = liquipediaUrl;
    await missingUrlPlayer.populate();

    await this.playerUrlExceptions.remove({ playerId: id.toString() });
    return missingUrlPlayer;
  }

  getCompletePlayers() {
    let completePlayers = [];
    for (let player of this.playerCollection) {
      if (!player.isComplete) continue;
      completePlayers.push(player);
    }
    return completePlayers;
  }
};
