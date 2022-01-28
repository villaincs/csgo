module.exports = class Statistics {
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
};
