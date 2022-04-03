let dbError = require("./error");
const got = require("got");
const { JSDOM } = require("jsdom");

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

      let teamsToParse = 1;
      for (let i = 0; i < teamsToParse; i++) {
        let hrefSplit = teamDivs[i].querySelector("a.moreLink:not(.details)").href.split("/");
        let teamId = hrefSplit[hrefSplit.length - 2];
        let teamName = teamDivs[i].querySelector("span.name").textContent;
        let teamPosition = teamDivs[i].querySelector("span.position").textContent.substring(1);
        let teamLogo = teamDivs[i].querySelector("img").src;

        // Check if team id is already in team collection, create new team if not
        let teamObj = await Team.findOne({ teamId });
        if (!teamObj) {
          teamObj = new Team({ teamId });
        }

        teamObj.name = teamName;
        teamObj.position = teamPosition;
        teamObj.logo = teamLogo;

        // update and set team id ref for each player
        for (let playerDiv of teamDivs[i].querySelectorAll("td.player-holder a.pointer")) {
          let playerUrl = `https://www.hltv.org${playerDiv.href}`;
          let playerObj = await this.updatePlayerObject(playerUrl);
          console.log(teamObj._id);
          playerObj.info.team = teamObj._id;

          break;
        }

        await teamObj.save();
      }
      console.log(`Finished parsing ${teamsToParse} ${teamsToParse == 1 ? "team" : "teams"}`);
    });
  }

  async getCompletePlayers(sort, order) {
    let playerArray;

    if (Player.schema.tree[sort]) {
      playerArray = await Player.find({ isComplete: true })
        .populate("career.highlights")
        .sort({ [sort]: order });
    } else {
      playerArray = await Player.find({ isComplete: true }).populate("career.highlights").populate("info.team");
    }

    return playerArray;
  }

  async getTeamArray(sort, order) {
    let teamArray;

    if (Team.schema.tree[sort]) {
      teamArray = await Team.find({})
        .populate("players")
        .sort({ [sort]: order });
    } else {
      teamArray = await Team.find({}).populate("players");
    }

    return teamArray;
  }

  async getInvalidLiquipediaUrlPlayers() {
    let players = await Player.find({ liquipediaUrl: null });
    players = players.map((p) => ({
      playerId: p.playerId,
      hltvUrl: p.hltvUrl,
    }));
    return players;
  }

  //##########################################################################################################
  // highlight functions
  //##########################################################################################################

  async getHighlightById(id) {
    let highlight = await Highlight.findOne({ highlightId: id });

    if (!highlight) throw new dbError.HighlightNotFoundError(id);
    return highlight;
  }

  async addHighlightByPlayerId(playerId, name, url) {
    let player = await Player.find({ playerId: playerId });

    let highlight = new Highlight({
      name: name,
      url: url,
      player: player._id,
    });

    await highlight.save();
  }

  async deleteHighlightById(id) {
    // get error if highlight doesn't exist
    await this.getHighlightById(id);
    await Highlight.deleteOne({ highlightId: id });
  }
};
