import { useState, useCallback } from "react";
import { I } from "./Icon";

interface Props {
  text?: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}

export default function VoiceAssistant({ text, label = "Écouter", className = "", iconOnly = false }: Props) {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text || document.body.innerText.slice(0, 500));
    u.lang = "fr-FR";
    u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }, [text, speaking]);

  if (iconOnly) {
    return (
      <button
        onClick={speak}
        type="button"
        aria-label={speaking ? "Arrêter la lecture vocale" : label}
        title={speaking ? "Arrêter" : label}
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl font-semibold text-base transition-all focus-visible:outline-none shrink-0 ${
          speaking
            ? "bg-[#F26522] text-white shadow-md animate-pulse"
            : "bg-[#F4F8F9] text-[#1D4E5B] hover:bg-[#1D4E5B] hover:text-white"
        } ${className}`.trim()}
      >
        {speaking ? (
          <span className="flex items-end gap-[2px] h-3.5">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className="voice-bar w-[2px] bg-white rounded-full" style={{ height: "4px" }} />
            ))}
          </span>
        ) : (
          <span className="text-base"><I e="🎙️" /></span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={speak}
      type="button"
      aria-label={speaking ? "Arrêter la lecture vocale" : label}
      title={speaking ? "Arrêter" : label}
      className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all focus-visible:outline-none shrink-0 ${
        speaking
          ? "bg-[#F26522] text-white shadow-lg"
          : "bg-[#E8F2F5] text-[#1D4E5B] hover:bg-[#1D4E5B] hover:text-white"
      } ${className}`.trim()}
    >
      {speaking ? (
        <>
          <span className="flex items-end gap-[3px] h-5">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className="voice-bar w-[3px] bg-white rounded-full" style={{ height: "6px" }} />
            ))}
          </span>
          Arrêter
        </>
      ) : (
        <>
          <span className="text-base"><I e="🎙️" /></span>
          {label}
        </>
      )}
    </button>
  );
}
