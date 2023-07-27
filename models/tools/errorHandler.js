class errHandler extends Error {
  constructor(message, statusC) {
    super();
    this.message = message;
    this.statusC = statusC;
  }
}
module.exports = errHandler;
