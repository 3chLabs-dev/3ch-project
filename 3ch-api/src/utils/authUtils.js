const jwt = require("jsonwebtoken");

const JWT_OPTIONS = {
  algorithms: ["HS256"],
  issuer: process.env.JWT_ISSUER || "3ch-api",
  audience: process.env.JWT_AUDIENCE || "3ch-web",
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
}

function signToken({ id, email }) {
  return jwt.sign({ sub: String(id), email, purpose: "access" }, getJwtSecret(), {
    algorithm: "HS256",
    issuer: JWT_OPTIONS.issuer,
    audience: JWT_OPTIONS.audience,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function signSignupTicket({ id, email }) {
  return jwt.sign(
    { sub: String(id), email, purpose: "signup" },
    getJwtSecret(),
    {
      algorithm: "HS256",
      issuer: JWT_OPTIONS.issuer,
      audience: JWT_OPTIONS.audience,
      expiresIn: "10m",
    },
  );
}

function signPasswordResetTicket({ id, email }) {
  return jwt.sign(
    { sub: String(id), email, purpose: "password-reset" },
    getJwtSecret(),
    {
      algorithm: "HS256",
      issuer: JWT_OPTIONS.issuer,
      audience: JWT_OPTIONS.audience,
      expiresIn: "15m",
    },
  );
}

function verifyToken(token, expectedPurpose = "access") {
  const payload = jwt.verify(token, getJwtSecret(), JWT_OPTIONS);
  if (payload.purpose !== expectedPurpose) {
    throw new Error("INVALID_TOKEN_PURPOSE");
  }
  return payload;
}

module.exports = { signToken, signSignupTicket, signPasswordResetTicket, verifyToken };
