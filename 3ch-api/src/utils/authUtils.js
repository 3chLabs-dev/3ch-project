const jwt = require("jsonwebtoken");

function signToken({ id, email }) {
  return jwt.sign({ sub: String(id), email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// 임시 가입용 티켓 토큰
function signSignupTicket({ id, email }) {
  return jwt.sign(
    { sub: String(id), email, purpose: "signup" },
    process.env.JWT_SECRET,
    { expiresIn: "10m" } 
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, signSignupTicket, verifyToken  };