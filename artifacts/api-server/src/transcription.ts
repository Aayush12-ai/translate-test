import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./lib/logger";

interface TranscribeClient {
  ws: WebSocket;
  roomId: string;
  name: string;
  targetLang: string;
  participantKey: string;
}

type TranslationStatus =
  | "translated"
  | "same-language"
  | "service-unavailable"
  | "translation-error";

interface TranslationResult {
  translatedText: string;
  status: TranslationStatus;
  note?: string;
}

const rooms = new Map<string, TranscribeClient[]>();
const DEFAULT_AZURE_TRANSLATOR_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
const HEARTBEAT_INTERVAL_MS = 25_000;

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

function getParticipantKey(participantKey: unknown, name: string): string {
  if (typeof participantKey === "string" && participantKey.trim()) {
    return participantKey.trim();
  }

  return name.trim().toLowerCase();
}

function isCurrentClient(client: TranscribeClient): boolean {
  const room = rooms.get(client.roomId);
  return room?.includes(client) ?? false;
}

const LIBRETRANSLATE_URL = process.env["LIBRETRANSLATE_URL"]?.trim() ?? "";
const LIBRETRANSLATE_API_KEY = process.env["LIBRETRANSLATE_API_KEY"]?.trim() ?? "";
const AZURE_TRANSLATOR_KEY = process.env["AZURE_TRANSLATOR_KEY"]?.trim() ?? "";
const AZURE_TRANSLATOR_ENDPOINT =
  process.env["AZURE_TRANSLATOR_ENDPOINT"]?.trim() || DEFAULT_AZURE_TRANSLATOR_ENDPOINT;
const AZURE_TRANSLATOR_REGION = process.env["AZURE_TRANSLATOR_REGION"]?.trim() ?? "";
const AZURE_TRANSLATOR_CATEGORY = process.env["AZURE_TRANSLATOR_CATEGORY"]?.trim() ?? "";

interface AzureTranslationResponseItem {
  translations?: Array<{
    text?: string;
    to?: string;
  }>;
  error?: {
    code?: number | string;
    message?: string;
  };
}

function normalizeAzureLanguageCode(language: string): string {
  const normalized = language.trim().toLowerCase();

  switch (normalized) {
    case "zh":
    case "zh-cn":
    case "zh-sg":
      return "zh-Hans";
    case "zh-tw":
    case "zh-hk":
    case "zh-mo":
      return "zh-Hant";
    default:
      return normalized;
  }
}

function buildAzureTranslateUrl(sourceLang: string, targetLang: string): URL {
  const endpoint = new URL(AZURE_TRANSLATOR_ENDPOINT);
  const trimmedPath = endpoint.pathname.replace(/\/+$/, "");

  if (!trimmedPath || trimmedPath === "/") {
    endpoint.pathname = endpoint.hostname.endsWith(".cognitiveservices.azure.com")
      ? "/translator/text/v3.0/translate"
      : "/translate";
  } else if (/\/translator\/text\/v3\.0$/i.test(trimmedPath)) {
    endpoint.pathname = `${trimmedPath}/translate`;
  } else if (!/\/translate$/i.test(trimmedPath)) {
    endpoint.pathname = `${trimmedPath}/translate`;
  } else {
    endpoint.pathname = trimmedPath;
  }

  endpoint.search = "";
  endpoint.searchParams.set("api-version", "3.0");
  endpoint.searchParams.set("from", sourceLang);
  endpoint.searchParams.set("to", targetLang);

  if (AZURE_TRANSLATOR_CATEGORY) {
    endpoint.searchParams.set("category", AZURE_TRANSLATOR_CATEGORY);
  }

  return endpoint;
}

