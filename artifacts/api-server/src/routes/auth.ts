import { Router, Response } from "express";
import passport from "passport";
import { User } from "../db/models/user";
import { comparePassword, generateToken, hashPassword } from "../lib/auth";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getAdminUserRecordEmail } from "../lib/admin";
import { buildFrontendUrl } from "../lib/frontend";
import { isGoogleOAuthConfigured } from "../lib/oauth";

const router = Router();

interface SignupRequest {
  email: string;
  name: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AdminLoginRequest {
  key: string;
}

function buildOauthRedirect(
  oauth: "success" | "error",
  params?: Record<string, string | undefined>,
): string {
  return buildFrontendUrl("/login", {
    oauth,
    ...params,
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeUser(user: {
  _id: { toString(): string };
  email: string;
  name: string;
  profilePicture?: string;
  isAdmin: boolean;
}) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    profilePicture: user.profilePicture,
    isAdmin: user.isAdmin,
  };
}

// Regular user signup
router.post("/signup", async (req, res) => {
  try {
    const { email, name, password }: SignupRequest = req.body;
    const trimmedName = name?.trim();

    if (!email || !name || !password) {
      return res.status(400).json({
        error: "Email, name, and password are required",
      });
    }

    if (!trimmedName) {
      return res.status(400).json({
        error: "Name is required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await User.findOne({ email: normalizedEmail }).select(
      "+passwordHash",
    );

    if (existingUser) {
      const errorMessage = existingUser.passwordHash
        ? "An account with this email already exists. Please log in instead."
        : "A legacy account with this email already exists and must be reset before it can be used securely.";

      return res.status(409).json({
        error: errorMessage,
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email: normalizedEmail,
      name: trimmedName,
      passwordHash,
      isAdmin: false,
    });
    logger.info(`New user created: ${normalizedEmail}`);

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      isAdmin: user.isAdmin,
    });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error("Signup error:", error);
    res.status(500).json({
      error: "Failed to sign up",
    });
  }
});

// Regular user login
router.post("/login", async (req, res) => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordHash",
    );

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      isAdmin: user.isAdmin,
    });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({
      error: "Failed to log in",
    });
  }
});

router.get("/google", (req, res, next) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(
      buildOauthRedirect("error", { reason: "google_not_configured" }),
    );
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    session: false,
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(
      buildOauthRedirect("error", { reason: "google_not_configured" }),
    );
  }

  return passport.authenticate("google", { session: false }, (error, user) => {
    if (error || !user) {
      logger.error("Google OAuth callback error:", error);
      return res.redirect(
        buildOauthRedirect("error", { reason: "google_auth_failed" }),
      );
    }

    const oauthUser = user as {
      _id: { toString(): string };
      email: string;
      isAdmin: boolean;
    };

    const token = generateToken({
      userId: oauthUser._id.toString(),
      email: oauthUser.email,
      isAdmin: oauthUser.isAdmin,
    });

    return res.redirect(
      buildOauthRedirect("success", {
        token,
      }),
    );
  })(req, res, next);
});

// Admin login with special key
router.post("/admin/login", async (req, res) => {
  try {
    const { key }: AdminLoginRequest = req.body;
    const adminKey = process.env.ADMIN_KEY || "1234";

    if (key !== adminKey) {
      return res.status(401).json({
        error: "Invalid admin key",
      });
    }

    // Get or create admin user
    const adminEmail = getAdminUserRecordEmail();
    let admin = await User.findOne({ isAdmin: true });

    if (!admin) {
      admin = await User.create({
        email: adminEmail,
        name: "System Admin",
        isAdmin: true,
      });
    } else if (admin.email !== adminEmail && adminEmail !== "admin@system.local") {
      admin.email = adminEmail;
      await admin.save();
    }

    const token = generateToken({
      userId: admin._id.toString(),
      email: admin.email,
      isAdmin: admin.isAdmin,
    });

    res.json({
      token,
      user: sanitizeUser(admin),
    });
  } catch (error) {
    logger.error("Admin login error:", error);
    res.status(500).json({
      error: "Failed to login as admin",
    });
  }
});

// Get current user
router.get(
  "/me",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "Unauthorized",
        });
      }

      const user = await User.findById(req.user.userId);

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      return res.json({
        user: sanitizeUser(user),
      });
    } catch (error) {
      logger.error("Get user error:", error);
      return res.status(500).json({
        error: "Failed to get user",
      });
    }
  },
);

export default router;
