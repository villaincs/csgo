const got = require("got");
const { JSDOM } = require("jsdom");
const dbError = require("../error");

const { playerCollection, teamCollection, highlightCollection } = require("../mongo");

const Highlight = require("./Highlight");
const Team = require("./Team");

class Info {
  constructor(name, realName, nationality, birthDate, age, team, role, approxWinnings) {
    this.name = name;
    this.realName = realName;
    this.nationality = nationality;
    this.birthDate = birthDate;
    this.age = age;
    this.role = role;
    this.approxWinnings = approxWinnings;
  }
}
class Statistics {
  constructor(
    rating,
    adr,
    kpr,
    dpr,
    impact,
    totalKills,
    totalDeaths,
    mapsPlayed,
    roundsplayed,
    hsPercentage,
    kdRatio
  ) {
    this.rating = rating;
    this.adr = adr;
    this.kpr = kpr;
    this.dpr = dpr;
    this.impact = impact;
    this.totalKills = totalKills;
    this.totalDeaths = totalDeaths;
    this.mapsPlayed = mapsPlayed;
    this.roundsplayed = roundsplayed;
    this.hsPercentage = hsPercentage;
    this.kdRatio = kdRatio;
  }
}
class Settings {
  constructor(dpi, sensitivity, zoomSensitivity, resolution, scalingMode, crosshairCode) {
    this.dpi = dpi;
    this.sensitivity = sensitivity;
    this.zoomSensitivity = zoomSensitivity;
    this.resolution = resolution;
    this.scalingMode = scalingMode;
    this.crosshairCode = crosshairCode;
  }
}
class TeamPlayedFor {
  constructor(name, icon, joinDate, leaveDate) {
    this.name = name;
    this.icon = icon;
    this.joinDate = joinDate;
    this.leaveDate = leaveDate;
  }
}

const mongoose = require("mongoose");
connectMongoose().catch((err) => console.log(err));
async function connectMongoose() {
  await mongoose.connect("mongodb://localhost:27017/csgodb");
}
//TODO: use virtual for highlight
const playerSchema = new mongoose.Schema(
  {
    info: {
      name: String,
      realName: String,
      nationality: String,
      birthDate: String,
      team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
      age: Number,
      role: String,
      approxWinnings: String,
    },
    statistics: {
      rating: Number,
      adr: Number,
      kpr: Number,
      dpr: Number,
      impact: Number,
      totalKills: Number,
      totalDeaths: Number,
      mapsPlayed: Number,
      roundsplayed: Number,
      hsPercentage: Number,
      kdRatio: Number,
    },
    gear: {
      mouse: String,
      keyboard: String,
      headset: String,
      mousepad: String,
      monitor: String,
    },
    settings: {
      dpi: Number,
      sensitivity: Number,
      zoomSensitivity: Number,
      resolution: String,
      scalingMode: String,
      crosshairCode: Number,
    },
    career: {
      teamsPlayedFor: [
        {
          name: String,
          icon: String,
          joinDate: String,
          leaveDate: String,
        },
      ],
      trophies: [],
    },
    playerId: String,
    playerHltvUrlName: String,
    hltvUrl: String,
    liquipediaUrl: String,
    isComplete: Boolean,
  },
  {
    toJSON: { virtuals: true }, // So `res.json()` and other `JSON.stringify()` functions include virtuals
    toObject: { virtuals: true }, // So `console.log()` and other functions that use `toObject()` include virtuals
  }
);

playerSchema.virtual("highlights", {
  ref: "playerhighlights",
  localField: "_id",
  foreignField: "player",
});

// creates and saves player to Player model
playerSchema.statics.createPlayerByHltvUrl = function (hltvUrl) {
  let urlSplit = hltvUrl.split("/");
  let player = new Player({
    _id: mongoose.Types.ObjectId(),
    playerId: urlSplit[urlSplit.length - 2],
    playerHltvUrlName: urlSplit[urlSplit.length - 1],
    hltvUrl: hltvUrl,
    isComplete: false,
  });
  return player;
};

playerSchema.methods.populatePlayer = async function () {
  console.log(`Parsing ${this.playerHltvUrlName} (${this.hltvUrl})`);
  try {
    await Promise.all([
      getStatistics.call(this),
      getTrophies.call(this),
      getTeamsPlayedFor.call(this),
      getHighlights.call(this),
    ]);
    await getLiquipediaData.call(this, this.liquipediaUrl);
    console.log(`Successfully parsed ${this.info.name}\n`);
    this.isComplete = true;
  } catch (error) {
    console.log(`Parsing unsuccessful (${this.hltvUrl})\n`);
    console.log(error);
    this.isComplete = false;
  }

  await setTimeout(() => {}, 500);
};

function getTeamsPlayedFor() {
  return got("https://www.hltv.org/player/" + this.playerId + "/" + this.playerHltvUrlName + "#tab-teamsBox").then(
    (response) => {
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
    }
  );
}

function getStatistics() {
  return got("https://www.hltv.org/stats/players/" + this.playerId + "/" + this.playerHltvUrlName).then(
    (response) => {
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
      checkKeysInObject(keys, statisticsTemp);

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
    }
  );
}

