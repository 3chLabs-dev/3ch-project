const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const KakaoStrategy = require("passport-kakao").Strategy;
const NaverStrategy = require("passport-naver").Strategy;
const pool = require("../db/pool");
const { signToken } = require("../utils/authUtils");

// Google
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const providerId = profile.id;

        let user = null;
        const existingUser = await pool.query(
          "select id, email, name, auth_provider, provider_id from users where email = $1",
          [email],
        );

        if (existingUser.rowCount > 0) {
          user = existingUser.rows[0];
          if (user.auth_provider === "local") {
            await pool.query(
              "update users set auth_provider = 'google', provider_id = $1 where id = $2",
              [providerId, user.id],
            );
            user.auth_provider = "google";
            user.provider_id = providerId;
          } else if (user.auth_provider === "google" && !user.provider_id) {
            await pool.query(
              "update users set provider_id = $1 where id = $2",
              [providerId, user.id],
            );
            user.provider_id = providerId;
          } else if (user.auth_provider !== "google") {
            return done(null, false, {
            message: `이미 가입된 이메일`,
            });
          }
        } else {
          const newUser = await pool.query(
            `insert into users (email, name, auth_provider, provider_id)
             values ($1, $2, 'google', $3)
             returning id, email, name, auth_provider, provider_id`,
            [email, null, providerId],
          );
          user = newUser.rows[0];
        }
        done(null, user);
      } catch (err) {
        done(err, false);
      }
    },
  ),
);

// Kakao
passport.use(
  new KakaoStrategy(
    {
      clientID: process.env.KAKAO_CLIENT_ID,
      clientSecret: process.env.KAKAO_CLIENT_SECRET,
      callbackURL: process.env.KAKAO_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile._json.kakao_account.email;
        const name = profile.displayName;
        const providerId = profile.id;

        let user = null;
        const existingUser = await pool.query(
          "select id, email, name, auth_provider, provider_id from users where email = $1",
          [email],
        );

        if (existingUser.rowCount > 0) {
          user = existingUser.rows[0];
          if (user.auth_provider === "local") {
            await pool.query(
              "update users set auth_provider = 'kakao', provider_id = $1 where id = $2",
              [providerId, user.id],
            );
            user.auth_provider = "kakao";
            user.provider_id = providerId;
          } else if (user.auth_provider === "kakao" && !user.provider_id) {
            await pool.query(
              "update users set provider_id = $1 where id = $2",
              [providerId, user.id],
            );
            user.provider_id = providerId;
          } else if (user.auth_provider !== "kakao") {
            return done(null, false, {
            message: `이미 가입된 이메일`,
            });
          }
        } else {
          const newUser = await pool.query(
            `insert into users (email, name, auth_provider, provider_id)
             values ($1, $2, 'kakao', $3)
             returning id, email, name, auth_provider, provider_id`,
            [email, null, providerId],
          );
          user = newUser.rows[0];
        }
        done(null, user);
      } catch (err) {
        done(err, false);
      }
    },
  ),
);

// Naver
passport.use(
  new NaverStrategy(
    {
      clientID: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
      callbackURL: process.env.NAVER_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const providerId = profile.id;

        let user = null;
        const existingUser = await pool.query(
          "select id, email, name, auth_provider, provider_id from users where email = $1",
          [email],
        );

        if (existingUser.rowCount > 0) {
          user = existingUser.rows[0];
          if (user.auth_provider === "local") {
            await pool.query(
              "update users set auth_provider = 'naver', provider_id = $1 where id = $2",
              [providerId, user.id],
            );
            user.auth_provider = "naver";
            user.provider_id = providerId;
          } else if (user.auth_provider === "naver" && !user.provider_id) {
            await pool.query(
              "update users set provider_id = $1 where id = $2",
              [providerId, user.id],
            );
            user.provider_id = providerId;
          } else if (user.auth_provider !== "naver") {
            return done(null, false, {
            message: `이미 가입된 이메일`,
            });
          }
        } else {
          const newUser = await pool.query(
            `insert into users (email, name, auth_provider, provider_id)
             values ($1, $2, 'naver', $3)
             returning id, email, name, auth_provider, provider_id`,
            [email, null, providerId],
          );
          user = newUser.rows[0];
        }
        done(null, user);
      } catch (err) {
        done(err, false);
      }
    },
  ),
);

module.exports = passport;
