let dbError = require("./error");
const got = require("got");
const { JSDOM } = require("jsdom");
const uuid = require("uuid").v4;

const Team = require("./models/Team");
const Player = require("./models/Player");
const Highlight = require("./models/Highlight");
const errorCodes = require("./error/errorCodes");

module.exports = class Database {
  //##########################################################################################################
  // player functions
  //##########################################################################################################

  async getPlayerById(id) {
    let player = await Player.findOne({ playerId: id }).populate("career.highlights");

    if (!player) throw new dbError.PlayerNotFoundError(id);
    return player;
  }

  // create/find and populate player
  async updatePlayerObject(url) {
    let playerId = url.split("/")[url.split("/").length - 2];
    let playerObj = await Player.findOne({ playerId: playerId });

    if (!playerObj) {
      // add new player if ID doesn't exist
      playerObj = Player.createPlayerByHltvUrl(url);
    }

    try {
      await playerObj.populatePlayer();
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

      let teamsToParse = 2;
      for (let i = 0; i < teamsToParse; i++) {
        let hrefSplit = teamDivs[i].querySelector("a.moreLink:not(.details)").href.split("/");
        let teamId = hrefSplit[hrefSplit.length - 2];
        let teamName = teamDivs[i].querySelector("span.name").textContent;
        let teamPosition = teamDivs[i].querySelector("span.position").textContent.substring(1);
        let teamLogo = teamDivs[i].querySelector("img").src;

        let teamObj = await Team.findOne({ teamId });

        if (!teamObj) {
          teamObj = new Team({ teamId });
        }

        teamObj.name = teamName;
        teamObj.position = teamPosition;
        teamObj.logo = teamLogo;

        // set team id refs for player
        for (let playerDiv of teamDivs[i].querySelectorAll("td.player-holder a.pointer")) {
          let playerUrl = `https://www.hltv.org${playerDiv.href}`;
          let playerObj = await this.updatePlayerObject(playerUrl);
          // set team ref for player
          playerObj.info.team = teamObj._id;
        }

        await teamObj.save();
      }
      console.log(`Finished parsing ${teamsToParse} ${teamsToParse == 1 ? "team" : "teams"}`);
    });
  }

  async getCompletePlayers() {
    let playerArray = await Player.find({ isComplete: true }).populate("career.highlights");
    return playerArray;
  }

  //##########################################################################################################
  // highlight functions
  //##########################################################################################################

  async addHighlightByPlayerId(playerId, name, url) {
    let highlight = new Highlight({
      name: name,
      url: url,
      player: playerId,
    });
    await highlight.save();
  }

  async deleteHighlightById(id) {
    await Highlight.deleteOne({ _id: id });
  }
};
