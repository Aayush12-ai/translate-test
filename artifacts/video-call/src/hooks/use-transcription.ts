import { useEffect, useRef, useState, useCallback } from "react";

export interface Subtitle {
  id: number;
  name: string;
  original: string;
  translated: string;
  ts: number;
}

interface UseTranscriptionOptions {
  roomId: string;
  name: string;
  enabled: boolean;
  sourceLang: string;
  targetLang: string;
  speechLang: string;
}

const SUBTITLE_TTL_MS = 6000;
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
  enabled,
  sourceLang,
  targetLang,
  speechLang,
}: UseTranscriptionOptions) {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addSubtitle = useCallback((subtitle: Omit<Subtitle, "id">) => {
    const id = ++subtitleIdCounter;
    setSubtitles((prev) => [...prev.slice(-4), { ...subtitle, id }]);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    cleanupTimerRef.current = setInterval(() => {
      const cutoff = Date.now() - SUBTITLE_TTL_MS;
      setSubtitles((prev) => prev.filter((s) => s.ts > cutoff));
    }, 1000);
    return () => {
      if (cleanupTimerRef.current) clearInterval(cleanupTimerRef.current);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !roomId || !name) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/transcribe`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", roomId, name }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "subtitle") {
          addSubtitle({
            name: msg.name as string,
            original: msg.original as string,
            translated: msg.translated as string,
            ts: Date.now(),
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setError("Subtitle connection failed");
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [enabled, roomId, name, addSubtitle]);

  useEffect(() => {
    if (!enabled) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    setError(null);

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = speechLang;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      if (enabled && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // already started
        }
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed") {
        setError("Microphone permission denied. Please allow mic access and try again.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Speech recognition error: ${e.error}`);
      }
    };

    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          if (!text) continue;
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "transcript", text, sourceLang, targetLang }));
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
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
      setIsListening(false);
    };
  }, [enabled, speechLang, sourceLang, targetLang]);

  const clearSubtitles = useCallback(() => setSubtitles([]), []);

  return { subtitles, isListening, error, clearSubtitles };
}
