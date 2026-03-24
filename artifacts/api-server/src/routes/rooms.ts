import { Router, type IRouter } from "express";
import { db, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { CreateRoomBody, GetRoomParams, VerifyRoomPasswordParams, VerifyRoomPasswordBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type StoredRoom = {
  id: string;
  hostName: string;
  password: string;
  createdAt: Date;
};

const inMemoryRooms = new Map<string, StoredRoom>();

if (!db) {
  logger.warn("DATABASE_URL is not set; using in-memory room storage");
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < 6; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

async function createRoomRecord(id: string, hostName: string, password: string): Promise<StoredRoom> {
  if (db) {
    await db.insert(roomsTable).values({ id, hostName, password });

    const room = await db.select().from(roomsTable).where(eq(roomsTable.id, id)).limit(1);
    return room[0];
  }

  const room: StoredRoom = {
    id,
    hostName,
    password,
    createdAt: new Date(),
  };

  inMemoryRooms.set(id, room);
  return room;
}

async function getRoomRecord(roomId: string): Promise<StoredRoom | null> {
  if (db) {
    const room = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, roomId))
      .limit(1);

    return room[0] ?? null;
  }

  return inMemoryRooms.get(roomId) ?? null;
}

router.post("/rooms", async (req, res) => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { hostName } = parsed.data;
  const id = uuidv4();
  const password = generatePassword();
  const room = await createRoomRecord(id, hostName, password);

  res.status(201).json({
    id: room.id,
    hostName: room.hostName,
    createdAt: room.createdAt.toISOString(),
    password,
  });
});

router.get("/rooms/:roomId", async (req, res) => {
  const parsed = GetRoomParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid room ID" });
    return;
  }

  const room = await getRoomRecord(parsed.data.roomId);

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json({
    id: room.id,
    hostName: room.hostName,
    createdAt: room.createdAt.toISOString(),
  });
});

router.post("/rooms/:roomId/verify", async (req, res) => {
  const paramsParsed = VerifyRoomPasswordParams.safeParse(req.params);
  const bodyParsed = VerifyRoomPasswordBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const room = await getRoomRecord(paramsParsed.data.roomId);

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const valid = room.password === bodyParsed.data.password.toUpperCase();
  if (!valid) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  const token = `guest-${uuidv4()}`;
  res.json({ valid: true, token });
});

export default router;
