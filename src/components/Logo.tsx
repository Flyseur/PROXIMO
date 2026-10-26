import { useState } from "react";

interface Props {
  size?: "sm" | "md" | "lg";
  variant?: "full" | "icon";
  className?: string;
}

// Placez votre logo dans public/logo.png (le fichier Figma « Logo_Proximo_modernis_.png »).
// À défaut, /logo.svg est utilisé.
export default function Logo({ size = "md", variant = "full", className = "" }: Props) {
  const [src, setSrc] = useState("/logo.png");
  const iconSize = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-14 h-14" }[size];
  const textSize = { sm: "text-lg", md: "text-xl", lg: "text-3xl" }[size];
  const onError = () => setSrc("/logo.svg");

  if (variant === "icon") {
    return <img src={src} onError={onError} alt="Proximo CI" className={`${iconSize} object-contain ${className}`} />;
  }
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={src} onError={onError} alt="" aria-hidden="true" className={`${iconSize} object-contain flex-shrink-0`} />
      <div className="leading-none">
        <span style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em" }} className={`font-black text-[#F26522] block ${textSize}`}>
          PROXIMO
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#1D4E5B] block mt-0.5">
          Mise en relation clients & artisans
        </span>
      </div>
    </div>
  );
}
