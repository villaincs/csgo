const got = require("got");
const { JSDOM } = require("jsdom");
const dbError = require("../error");
const uuid = require("uuid").v4;

const { playerCollection, highlightCollection } = require("../mongo");

const Career = require("./Career");
const Highlight = require("./Highlight");
const TeamPlayedFor = require("./TeamPlayedFor");
const Statistics = require("./Statistics");
const PlayerInfo = require("./PlayerInfo");
const Settings = require("./Settings");

module.exports = class Player {
  constructor(hltvUrl) {
    if (!hltvUrl) return;
    let urlSplit = hltvUrl.split("/");
    this.playerInfo = {};
    this.statistics;
    this.gear = {};
    this.settings = {};
    this.career = new Career();
    this.playerId = urlSplit[urlSplit.length - 2];
    this.playerHltvUrlName = urlSplit[urlSplit.length - 1];
    this.hltvUrl = hltvUrl;
    this.liquipediaUrl; // defined in getTeamsPlayedFor
    this.isComplete = false;
  }

  importPlayerData(playerData) {
    this.playerInfo = playerData.playerInfo;
    this.statistics = playerData.statistics;
    this.gear = playerData.gear;
    this.settings = playerData.settings;
    this.career = playerData.career;
    this.playerId = playerData.playerId;
    this.playerHltvUrlName = playerData.playerHltvUrlName;
    this.hltvUrl = playerData.hltvUrl;
    this.liquipediaUrl = playerData.liquipediaUrl;
    this.isComplete = playerData.isComplete;
  }

  async insertToDB() {
    await playerCollection.insertOne(this);
  }

  //return player object containing functions
  static async find(id) {
    let playerData = await playerCollection.findOne({ playerId: id });
    if (!playerData) return null;

    let player = await Player.createPlayer(playerData);
    return player;
  }

  static async createPlayer(playerData) {
    let playerObject;
    if (typeof playerData == "string") {
      playerObject = new Player(playerData);
      await playerObject.insertToDB();
    } else {
      playerObject = new Player();
      playerObject.importPlayerData(playerData);
    }
    return playerObject;
  }

  async populate() {
    console.log(`Parsing ${this.playerHltvUrlName} (${this.hltvUrl})`);
    try {
      await Promise.all([
        this.getStatistics(this.playerHltvUrlName, this.playerId),
        this.getTrophies(this.playerHltvUrlName, this.playerId),
        this.getTeamsPlayedFor(this.playerHltvUrlName, this.playerId),
        this.getHighlights(this.playerHltvUrlName, this.playerId),
      ]);
      await this.getLiquipediaData(this.liquipediaUrl);
      console.log(`Successfully parsed ${this.playerInfo.team} ${this.playerInfo.name}\n`);
      this.isComplete = true;
    } catch (error) {
      console.log(`Parsing unsuccessful (${this.hltvUrl})\n`);
      console.log(error);
      this.isComplete = false;
    }

    await playerCollection.updateOne({ playerId: this.playerId }, { $set: this });
    await setTimeout(() => {}, 500);
  }

  // Get array of objects of teams the player has played for from HLTV
  getTeamsPlayedFor(playerName, playerId) {
    return got("https://www.hltv.org/player/" + playerId + "/" + playerName + "#tab-teamsBox").then((response) => {
      const dom = new JSDOM(response.body);
      let teamTableRows = dom.window.document.getElementById("teamsBox").querySelectorAll("tr.team");
      // Put team objects into array
      let teams = [];
      for (let i = 0; i < teamTableRows.length; i++) {
        let name = teamTableRows[i].querySelector("span.team-name").textContent;
        let icon = teamTableRows[i].querySelector("img.team-logo").src;
        let joinDate = teamTableRows[i].querySelector("td.time-period-cell").textContent.split(" - ")[0];
        let leaveDate = teamTableRows[i].querySelector("td.time-period-cell").textContent.split(" - ")[1];
        teams.push(new TeamPlayedFor(name, icon, joinDate, leaveDate));
      }
      this.career.teamsPlayedFor = teams;

      // Get player's name on HLTV to make Liquipedia Url
      let hltvName = dom.window.document.querySelector("h1.playerNickname").textContent;
      this.liquipediaUrl = `https://liquipedia.net/counterstrike/${hltvName}`;
    });
  }

  // Get player's statistics object from HLTV
  getStatistics(playerName, playerId) {
    return got("https://www.hltv.org/stats/players/" + playerId + "/" + playerName).then((response) => {
      const dom = new JSDOM(response.body);
      // Get divs containing player's stats and its values
      let statsRowsDivs = dom.window.document.querySelectorAll("div.col.stats-rows>div");
      // Create temporary object containing each stat
      let statisticsTemp = {};
      for (let div of statsRowsDivs) {
        statisticsTemp[div.childNodes[0].textContent.toLowerCase()] = parseFloat(div.childNodes[1].textContent);
      }
      // Get impact rating
      let impactRating;
      for (let div of dom.window.document.querySelectorAll(
        "div.summaryStatBreakdownRow div.summaryStatBreakdown"
      )) {
        if (div.childNodes[1].childNodes[0].textContent.startsWith("Impact")) {
          impactRating = parseFloat(div.childNodes[3].childNodes[1].textContent);
          break;
        }
      }
      let keys = [
        ["rating 1.0", "rating 2.0"],
        ["damage / round"],
        ["kills / round"],
        ["deaths / round"],
        ["total kills"],
        ["total deaths"],
        ["maps played"],
        ["rounds played"],
        ["headshot %"],
        ["k/d ratio"],
      ];
      this.checkKeysInObject(keys, statisticsTemp);

      let statistics = new Statistics(
        statisticsTemp["rating 1.0"] || statisticsTemp["rating 2.0"],
        statisticsTemp["damage / round"],
        statisticsTemp["kills / round"],
        statisticsTemp["deaths / round"],
        impactRating,
        statisticsTemp["total kills"],
        statisticsTemp["total deaths"],
        statisticsTemp["maps played"],
        statisticsTemp["rounds played"],
        statisticsTemp["headshot %"],
        statisticsTemp["k/d ratio"]
      );
      this.statistics = statistics;
    });
  }

  // Get array of player's trophies from HLTV trophies tab
  getTrophies(playerName, playerId) {
    return got("https://www.hltv.org/player/" + playerId + "/" + playerName + "#tab-trophiesBox").then(
      (response) => {
        const dom = new JSDOM(response.body);
        let trophyDivs = dom.window.document.getElementById("Trophies").querySelectorAll("div.trophy-event");
        let trophies = [];
        for (let div of trophyDivs) {
          trophies.push(div.textContent);
        }
        this.career.trophies = trophies;
      }
    );
  }

  // Get array of objects of highlights from HLTV and insert highlights to DB
  getHighlights(playerName, playerId) {
    return got(`https://www.hltv.org/player/${playerId}/${playerName}#tab-newsBox`).then(async (response) => {
      const dom = new JSDOM(response.body);
      let newsTab = dom.window.document.querySelectorAll("a.subTab-newsArticle");
      let highlightArray = [];
      for (let article of newsTab) {
        // Extract video articles that start with "Video: Player"
        let articleContent = article.childNodes[1].textContent;
        if (articleContent.toLowerCase().startsWith(`video: ${playerName.toLowerCase()}`)) {
          let name = articleContent.substring(articleContent.indexOf(" ") + 1);
          let url = `https://hltv.org${article.href}`;
          let id = uuid();

          let highlightObj = new Highlight(name, url, id);
          highlightArray.push(highlightObj);
          // insert highlight to DB if doesnt already exist
          if ((await highlightCollection.findOne({ id: id })) == false) {
            await highlightCollection.insertOne(highlightObj);
          }
        }
      }
      this.career.highlights = highlightArray;
    });
  }

  // Get Liquipedia html dom
  async getLiquipediaData(liquipediaUrl) {
    try {
      const liquipediaHtml = await got(liquipediaUrl);
      const liquipediaDom = new JSDOM(liquipediaHtml.body);

      this.getPlayerInfo(liquipediaDom);

      // Get settings and gear from Liquipedia edit page and make object of them
      const liquipediaEditHtml = await got(
        "https://liquipedia.net" +
          (
            liquipediaDom.window.document.querySelector("a[title='Edit section: Gear and Settings']") ??
            liquipediaDom.window.document.querySelector("a[title='Edit section: Gear and settings']")
          ).href
      );
      const liquipediaEditDom = new JSDOM(liquipediaEditHtml.body);
      const playerDataArray = liquipediaEditDom.window.document
        .getElementById("wpTextbox1")
        .textContent.split("\n");
      // Make object containing player settings data
      let playerDataObject = {};
      // Using loop
      for (let data of playerDataArray) {
        function parseLine(str) {
          let key = str.substring(1, str.indexOf("="));
          if (str.indexOf("|", 1) == -1) {
            playerDataObject[key] = str.substring(str.indexOf("=") + 1);
            return;
          }
          playerDataObject[key] = str.substring(str.indexOf("=") + 1, str.indexOf("|", 1));
          parseLine(str.substring(str.indexOf("|", 1)));
        }
        parseLine(data);
      }

      this.getSettings(playerDataObject);
      this.getGear(playerDataObject);
    } catch (error) {
      if (error.statusCode == 404) {
        this.liquipediaUrl = null;
        throw new dbError.InvalidLiquipediaUrlError();
      } else {
      }
    }
  }

  // Get player's personal info object
  getPlayerInfo(liquipediaDom) {
    try {
      let infoDivs = liquipediaDom.window.document.querySelectorAll("div.infobox-cell-2");
      // Make object for every div and use the ones needed
      let tempObject = {};
      for (let i = 0; i < infoDivs.length; i += 2) {
        tempObject[infoDivs[i].textContent] = infoDivs[i + 1].textContent;
      }

      // check if site changed and keys broken, throw error if it has
      let keys = [
        ["Romanized Name:", "Name:"],
        ["Nationality:", "Nationalities:"],
        ["Born:"],
        ["Team:"],
        ["Role:", "Roles:"],
        ["Approx. Total Winnings:"],
      ];
      this.checkKeysInObject(keys, tempObject);

      let name = liquipediaDom.window.document.getElementById("firstHeading").textContent;
      let realName = tempObject["Romanized Name:"] || tempObject["Name:"];
      let nationality = tempObject["Nationality:"] || tempObject["Nationalities:"];
      let birthDate = tempObject["Born:"].substring(0, tempObject["Born:"].indexOf("(") - 1);
      let age = this.getAge(
        tempObject["Born:"].substring(tempObject["Born:"].indexOf("(") + 1, tempObject["Born:"].indexOf(")"))
      );
      let team = tempObject["Team:"];
      let role = tempObject["Role:"] || tempObject["Roles:"];
      let approxWinnings = tempObject["Approx. Total Winnings:"];

      let infoObject = new PlayerInfo(name, realName, nationality, birthDate, age, team, role, approxWinnings);
      this.playerInfo = infoObject;
    } catch (error) {
      throw error;
    }
  }

  // Get player settings from Liquipedia
  getSettings(dataObject) {
    let settingKeys = [["dpi"], ["sensitivity"], ["zoom"], ["w"], ["h"], ["scaling"]];
    this.checkKeysInObject(settingKeys, dataObject);

    let dpi = parseFloat(dataObject["dpi"]);
    let sensitivity = parseFloat(dataObject["sensitivity"]);
    let zoomSensitivity = parseFloat(dataObject["zoom"]);
    let resolution = dataObject["w"] + "x" + dataObject["h"];
    let scalingMode = dataObject["scaling"];

    //create player's crosshair code string
    let crosshairCode = "";
    if (dataObject["alpha"] != undefined) {
      crosshairCode += "cl_crosshairalpha " + dataObject["alpha"];
    }
    if (dataObject["color"] != undefined) {
      crosshairCode += "; cl_crosshaircolor " + dataObject["color"];
    }
    if (dataObject["r"] != undefined) {
      crosshairCode += "; cl_crosshaircolor_r " + dataObject["r"];
    }
    if (dataObject["g"] != undefined) {
      crosshairCode += "; cl_crosshaircolor_g " + dataObject["g"];
    }
    if (dataObject["b"] != undefined) {
      crosshairCode += "; cl_crosshaircolor_b " + dataObject["b"];
    }
    if (dataObject["dot"] != undefined) {
      crosshairCode += "; cl_crosshairdot " + dataObject["dot"];
    }
    if (dataObject["gap"] != undefined) {
      crosshairCode += "; cl_crosshairgap " + dataObject["gap"];
    }
    if (dataObject["size"] != undefined) {
      crosshairCode += "; cl_crosshairsize " + dataObject["size"];
    }
    if (dataObject["style"] != undefined) {
      crosshairCode += "; cl_crosshairstyle " + dataObject["style"];
    }
    if (dataObject["thickness"] != undefined) {
      crosshairCode += "; cl_crosshairthickness " + dataObject["thickness"];
    }
    if (dataObject["outlinethickness"] != undefined) {
      crosshairCode += "; cl_crosshair_outlinethickness " + dataObject["outlinethickness"];
    }
    if (dataObject["sniper"] != undefined) {
      crosshairCode += "; cl_crosshair_sniper_width " + dataObject["sniper"];
    }
    if (crosshairCode == "") {
      crosshairCode = undefined;
    } else {
      crosshairCode += "; cl_crosshair_drawoutline 0";
    }

    let settingsObject = new Settings(dpi, sensitivity, zoomSensitivity, resolution, scalingMode, crosshairCode);
    this.settings = settingsObject;
  }

  getGear(dataObject) {
    let gearKeys = [
      ["mouse-brand"],
      ["mouse-model"],
      ["keyboard-brand", "keyboard-model"],
      ["headset-brand", "headset-model"],
      ["pad-brand", "pad-model"],
      ["monitor-brand", "monitor-model"],
    ];
    this.checkKeysInObject(gearKeys, dataObject);

    let gearObject = {
      mouse: dataObject["mouse-brand"] + " " + dataObject["mouse-model"],
      keyboard: dataObject["keyboard-brand"] + " " + dataObject["keyboard-model"],
      headset: dataObject["headset-brand"] + " " + dataObject["headset-model"],
      mousepad: dataObject["pad-brand"] + " " + dataObject["pad-model"],
      monitor: dataObject["monitor-brand"] + " " + dataObject["monitor-model"],
    };
    this.gear = gearObject;
  }

  // keys must be array of arrays
  checkKeysInObject(keys, obj) {
    let missingKeys = [];
    for (let array of keys) {
      for (let i = 0, lastKey = array.length - 1; i < array.length; i++) {
        if (array[i] in obj) break;
        if (i == lastKey) missingKeys.push(array[i]);
      }
    }
    if (missingKeys.length != 0) {
      throw new dbError.MissingInfoKeyError(missingKeys);
    }
  }

  // accepts yyyy-mm-dd and return age
  getAge(bDate) {
    bDate = bDate.split("-");
    let age = new Date().getFullYear() - bDate[0];
    if (new Date().getMonth() + 1 - bDate[1] < 0) {
      if (new Date().getDate() - bDate[2] < 0) {
        age--;
      }
    }
    return age;
  }
};