function getTrophies() {
  return got(
    "https://www.hltv.org/player/" + this.playerId + "/" + this.playerHltvUrlName + "#tab-trophiesBox"
  ).then((response) => {
    const dom = new JSDOM(response.body);
    let trophyDivs = dom.window.document.getElementById("Trophies").querySelectorAll("div.trophy-event");
    let trophies = [];
    for (let div of trophyDivs) {
      trophies.push(div.textContent);
    }
    this.career.trophies = trophies;
  });
}

function getHighlights() {
  return got(`https://www.hltv.org/player/${this.playerId}/${this.playerHltvUrlName}#tab-newsBox`).then(
    async (response) => {
      const dom = new JSDOM(response.body);
      let newsTab = dom.window.document.querySelectorAll("a.subTab-newsArticle");
      let highlightArray = [];
      for (let article of newsTab) {
        // Extract video articles that start with "Video: Player"
        let articleContent = article.childNodes[1].textContent;

        if (!articleContent.toLowerCase().startsWith(`video: ${this.playerHltvUrlName.toLowerCase()}`)) {
          continue;
        }

        let name = articleContent.substring(articleContent.indexOf(" ") + 1);
        let url = `https://hltv.org${article.href}`;
        let id = article.href.split("/")[2];

        let highlightObj = await Highlight.findOne({ highlightId: id });
        if (highlightObj) {
          continue;
        }

        highlightObj = new Highlight({
          _id: mongoose.Types.ObjectId(),
          highlightId: id,
          name: name,
          url: url,
          player: this._id,
        });

        await highlightObj.save();
      }
    }
  );
}

async function getLiquipediaData(liquipediaUrl) {
  try {
    const liquipediaHtml = await got(liquipediaUrl);
    const liquipediaDom = new JSDOM(liquipediaHtml.body);

    getPlayerInfo.call(this, liquipediaDom);

    // Get settings and gear from Liquipedia edit page and make object of them
    const liquipediaEditHtml = await got(
      "https://liquipedia.net" +
        (
          liquipediaDom.window.document.querySelector("a[title='Edit section: Gear and Settings']") ??
          liquipediaDom.window.document.querySelector("a[title='Edit section: Gear and settings']")
        ).href
    );
    const liquipediaEditDom = new JSDOM(liquipediaEditHtml.body);
    const playerDataArray = liquipediaEditDom.window.document.getElementById("wpTextbox1").textContent.split("\n");
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

    getSettings.call(this, playerDataObject);
    getGear.call(this, playerDataObject);
  } catch (error) {
    if (error.statusCode == 404) {
      this.liquipediaUrl = null;
      throw new dbError.InvalidLiquipediaUrlError();
    } else {
    }
  }
}

function getPlayerInfo(liquipediaDom) {
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
    checkKeysInObject(keys, tempObject);

    let name = liquipediaDom.window.document.getElementById("firstHeading").textContent;
    let realName = tempObject["Romanized Name:"] || tempObject["Name:"];
    let nationality = tempObject["Nationality:"] || tempObject["Nationalities:"];
    let birthDate = tempObject["Born:"].substring(0, tempObject["Born:"].indexOf("(") - 1);
    let age = getAge(
      tempObject["Born:"].substring(tempObject["Born:"].indexOf("(") + 1, tempObject["Born:"].indexOf(")"))
    );
    let team = tempObject["Team:"];
    let role = tempObject["Role:"] || tempObject["Roles:"];
    let approxWinnings = tempObject["Approx. Total Winnings:"];

    let infoObject = new Info(name, realName, nationality, birthDate, age, role, approxWinnings);
    this.info = infoObject;
  } catch (error) {
    console.log("error in getPlayerInfo()");
    throw error;
  }
}

function getSettings(dataObject) {
  let settingKeys = [["dpi"], ["sensitivity"], ["zoom"], ["w"], ["h"], ["scaling"]];
  checkKeysInObject(settingKeys, dataObject);

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

function getGear(dataObject) {
  let gearKeys = [
    ["mouse-brand"],
    ["mouse-model"],
    ["keyboard-brand", "keyboard-model"],
    ["headset-brand", "headset-model"],
    ["pad-brand", "pad-model"],
    ["monitor-brand", "monitor-model"],
  ];
  checkKeysInObject(gearKeys, dataObject);

  let gearObject = {
    mouse: dataObject["mouse-brand"] + " " + dataObject["mouse-model"],
    keyboard: dataObject["keyboard-brand"] + " " + dataObject["keyboard-model"],
    headset: dataObject["headset-brand"] + " " + dataObject["headset-model"],
    mousepad: dataObject["pad-brand"] + " " + dataObject["pad-model"],
    monitor: dataObject["monitor-brand"] + " " + dataObject["monitor-model"],
  };
  this.gear = gearObject;
}

function checkKeysInObject(keys, obj) {
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

function getAge(bDate) {
  bDate = bDate.split("-");
  let age = new Date().getFullYear() - bDate[0];
  if (new Date().getMonth() + 1 - bDate[1] < 0) {
    if (new Date().getDate() - bDate[2] < 0) {
      age--;
    }
  }
  return age;
}

const Player = new mongoose.model("players", playerSchema);
module.exports = Player;
