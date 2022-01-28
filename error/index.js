const errorCodes = require("./errorCodes");

class DatabaseError {
  constructor({ code, message }, rest) {
    this.code = code;
    this.message = message;
    this.isDatabaseError = true;

    for (let key of Object.keys(rest)) {
      this[key] = rest[key];
    }
    console.error(this);
  }

  isErrorCode(code) {
    return this.code == code;
  }
}

exports.InvalidLiquipediaUrlError = class InvalidLiquipediaUrlError extends DatabaseError {
  constructor() {
    super(errorCodes.INVALID_LIQUIPEDIA_URL);
  }
};

exports.MissingInfoKeyError = class MissingInfoKeyError extends DatabaseError {
  constructor(keys) {
    super(errorCodes.MISSING_INFO_KEY, { keys });
    console.error();
  }
};

exports.PlayerNotFoundError = class PlayerNotFoundError extends DatabaseError {
  constructor(playerId) {
    super(errorCodes.PLAYER_NOT_FOUND, { playerId });
  }
};