async function translateWithAzure(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult> {
  const normalizedSourceLang = normalizeAzureLanguageCode(sourceLang);
  const normalizedTargetLang = normalizeAzureLanguageCode(targetLang);

  if (normalizedSourceLang === normalizedTargetLang) {
    return {
      translatedText: text,
      status: "same-language",
    };
  }

  if (!AZURE_TRANSLATOR_KEY) {
    return {
      translatedText: text,
      status: "service-unavailable",
      note:
        "Azure Translator is not configured. Set AZURE_TRANSLATOR_KEY in .env.local to enable translation.",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
    "Ocp-Apim-Subscription-Key": AZURE_TRANSLATOR_KEY,
  };

  if (AZURE_TRANSLATOR_REGION) {
    headers["Ocp-Apim-Subscription-Region"] = AZURE_TRANSLATOR_REGION;
  }

  try {
    const res = await fetch(buildAzureTranslateUrl(normalizedSourceLang, normalizedTargetLang), {
      method: "POST",
      headers,
      body: JSON.stringify([{ Text: text }]),
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Azure Translator ${res.status}: ${body}`);
    }

    const json = (await res.json()) as AzureTranslationResponseItem[];
    const translatedText = json[0]?.translations?.[0]?.text;
    const apiError = json[0]?.error?.message;

    if (apiError) throw new Error(apiError);
    if (!translatedText) throw new Error("No translated text in Azure Translator response");

    return {
      translatedText,
      status: "translated",
    };
  } catch (err) {
    logger.warn({ err, sourceLang, targetLang }, "Azure translation failed, returning original");
    return {
      translatedText: text,
      status: "translation-error",
      note:
        err instanceof Error
          ? err.message
          : "Azure translation request failed. Showing the original transcript instead.",
    };
  }
}

async function translateWithLibreTranslate(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult> {
  if (sourceLang === targetLang) {
    return {
      translatedText: text,
      status: "same-language",
    };
  }

  if (!LIBRETRANSLATE_URL) {
    return {
      translatedText: text,
      status: "service-unavailable",
      note:
        "Translation service is not configured. Set AZURE_TRANSLATOR_KEY in .env.local to enable Azure translation.",
    };
  }

  try {
    const res = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: "text",
        api_key: LIBRETRANSLATE_API_KEY,
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
    return {
      translatedText: json.translatedText,
      status: "translated",
    };
  } catch (err) {
    logger.warn({ err, sourceLang, targetLang }, "Translation failed, returning original");
    return {
      translatedText: text,
      status: "translation-error",
      note:
        err instanceof Error
          ? err.message
          : "Translation request failed. Showing the original transcript instead.",
    };
  }
}

async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult> {
  if (AZURE_TRANSLATOR_KEY) {
    return translateWithAzure(text, sourceLang, targetLang);
  }

  return translateWithLibreTranslate(text, sourceLang, targetLang);
}

export const TRANSCRIPTION_PATH = "/ws/transcribe";

export function setupTranscription() {
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
  });

  wss.on("connection", (ws: WebSocket) => {
    let client: TranscribeClient | null = null;
    const trackedSocket = ws as WebSocket & { isAlive?: boolean };
    trackedSocket.isAlive = true;

    ws.on("pong", () => {
      trackedSocket.isAlive = true;
    });

    ws.on("message", async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === "join") {
        const { roomId, name, targetLang, participantKey } = msg;
        if (!roomId || !name) return;

        const trimmedName = name.trim();
        const normalizedTargetLang =
          typeof targetLang === "string" && targetLang.trim() ? targetLang : "en";
        const resolvedParticipantKey = getParticipantKey(participantKey, trimmedName);
        const nextClient: TranscribeClient = {
          ws,
          roomId,
          name: trimmedName,
          targetLang: normalizedTargetLang,
          participantKey: resolvedParticipantKey,
        };

        const room = getRoom(roomId);
        const existingClientIndex = room.findIndex(
          (candidate) => candidate.participantKey === resolvedParticipantKey,
        );
        const replacedClient =
          existingClientIndex === -1 ? null : room[existingClientIndex];

        if (existingClientIndex === -1) {
          room.push(nextClient);
        } else {
          room[existingClientIndex] = nextClient;
        }

        client = nextClient;

        logger.debug(
          {
            roomId,
            name: trimmedName,
            replacedExistingSocket:
              replacedClient !== null && replacedClient.ws !== ws,
          },
          "Transcription client joined",
        );
        send(ws, { type: "joined", roomId });

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
          "Ignored transcription message from replaced socket",
        );
        return;
      }

      if (msg.type === "settings") {
        if (typeof msg.targetLang === "string" && msg.targetLang.trim()) {
          client.targetLang = msg.targetLang;
        }
        return;
      }

      if (msg.type === "transcript") {
        const { text, sourceLang = "en" } = msg;
        if (!text || typeof text !== "string" || text.trim() === "") return;

        const room = getRoom(client.roomId);
        const original = text.trim();

        await Promise.all(
          room.map(async (peer) => {
            const translation = await translateText(original, sourceLang, peer.targetLang);

            send(peer.ws, {
              type: "subtitle",
              name: client.name,
              original,
              translated: translation.translatedText,
              translationStatus: translation.status,
              translationNote: translation.note,
              sourceLang,
              targetLang: peer.targetLang,
              ts: Date.now(),
            });
          }),
        );
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

  logger.info(
    {
      provider: AZURE_TRANSLATOR_KEY ? "azure" : LIBRETRANSLATE_URL ? "libretranslate" : "none",
      url: AZURE_TRANSLATOR_KEY ? AZURE_TRANSLATOR_ENDPOINT : LIBRETRANSLATE_URL || "not-configured",
    },
    "Transcription WebSocket ready at /ws/transcribe",
  );
  return wss;
}
