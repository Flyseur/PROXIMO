import { useState, useRef, useEffect } from "react";
import WhatsAppIcon from "./WhatsAppIcon";
import { formatPhone } from "../lib/api";

import { I } from "./Icon";
interface Props {
  phone: string;
  name: string;
  message?: string;
  variant?: "button" | "link";
  className?: string;
}

export default function ContactChooser({ phone, name, message, variant = "button", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message ?? `Bonjour ${name}, je vous contacte via Proximo CI !`)}`;

  const trigger = variant === "link" ? (
    <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
      className={`flex items-center gap-1 text-[#25D366] hover:text-white transition-colors font-semibold text-xs ${className}`}>
      <WhatsAppIcon />Contacter
    </button>
  ) : (
    <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
      className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1D4E5B] text-white font-bold text-sm hover:bg-[#163A43] transition-all hover:scale-105 active:scale-95 shadow-sm ${className}`}>
      <I e="📞" /> Contacter
    </button>
  );

  return (
    <div ref={ref} className="relative inline-block">
      {trigger}
      {open && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-white rounded-2xl shadow-2xl border-2 border-[#E8F2F5] overflow-hidden animate-[fadeSlideUp_0.15s_ease-out]" role="dialog" aria-label={`Contacter ${name}`}>
          <div className="bg-[#1D4E5B] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">{name}</p>
              <p className="text-[#8FAFB7] text-xs">Choisissez votre moyen de contact</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-white/50 hover:text-white transition-colors text-lg leading-none"><I e="✕" /></button>
          </div>
          <div className="p-3 flex flex-col gap-2">
            <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3.5 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#1EB85A] transition-colors">
              <WhatsAppIcon />
              <div><p className="leading-tight">Envoyer un message</p><p className="text-xs font-normal text-green-100">Via WhatsApp</p></div>
            </a>
            <a href={`tel:+${phone}`} onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3.5 bg-[#E8F2F5] text-[#1D4E5B] rounded-xl font-bold text-sm hover:bg-[#1D4E5B] hover:text-white transition-colors group">
              <span className="text-xl flex-shrink-0"><I e="📞" /></span>
              <div><p className="leading-tight">Appel téléphonique</p><p className="text-xs font-normal text-[#6B7280] group-hover:text-[#8FAFB7]">{formatPhone(phone)}</p></div>
            </a>
          </div>
          <p className="text-xs text-[#9CA3AF] text-center pb-3 px-4"><I e="🔒" /> Vos coordonnées restent privées</p>
        </div>
      )}
    </div>
  );
}
