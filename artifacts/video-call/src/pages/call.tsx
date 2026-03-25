import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Phone,
  AlertCircle,
  Monitor,
  MonitorOff,
  MonitorX,
  Check,
  X,
  Captions,
  CaptionsOff,
} from "lucide-react";
import { useWebRTC } from "@/hooks/use-webrtc";
import { useTranscription } from "@/hooks/use-transcription";
import { VideoPlayer } from "@/components/video-player";
import { motion, AnimatePresence } from "framer-motion";

interface Language {
  code: string;
  speechCode: string;
  label: string;
}

const LANGUAGES: Language[] = [
  { code: "en", speechCode: "en-US", label: "English" },
  { code: "es", speechCode: "es-ES", label: "Spanish" },
  { code: "fr", speechCode: "fr-FR", label: "French" },
  { code: "de", speechCode: "de-DE", label: "German" },
  { code: "it", speechCode: "it-IT", label: "Italian" },
  { code: "pt", speechCode: "pt-PT", label: "Portuguese" },
  { code: "ru", speechCode: "ru-RU", label: "Russian" },
  { code: "zh", speechCode: "zh-CN", label: "Chinese" },
  { code: "ja", speechCode: "ja-JP", label: "Japanese" },
  { code: "ko", speechCode: "ko-KR", label: "Korean" },
  { code: "ar", speechCode: "ar-SA", label: "Arabic" },
  { code: "hi", speechCode: "hi-IN", label: "Hindi" },
  { code: "nl", speechCode: "nl-NL", label: "Dutch" },
  { code: "pl", speechCode: "pl-PL", label: "Polish" },
  { code: "tr", speechCode: "tr-TR", label: "Turkish" },
];

