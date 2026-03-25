import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { logger } from "./lib/logger";

interface TranscribeClient {
  ws: WebSocket;
  roomId: string;
  name: string;
}

const rooms = new Map<string, TranscribeClient[]>();

function getRoom(roomId: string): TranscribeClient[] {
  if (!rooms.has(roomId)) rooms.set(roomId, []);
  return rooms.get(roomId)!;
}

function removeClient(client: TranscribeClient) {
  const room = rooms.get(client.roomId);
  if (!room) return;
  const idx = room.indexOf(client);
  if (idx !== -1) room.splice(idx, 1);
  if (room.length === 0) rooms.delete(client.roomId);
}

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

const LIBRETRANSLATE_URL =
  process.env["LIBRETRANSLATE_URL"] ?? "https://translate.argosopentech.com";

async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  if (sourceLang === targetLang) return text;

  try {
    const res = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: "text",
        api_key: process.env["LIBRETRANSLATE_API_KEY"] ?? "",
      }),
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LibreTranslate ${res.status}: ${body}`);
    }

    const json = (await res.json()) as { translatedText?: string; error?: string };
    if (json.error) throw new Error(json.error);
    if (!json.translatedText) throw new Error("No translatedText in response");
    return json.translatedText;
  } catch (err) {
    logger.warn({ err, sourceLang, targetLang }, "Translation failed, returning original");
    return text;
  }
}

export function setupTranscription(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/transcribe" });

  wss.on("connection", (ws: WebSocket) => {
    let client: TranscribeClient | null = null;

    ws.on("message", async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "join") {
        const { roomId, name } = msg;
        if (!roomId || !name) return;
        client = { ws, roomId, name };
        getRoom(roomId).push(client);
        logger.debug({ roomId, name }, "Transcription client joined");
        return;
      }

      if (!client) return;

      if (msg.type === "transcript") {
        const { text, sourceLang = "en", targetLang = "en" } = msg;
        if (!text || typeof text !== "string" || text.trim() === "") return;

        const translated = await translateText(text.trim(), sourceLang, targetLang);

        const room = getRoom(client.roomId);
        const subtitle = {
          type: "subtitle",
          name: client.name,
          original: text.trim(),
          translated,
          sourceLang,
          targetLang,
          ts: Date.now(),
        };

        for (const peer of room) {
          send(peer.ws, subtitle);
        }
      }
    });

    ws.on("close", () => {
      if (client) {
        logger.debug({ roomId: client.roomId, name: client.name }, "Transcription client left");
        removeClient(client);
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "Transcription WebSocket error");
    });
  });

  logger.info({ url: LIBRETRANSLATE_URL }, "Transcription WebSocket ready at /ws/transcribe");
}
