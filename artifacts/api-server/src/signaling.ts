import { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { logger } from "./lib/logger";

interface Client {
  ws: WebSocket;
  roomId: string;
  name: string;
  isHost: boolean;
  participantKey: string;
}

const rooms = new Map<string, Client[]>();
const HEARTBEAT_INTERVAL_MS = 25_000;
const INTERNAL_RECONNECT_CLOSE_CODE = 4002;
const INTERNAL_RECONNECT_GRACE_MS = 3_000;
const pendingPeerLeftTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getRoom(roomId: string): Client[] {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, []);
  }

  return rooms.get(roomId)!;
}

function getPendingPeerLeftKey(roomId: string, participantKey: string): string {
  return `${roomId}:${participantKey}`;
}

function clearPendingPeerLeftTimer(roomId: string, participantKey: string) {
  const key = getPendingPeerLeftKey(roomId, participantKey);
  const timer = pendingPeerLeftTimers.get(key);

  if (timer) {
    clearTimeout(timer);
    pendingPeerLeftTimers.delete(key);
  }
}

function removeClient(client: Client): boolean {
  const room = rooms.get(client.roomId);
  if (!room) return false;

  const index = room.indexOf(client);
  if (index === -1) return false;

  room.splice(index, 1);
  if (room.length === 0) {
    rooms.delete(client.roomId);
  }

  return true;
}

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastPeerLeft(client: Pick<Client, "roomId" | "name" | "isHost">) {
  const peers = rooms.get(client.roomId) ?? [];
  for (const peer of peers) {
    send(peer.ws, {
      type: "peer-left",
      name: client.name,
      isHost: client.isHost,
    });
  }
}

function isCurrentClient(client: Client): boolean {
  const room = rooms.get(client.roomId);
  return room?.includes(client) ?? false;
}

function getParticipantKey(token: unknown, isHost: boolean, name: string): string {
  if (typeof token === "string" && token.trim()) {
    return token.trim();
  }

  return `${isHost ? "host" : "guest"}:${name.trim().toLowerCase()}`;
}

export const SIGNALING_PATH = "/ws";

export function setupSignaling() {
  const wss = new WebSocketServer({ noServer: true });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((socket) => {
      const trackedSocket = socket as WebSocket & { isAlive?: boolean };

      if (trackedSocket.isAlive === false) {
        trackedSocket.terminate();
        return;
      }

      trackedSocket.isAlive = false;
      trackedSocket.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(heartbeat);
    for (const timer of pendingPeerLeftTimers.values()) {
      clearTimeout(timer);
    }
    pendingPeerLeftTimers.clear();
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let client: Client | null = null;
    const trackedSocket = ws as WebSocket & { isAlive?: boolean };
    trackedSocket.isAlive = true;

    ws.on("pong", () => {
      trackedSocket.isAlive = true;
    });

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
        const trimmedName = name.trim();
        const participantKey = getParticipantKey(token, isHost, trimmedName);
        clearPendingPeerLeftTimer(roomId, participantKey);
        const nextClient: Client = {
          ws,
          roomId,
          name: trimmedName,
          isHost,
          participantKey,
        };

        const room = getRoom(roomId);
        const existingClientIndex = room.findIndex(
          (candidate) => candidate.participantKey === participantKey,
        );
        const replacedClient =
          existingClientIndex === -1 ? null : room[existingClientIndex];

        if (existingClientIndex === -1) {
          room.push(nextClient);
        } else {
          room[existingClientIndex] = nextClient;
        }

        client = nextClient;

        const others = room.filter((candidate) => candidate !== nextClient);
        const repeatedJoinOnSameSocket = replacedClient?.ws === ws;

        logger.info(
          {
            roomId,
            name: trimmedName,
            isHost,
            existingPeers: others.length,
            replacedExistingSocket:
              replacedClient !== null && replacedClient.ws !== ws,
          },
          "Client joined room",
        );
        send(ws, {
          type: "joined",
          roomId,
          peerCount: others.length,
          peers: others.map((other) => ({
            name: other.name,
            isHost: other.isHost,
          })),
        });

        // Only tell the existing peers that someone joined or rejoined so they
        // can drive the offer when needed.
        if (!repeatedJoinOnSameSocket) {
          for (const other of others) {
            send(other.ws, { type: "peer-joined", name: trimmedName, isHost });
          }
        }

        if (replacedClient && replacedClient.ws !== ws) {
          try {
            replacedClient.ws.close(4001, "Replaced by a newer connection");
          } catch {
            // Ignore close races if the stale socket is already shutting down.
          }
        }
        return;
      }

      if (!client) return;
      if (!isCurrentClient(client)) {
        logger.debug(
          { roomId: client.roomId, name: client.name, type: msg.type },
          "Ignored signaling message from replaced socket",
        );
        return;
      }

      const room = getRoom(client.roomId);
      const peers = room.filter((candidate) => candidate !== client);

      // Relay signaling and screen-share messages to the rest of the room.
      const relayTypes = new Set([
        "offer",
        "answer",
        "ice-candidate",
        "screen-share-request",
        "screen-share-approved",
        "screen-share-denied",
        "screen-share-started",
        "screen-share-stop",
      ]);
      if (relayTypes.has(msg.type)) {
        for (const peer of peers) {
          send(peer.ws, {
            ...msg,
            fromName: client.name,
            fromIsHost: client.isHost,
          });
        }
      }
    });

    ws.on("close", (code, reason) => {
      if (!client) return;

      const removedClient = removeClient(client);
      if (!removedClient) {
        logger.debug(
          { roomId: client.roomId, name: client.name },
          "Ignored close for replaced signaling socket",
        );
        return;
      }

      const closeReason = reason.toString();

      if (code === INTERNAL_RECONNECT_CLOSE_CODE) {
        const key = getPendingPeerLeftKey(client.roomId, client.participantKey);
        clearPendingPeerLeftTimer(client.roomId, client.participantKey);

        pendingPeerLeftTimers.set(
          key,
          setTimeout(() => {
            pendingPeerLeftTimers.delete(key);

            const room = rooms.get(client.roomId) ?? [];
            const participantRejoined = room.some(
              (peer) => peer.participantKey === client.participantKey,
            );

            if (participantRejoined) {
              return;
            }

            logger.info(
              { roomId: client.roomId, name: client.name, code, reason: closeReason },
              "Client left room after internal reconnect timeout",
            );
            broadcastPeerLeft(client);
          }, INTERNAL_RECONNECT_GRACE_MS),
        );

        logger.info(
          { roomId: client.roomId, name: client.name, code, reason: closeReason },
          "Delaying peer-left for internal reconnect",
        );
        return;
      }

      logger.info(
        { roomId: client.roomId, name: client.name, code, reason: closeReason },
        "Client left room",
      );
      broadcastPeerLeft(client);
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  logger.info("WebSocket signaling server ready at /ws");
  return wss;
}
