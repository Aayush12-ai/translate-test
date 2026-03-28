import { useEffect, useRef } from "react";
import { AlertCircle, Captions, Mic, MicOff, Languages } from "lucide-react";
import type { Subtitle } from "@/hooks/use-transcription";

interface LanguageOption {
  code: string;
  label: string;
}

interface TranscriptionPanelProps {
  subtitles: Subtitle[];
  isListening: boolean;
  micEnabled: boolean;
  error: string | null;
  sourceLangCode: string;
  targetLangCode: string;
  languages: LanguageOption[];
  onSourceLangChange: (code: string) => void;
  onTargetLangChange: (code: string) => void;
  onToggleMic: () => void;
  onDisable: () => void;
}

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TranscriptionPanel({
  subtitles,
  isListening,
  micEnabled,
  error,
  sourceLangCode,
  targetLangCode,
  languages,
  onSourceLangChange,
  onTargetLangChange,
  onToggleMic,
  onDisable,
}: TranscriptionPanelProps) {
  const transcriptListRef = useRef<HTMLDivElement | null>(null);
  const sourceLabel =
    languages.find((language) => language.code === sourceLangCode)?.label ?? sourceLangCode;
  const targetLabel =
    languages.find((language) => language.code === targetLangCode)?.label ?? targetLangCode;
  const latestTranslationIssue = [...subtitles]
    .reverse()
    .find(
      (subtitle) =>
        subtitle.translationStatus === "service-unavailable" ||
        subtitle.translationStatus === "translation-error",
    );

  useEffect(() => {
    const transcriptList = transcriptListRef.current;
    if (!transcriptList) {
      return;
    }

    transcriptList.scrollTop = transcriptList.scrollHeight;
  }, [subtitles.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
      <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Captions className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Live Translation
                </p>
                <h2 className="text-xl font-semibold text-slate-900">Transcript panel</h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Speech from this call appears here in <span className="font-medium text-slate-700">{targetLabel}</span>.
            </p>
          </div>
          <button
            onClick={onDisable}
            className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            Turn off
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                I speak
              </span>
              <select
                value={sourceLangCode}
                onChange={(event) => onSourceLangChange(event.target.value)}
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              >
                {languages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                <Languages className="h-3.5 w-3.5" />
                Translate to
              </span>
              <select
                value={targetLangCode}
                onChange={(event) => onTargetLangChange(event.target.value)}
                className="mt-2 w-full bg-transparent text-sm font-medium text-slate-900 outline-none"
              >
                {languages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs leading-5 text-slate-400">
            Choose the language being spoken, not the language you want to read. Hindi words like
            {" "}
            <span className="font-semibold text-slate-500">&quot;bhai&quot;</span>
            {" "}
            translate better when
            {" "}
            <span className="font-semibold text-slate-500">I speak</span>
            {" "}
            is set to Hindi and
            {" "}
            <span className="font-semibold text-slate-500">Translate to</span>
            {" "}
            is set to English.
          </p>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={onToggleMic}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium transition-colors ${
                micEnabled
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              <span>
                {isListening
                  ? "Mic is live"
                  : micEnabled
                    ? "Starting mic..."
                    : "Tap mic to speak"}
              </span>
            </button>
            <div className="min-w-0 text-xs text-slate-400">
              <p>
                {micEnabled
                  ? "Your speech will be translated for other people in the call."
                  : "You can receive translated subtitles without turning on your mic."}
              </p>
              <p className="mt-1">
                Anyone else who has their translation mic enabled can still appear here.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {latestTranslationIssue && (
            <div className="flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Showing original text because translation is unavailable right now.
                {latestTranslationIssue.translationNote ? ` ${latestTranslationIssue.translationNote}` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      <div ref={transcriptListRef} className="flex-1 space-y-3 overflow-y-auto bg-white px-5 py-5">
        {subtitles.length === 0 ? (
          <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
              <Captions className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Waiting for translated speech</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
              When someone speaks with transcription enabled, their words will appear here in {targetLabel}.
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Input language: {sourceLabel}
            </p>
          </div>
        ) : (
          subtitles.map((subtitle) => (
            <article
              key={subtitle.id}
              className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sm font-semibold text-sky-700">
                    {subtitle.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{subtitle.name}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Translated</p>
                  </div>
                </div>
                <time className="shrink-0 text-xs font-medium text-slate-400">
                  {formatTimestamp(subtitle.ts)}
                </time>
              </div>

              <p className="mt-4 text-base font-medium leading-7 text-slate-900">{subtitle.translated}</p>

              {subtitle.original !== subtitle.translated && (
                <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm leading-6 text-slate-500">
                  Original: {subtitle.original}
                </div>
              )}

              {subtitle.translationStatus !== "translated" && subtitle.original === subtitle.translated && (
                <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm leading-6 text-slate-500">
                  {subtitle.translationStatus === "same-language"
                    ? "Translation was not needed because the source and target languages are the same."
                    : subtitle.translationNote ?? "Translation was unavailable, so the original transcript is shown."}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
