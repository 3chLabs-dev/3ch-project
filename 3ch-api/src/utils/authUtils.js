const jwt = require("jsonwebtoken");

function signToken({ id, email }) {
  return jwt.sign({ sub: String(id), email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

module.exports = { signToken };