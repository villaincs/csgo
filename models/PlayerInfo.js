module.exports = class PlayerInfo {
  constructor(name, realName, nationality, birthDate, age, team, role, approxWinnings) {
    this.name = name;
    this.realName = realName;
    this.nationality = nationality;
    this.birthDate = birthDate;
    this.team = team;
    this.age = age;
    this.role = role;
    this.approxWinnings = approxWinnings;
  }
};
