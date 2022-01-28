const { teamCollection } = require("../mongo");

module.exports = class Team {
  constructor(name, position, logo, id, roster = []) {
    this.name = name;
    this.position = position;
    this.logo = logo;
    this.roster = roster;
    this.id = id;
  }

  async update(name, position, logo, roster) {
    this.name = name;
    this.position = position;
    this.logo = logo;
    if (roster) this.roster = roster;
    // TODO: implement roster update
    await teamCollection.updateOne(
      { id: this.id },
      {
        $set: {
          name: this.name,
          position: this.position,
          logo: this.logo,
          roster: this.roster,
        },
      }
    );
  }

  async insert() {
    await teamCollection.insertOne(this);
  }

  static async find(id) {
    let teamObj = await teamCollection.findOne({ id: id });
    if (!teamObj) {
      return null;
    }
    // return teamObj;
    return new Team(teamObj.name, teamObj.position, teamObj.logo, teamObj.id, teamObj.roster);
  }
};
