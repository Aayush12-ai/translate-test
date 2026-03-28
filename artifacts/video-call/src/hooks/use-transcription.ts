import { useEffect, useRef, useState, useCallback } from "react";
import { resolveApiWebSocketCandidates } from "@/lib/utils";

const TRANSCRIPTION_ACK_TIMEOUT_MS = 5_000;
const TRANSCRIPTION_RECONNECT_DELAY_MS = 1_500;
const TRANSCRIPTION_JOIN_RETRY_MS = 1_000;
const TRANSCRIPTION_RESTART_DELAY_MS = 600;

export type TranslationStatus =
  | "translated"
  | "same-language"
  | "service-unavailable"
  | "translation-error";

export interface Subtitle {
  id: number;
  name: string;
  original: string;
  translated: string;
  translationStatus: TranslationStatus;
  translationNote?: string;
  ts: number;
}

interface UseTranscriptionOptions {
  roomId: string;
  name: string;
  participantKey: string;
  enabled: boolean;
  captureEnabled: boolean;
  sourceLang: string;
  targetLang: string;
  speechLang: string;
}

const MAX_SUBTITLE_HISTORY = 40;
let subtitleIdCounter = 0;

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function useTranscription({
  roomId,
  name,
  participantKey,
  enabled,
  captureEnabled,
  sourceLang,
  targetLang,
  speechLang,
}: UseTranscriptionOptions) {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [isSocketReady, setIsSocketReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const targetLangRef = useRef(targetLang);
  const languagePairRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const recognitionRestartTimerRef = useRef<number | null>(null);

  const addSubtitle = useCallback((subtitle: Omit<Subtitle, "id">) => {
    const id = ++subtitleIdCounter;
    setSubtitles((prev) => [...prev.slice(-(MAX_SUBTITLE_HISTORY - 1)), { ...subtitle, id }]);
  }, []);

  useEffect(() => {
    targetLangRef.current = targetLang;
  }, [targetLang]);

  useEffect(() => {
    if (!enabled) {
      languagePairRef.current = null;
      return;
    }

    const nextLanguagePair = `${sourceLang}->${targetLang}`;

    if (languagePairRef.current && languagePairRef.current !== nextLanguagePair) {
      setSubtitles([]);
    }

    languagePairRef.current = nextLanguagePair;
  }, [enabled, sourceLang, targetLang]);

  useEffect(() => {
    if (!enabled || !roomId || !name || !participantKey) {
      wsRef.current?.close();
      wsRef.current = null;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (!roomId || !name || !participantKey) {
        setSubtitles([]);
      }
      setConnectionError(null);
      setRecognitionError(null);
      setIsSocketReady(false);
      return;
    }

    let cancelled = false;

    const connectSocket = (socketCandidates: string[], candidateIndex = 0) => {
      const socketUrl = socketCandidates[candidateIndex];

      if (!socketUrl) {
        setConnectionError("Subtitle connection failed");
        return;
      }

      let opened = false;
      let joined = false;
      const ws = new WebSocket(socketUrl);
      wsRef.current = ws;
      setIsSocketReady(false);
      let joinRetryTimer: number | null = null;
      const sendJoin = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "join",
              roomId,
              name,
              participantKey,
              targetLang: targetLangRef.current,
            }),
          );
        }
      };
      const clearJoinRetryTimer = () => {
        if (joinRetryTimer !== null) {
          window.clearTimeout(joinRetryTimer);
          joinRetryTimer = null;
        }
      };
      const ackTimer = window.setTimeout(() => {
        if (!joined && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, TRANSCRIPTION_ACK_TIMEOUT_MS);

      ws.onopen = () => {
        if (wsRef.current !== ws) {
          ws.close();
          return;
        }

        opened = true;
        if (reconnectTimerRef.current !== null) {
          window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        sendJoin();

        const scheduleJoinRetry = () => {
          clearJoinRetryTimer();
          joinRetryTimer = window.setTimeout(() => {
            if (joined || cancelled || ws.readyState !== WebSocket.OPEN) {
              clearJoinRetryTimer();
              return;
            }

            sendJoin();
            scheduleJoinRetry();
          }, TRANSCRIPTION_JOIN_RETRY_MS);
        };

        scheduleJoinRetry();
      };

      ws.onmessage = (event) => {
        if (wsRef.current !== ws) {
          return;
        }

        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "joined") {
            joined = true;
            window.clearTimeout(ackTimer);
            clearJoinRetryTimer();
            setIsSocketReady(true);
            setConnectionError(null);
            return;
          }
          if (msg.type === "subtitle") {
            addSubtitle({
              name: msg.name as string,
              original: msg.original as string,
              translated: msg.translated as string,
              translationStatus: (msg.translationStatus as TranslationStatus) ?? "translated",
              translationNote:
                typeof msg.translationNote === "string" ? msg.translationNote : undefined,
              ts: typeof msg.ts === "number" ? msg.ts : Date.now(),
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) {
          return;
        }

        if (!opened || !joined) {
          return;
        }

        setConnectionError("Subtitle connection failed");
      };

      ws.onclose = () => {
        window.clearTimeout(ackTimer);
        clearJoinRetryTimer();

        if (wsRef.current !== ws) {
          return;
        }

        wsRef.current = null;
        setIsSocketReady(false);

        if (cancelled) {
          return;
        }

        if (!opened || !joined) {
          connectSocket(socketCandidates, candidateIndex + 1);
          return;
        }

        setConnectionError("Subtitle connection lost. Reconnecting...");
        reconnectTimerRef.current = window.setTimeout(() => {
          connectSocket(socketCandidates, 0);
        }, TRANSCRIPTION_RECONNECT_DELAY_MS);
      };
    };

    void resolveApiWebSocketCandidates("/ws/transcribe").then((socketCandidates) => {
      if (cancelled) {
        return;
      }

      connectSocket(socketCandidates);
    });

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
      setIsSocketReady(false);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [enabled, roomId, name, participantKey, addSubtitle]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "settings", targetLang }));
    }
  }, [enabled, targetLang]);

  useEffect(() => {
    if (!enabled || !captureEnabled || !isSocketReady) {
      if (recognitionRestartTimerRef.current !== null) {
        window.clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      setRecognitionError(null);
      return;
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setRecognitionError("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    setRecognitionError(null);

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);

      if (enabled && captureEnabled && recognitionRef.current === recognition) {
        if (recognitionRestartTimerRef.current !== null) {
          window.clearTimeout(recognitionRestartTimerRef.current);
        }

        recognitionRestartTimerRef.current = window.setTimeout(() => {
          if (!enabled || !captureEnabled || recognitionRef.current !== recognition) {
            recognitionRestartTimerRef.current = null;
            return;
          }

          try {
            recognition.start();
          } catch {
            // ignore if already started
          } finally {
            recognitionRestartTimerRef.current = null;
          }
        }, TRANSCRIPTION_RESTART_DELAY_MS);
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed") {
        setRecognitionError("Microphone permission denied. Please allow mic access and try again.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setRecognitionError(`Speech recognition error: ${e.error}`);
      }
    };

    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          if (!text) continue;
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "transcript", text, sourceLang }));
          }
        }
      }
    };

    try {
      recognition.start();
    } catch {
      // ignore if already started
    }

    return () => {
      if (recognitionRestartTimerRef.current !== null) {
        window.clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
      setIsListening(false);
    };
  }, [enabled, captureEnabled, isSocketReady, speechLang, sourceLang]);

  const clearSubtitles = useCallback(() => setSubtitles([]), []);

  return {
    subtitles,
    isListening,
    error: connectionError ?? recognitionError,
    clearSubtitles,
  };
}
