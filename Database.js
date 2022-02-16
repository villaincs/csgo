let dbError = require("./error");
const got = require("got");
const { JSDOM } = require("jsdom");
const uuid = require("uuid").v4;

const Team = require("./models/Team");
const Player = require("./models/Player");
const Highlight = require("./models/Highlight");
const errorCodes = require("./error/errorCodes");

const { playerCollection, teamCollection, highlightCollection } = require("./mongo");

module.exports = class Database {
  constructor() {}

  async getPlayerById(id) {
    let player = await Player.findOne({ playerId: id });
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
    let playerObj = await Player.findOne({ playerId });

    if (!playerObj) {
      //add new player if ID doesn't exist
      playerObj = Player.createPlayer(url);
    }

    try {
      await playerObj.populate();
      playerObj.mmm = 1;
      await playerObj.save();
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
      teamDivs = [...teamDivs].slice(0);

      let teamsToParse = 20;
      for (let i = 0; i < teamsToParse; i++) {
        let hrefSplit = teamDivs[i].querySelector("a.moreLink:not(.details)").href.split("/");
        let teamId = hrefSplit[hrefSplit.length - 2];
        let teamName = teamDivs[i].querySelector("span.name").textContent;
        let teamPosition = teamDivs[i].querySelector("span.position").textContent.substring(1);
        let teamLogo = teamDivs[i].querySelector("img").src;
        let teamRoster = [];

        let teamObj = await Team.findOne({ id: teamId });
        if (!teamObj) {
          teamObj = new Team({
            _id: teamMongoId,
            id: teamId,
            name: teamName,
            position: teamPosition,
            logo: teamLogo,
          });
        }

        // populate player objects and push to roster
        for (let playerDiv of teamDivs[i].querySelectorAll("td.player-holder a.pointer")) {
          let playerUrl = `https://www.hltv.org${playerDiv.href}`;
          let playerObj = await this.updatePlayerObject(playerUrl);
          // set team ref for player
          playerObj.info.team = teamObj._id;
          teamRoster.push(playerObj._id);
        }

        teamObj.roster = teamRoster;
        await teamObj.save();
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

  async getCompletePlayers() {
    let playerArray = await Player.find({ isComplete: true });
    return playerArray;
  }
};
