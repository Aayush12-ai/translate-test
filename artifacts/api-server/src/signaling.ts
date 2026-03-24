import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import { logger } from "./lib/logger";

interface Client {
  ws: WebSocket;
  roomId: string;
  name: string;
  isHost: boolean;
}

const rooms = new Map<string, Client[]>();

function getRoom(roomId: string): Client[] {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, []);
  }
  return rooms.get(roomId)!;
}

function removeClient(client: Client) {
  const room = rooms.get(client.roomId);
  if (!room) return;
  const idx = room.indexOf(client);
  if (idx !== -1) room.splice(idx, 1);
  if (room.length === 0) {
    rooms.delete(client.roomId);
  }
}

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function setupSignaling(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    let client: Client | null = null;

    ws.on("message", (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "join") {
        const { roomId, name, token } = msg;
        if (!roomId || !name) return;

        const isHost = token === "host";
        client = { ws, roomId, name, isHost };

        const room = getRoom(roomId);
        const others = [...room];
        room.push(client);

        logger.info({ roomId, name, isHost, existingPeers: others.length }, "Client joined room");

        // Only tell the EXISTING peers that someone new joined (they will create the offer).
        // The newly joined peer does NOT get peer-joined — it just waits to receive an offer.
        for (const other of others) {
          send(other.ws, { type: "peer-joined", name });
        }
        return;
      }

      if (!client) return;

      const room = getRoom(client.roomId);
      const peers = room.filter((c) => c !== client);

      // Relay all signaling messages to peers (offer, answer, ice-candidate,
      // screen-share-request, screen-share-approved, screen-share-denied, screen-share-stop)
      const RELAY_TYPES = new Set([
        "offer", "answer", "ice-candidate",
        "screen-share-request", "screen-share-approved",
        "screen-share-denied", "screen-share-stop",
      ]);
      if (RELAY_TYPES.has(msg.type)) {
        for (const peer of peers) {
          send(peer.ws, msg);
        }
      }
    });

    ws.on("close", () => {
      if (!client) return;
      logger.info({ roomId: client.roomId, name: client.name }, "Client left room");
      const room = getRoom(client.roomId);
      const peers = room.filter((c) => c !== client);
      removeClient(client);
      for (const peer of peers) {
        send(peer.ws, { type: "peer-left" });
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  logger.info("WebSocket signaling server ready at /ws");
}