export function Call() {
  const params = useParams();
  const roomId = params.roomId || "";
  const [, setLocation] = useLocation();

  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [sourceLangCode, setSourceLangCode] = useState("en");
  const [targetLangCode, setTargetLangCode] = useState("es");

  const sourceLang = LANGUAGES.find((l) => l.code === sourceLangCode) ?? LANGUAGES[0];

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const t = searchParams.get("token");
    const n = searchParams.get("name");

    if (!t || !n) {
      setLocation("/");
      return;
    }

    setToken(t);
    setName(n);
  }, [setLocation]);

  const {
    localStream,
    remoteStream,
    error,
    mediaError,
    isConnected,
    isMuted,
    isVideoOff,
    isScreenSharing,
    remoteIsScreenSharing,
    screenShareRequest,
    screenShareRequestPending,
    screenShareDenied,
    isHost,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    approveScreenShare,
    denyScreenShare,
  } = useWebRTC(roomId, token, name, attempt);

  const { subtitles, isListening, error: transcriptionError } = useTranscription({
    roomId,
    name,
    enabled: subtitlesEnabled && !!token && !!name,
    sourceLang: sourceLangCode,
    targetLang: targetLangCode,
    speechLang: sourceLang.speechCode,
  });

  if (!token || !name) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="bg-destructive/10 border border-destructive/20 p-8 rounded-3xl max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Connection Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => setAttempt((value) => value + 1)}
              className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors font-medium"
            >
              Retry Connection
            </button>
            <button
              onClick={() => setLocation("/")}
              className="px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-xl transition-colors font-medium"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black flex flex-col overflow-hidden">
      {/* Screen share request banner */}
      <AnimatePresence>
        {screenShareRequest && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute left-1/2 top-4 z-50 flex w-full max-w-sm -translate-x-1/2 items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900 px-5 py-4 shadow-2xl"
          >
            <Monitor className="h-5 w-5 shrink-0 text-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {screenShareRequest.name} wants to share their screen
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">Allow screen sharing?</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={approveScreenShare}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white transition-colors hover:bg-green-500"
                title="Allow"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={denyScreenShare}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-white transition-colors hover:bg-zinc-600"
                title="Deny"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen share pending / denied banner */}
      <AnimatePresence>
        {(screenShareRequestPending || screenShareDenied) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`absolute left-1/2 top-4 z-50 flex w-full max-w-xs -translate-x-1/2 items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl ${
              screenShareDenied
                ? "border-destructive/30 bg-destructive/10"
                : "border-white/10 bg-zinc-900"
            }`}
          >
            {screenShareDenied ? (
              <>
                <MonitorX className="h-5 w-5 shrink-0 text-destructive" />
                <p className="text-sm text-white">Screen share was denied</p>
              </>
            ) : (
              <>
                <Monitor className="h-5 w-5 shrink-0 animate-pulse text-blue-400" />
                <p className="text-sm text-white">Waiting for host to approve...</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video area */}
      <div className="relative flex-1 min-h-0 p-3">
        {mediaError && (
          <div className="absolute left-3 right-3 top-3 z-20 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 backdrop-blur-md md:left-6 md:right-auto md:max-w-md">
            <p>{mediaError}</p>
            <button
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-3 rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-amber-300"
            >
              Retry Camera/Mic
            </button>
          </div>
        )}

        <div className="h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
          {remoteStream ? (
            <div className="relative h-full w-full">
              <VideoPlayer
                stream={remoteStream}
                className="h-full w-full !rounded-none"
                name={remoteIsScreenSharing ? undefined : "Guest"}
              />
              {remoteIsScreenSharing && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 text-sm font-medium backdrop-blur-md">
                  <Monitor className="h-4 w-4 text-blue-400" />
                  <span>Screen share</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center space-y-4 text-muted-foreground">
              <div className="relative">
                <div className="h-24 w-24 animate-[spin_4s_linear_infinite] rounded-full border-2 border-dashed border-muted-foreground/30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
                    <VideoIcon className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                </div>
              </div>
              <p className="font-medium">Waiting for others to join...</p>
              <p className="max-w-xs px-4 text-center text-sm opacity-50">
                Share the room link and password with the person you want to talk to.
              </p>
            </div>
          )}
        </div>

        {/* Local video pip */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="absolute right-6 top-6 z-10 aspect-video w-36 overflow-hidden rounded-xl border-2 border-white/10 bg-zinc-800 shadow-2xl md:w-52"
        >
          <VideoPlayer
            stream={localStream}
            muted
            mirrored={!isScreenSharing}
            className="h-full w-full !rounded-none"
          />
          {isScreenSharing && (
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
              <Monitor className="h-3 w-3 text-blue-400" />
              <span className="text-xs text-white/80">Sharing</span>
            </div>
          )}
        </motion.div>

        {/* Connected badge */}
        {isConnected && (
          <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
            <span className="text-xs font-medium tracking-wide text-white/80">CONNECTED</span>
          </div>
        )}

        {/* Listening badge */}
        {subtitlesEnabled && isListening && (
          <div className="absolute left-6 top-16 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
            <span className="text-xs font-medium tracking-wide text-white/70">LISTENING</span>
          </div>
        )}

        {/* Transcription error */}
        {subtitlesEnabled && transcriptionError && (
          <div className="absolute left-6 top-28 rounded-xl border border-amber-500/20 bg-black/70 px-4 py-2 text-xs text-amber-300 backdrop-blur-md max-w-xs">
            {transcriptionError}
          </div>
        )}

        {/* Subtitle overlay */}
        <AnimatePresence>
          {subtitlesEnabled && subtitles.length > 0 && (
            <div className="absolute inset-x-4 bottom-4 z-20 flex flex-col gap-1.5 items-center pointer-events-none">
              {subtitles.map((sub) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="max-w-2xl w-full"
                >
                  <div className="rounded-xl bg-black/80 px-4 py-2 backdrop-blur-md text-center shadow-lg">
                    <span className="text-xs font-semibold text-blue-400 mr-2">{sub.name}:</span>
                    <span className="text-sm font-medium text-white">{sub.translated}</span>
                    {sub.original !== sub.translated && (
                      <span className="ml-2 text-xs text-white/35 italic">({sub.original})</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Language picker panel */}
      <AnimatePresence>
        {subtitlesEnabled && showLangPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden border-t border-white/5 bg-zinc-900/95 backdrop-blur-sm"
          >
            <div className="flex items-center justify-center gap-4 flex-wrap px-6 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 uppercase tracking-wider whitespace-nowrap">I speak</span>
                <select
                  value={sourceLangCode}
                  onChange={(e) => setSourceLangCode(e.target.value)}
                  className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <span className="text-white/30 text-lg">→</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 uppercase tracking-wider whitespace-nowrap">Translate to</span>
                <select
                  value={targetLangCode}
                  onChange={(e) => setTargetLangCode(e.target.value)}
                  className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => { setSubtitlesEnabled(false); setShowLangPicker(false); }}
                className="ml-2 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Turn off
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control bar */}
      <div className="shrink-0 border-t border-white/5 bg-black/80 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3 md:gap-4">
          <button
            onClick={toggleMute}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all md:h-14 md:w-14 ${
              isMuted ? "bg-destructive text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="h-5 w-5 md:h-6 md:w-6" /> : <Mic className="h-5 w-5 md:h-6 md:w-6" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all md:h-14 md:w-14 ${
              isVideoOff ? "bg-destructive text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff className="h-5 w-5 md:h-6 md:w-6" /> : <VideoIcon className="h-5 w-5 md:h-6 md:w-6" />}
          </button>

          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            disabled={screenShareRequestPending}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50 md:h-14 md:w-14 ${
              isScreenSharing ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title={
              isScreenSharing ? "Stop sharing"
                : isHost ? "Share screen"
                : screenShareRequestPending ? "Waiting for approval..."
                : "Request screen share"
            }
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5 md:h-6 md:w-6" /> : <Monitor className="h-5 w-5 md:h-6 md:w-6" />}
          </button>

          {/* Subtitles / CC button */}
          <button
            onClick={() => {
              if (!subtitlesEnabled) {
                setSubtitlesEnabled(true);
                setShowLangPicker(true);
              } else {
                setShowLangPicker((v) => !v);
              }
            }}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all md:h-14 md:w-14 ${
              subtitlesEnabled ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title={subtitlesEnabled ? "Subtitles on — click to change languages" : "Turn on live subtitles"}
          >
            {subtitlesEnabled ? <Captions className="h-5 w-5 md:h-6 md:w-6" /> : <CaptionsOff className="h-5 w-5 md:h-6 md:w-6" />}
          </button>

          <div className="h-8 w-px bg-white/10" />

          <button
            onClick={() => setLocation("/")}
            className="flex h-12 w-16 items-center justify-center rounded-full bg-destructive text-white transition-all shadow-lg shadow-destructive/30 hover:scale-105 hover:bg-destructive/90 active:scale-95 md:h-14 md:w-20"
            title="Leave call"
          >
            <Phone className="h-6 w-6 rotate-[135deg] md:h-7 md:w-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
