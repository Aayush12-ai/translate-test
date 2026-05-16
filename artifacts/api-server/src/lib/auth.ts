import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";
import { buildFrontendUrl } from "./frontend";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";
const JWT_EXPIRY = "7d";

export interface JWTPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export function generateToken(payload: JWTPayload): string {
  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });
    return token;
  } catch (error) {
    logger.error("Failed to generate token:", error);
    throw error;
  }
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    logger.error("Failed to verify token:", error);
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface GeneratedMeetingAccess {
  roomId: string;
  meetingLink: string;
  hostMeetingLink: string;
}

export function generateMeetingAccess(
  userName: string,
  hostName: string,
): GeneratedMeetingAccess {
  const roomId = uuidv4();
  const guestToken = `guest-${uuidv4()}`;
  const safeUserName = userName.trim() || "Guest";
  const safeHostName = hostName.trim() || "Admin";

  return {
    roomId,
    meetingLink: buildFrontendUrl(`/call/${roomId}`, {
      token: guestToken,
      name: safeUserName,
    }),
    hostMeetingLink: buildFrontendUrl(`/call/${roomId}`, {
      token: "host",
      name: safeHostName,
    }),
  };
}
