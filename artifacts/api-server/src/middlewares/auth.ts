import { Request, Response, NextFunction } from "express";
import { verifyToken, JWTPayload } from "../lib/auth";
import { logger } from "../lib/logger";

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  token?: string;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized - No token provided",
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({
        error: "Unauthorized - Invalid token",
      });
    }

    req.user = payload;
    req.token = token;
    next();
  } catch (error) {
    logger.error("Auth middleware error:", error);
    return res.status(401).json({
      error: "Unauthorized",
    });
  }
}

export function adminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        error: "Forbidden - Admin access required",
      });
    }
    next();
  } catch (error) {
    logger.error("Admin middleware error:", error);
    return res.status(403).json({
      error: "Forbidden",
    });
  }
}
