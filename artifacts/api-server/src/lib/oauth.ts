import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../db/models/user";
import { logger } from "./logger";

let isStrategyConfigured = false;

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CALLBACK_URL,
  );
}

export function configureGoogleOAuth() {
  if (isStrategyConfigured || !isGoogleOAuthConfigured()) {
    if (!isStrategyConfigured && !isGoogleOAuthConfigured()) {
      logger.warn(
        "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to enable it.",
      );
    }
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.trim().toLowerCase();

          if (!email) {
            return done(new Error("Google account did not provide an email"));
          }

          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email }],
          }).select("+passwordHash");

          if (!user) {
            user = await User.create({
              email,
              name: profile.displayName || email,
              googleId: profile.id,
              profilePicture: profile.photos?.[0]?.value,
              isAdmin: false,
            });
          } else {
            let didChange = false;

            if (!user.googleId) {
              user.googleId = profile.id;
              didChange = true;
            }

            if (profile.displayName && user.name !== profile.displayName) {
              user.name = profile.displayName;
              didChange = true;
            }

            const photoUrl = profile.photos?.[0]?.value;
            if (photoUrl && user.profilePicture !== photoUrl) {
              user.profilePicture = photoUrl;
              didChange = true;
            }

            if (didChange) {
              await user.save();
            }
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      },
    ),
  );

  isStrategyConfigured = true;
}
