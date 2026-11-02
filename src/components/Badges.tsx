import React from "react";
import { RiVipCrown2Fill, RiVipDiamondFill, RiCamera3Fill, RiSparkling2Fill } from "react-icons/ri";

/**
 * Badge officiel Vérifié au style authentique Facebook & Instagram (Meta).
 * Rosace crénelée bleue (#0095F6) avec coche blanche immaculée.
 */
export function MetaVerifiedBadge({
  className = "w-4 h-4",
  title = "Compte vérifié et certifié par Proximo CI",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 align-middle ${className}`}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-xs" aria-hidden="true">
        {/* Sceau dentelé officiel Meta / Instagram (#0095F6) */}
        <path
          d="M10.007 2.104C8.605 1.65 7.082 2.281 6.412 3.593L5.606 5.17a2.09 2.09 0 0 1-.436.436L3.593 6.412C2.281 7.082 1.65 8.605 2.104 10.007l.545 1.685c.065.2.065.416 0 .616l-.545 1.685c-.454 1.402.177 2.925 1.489 3.596l1.577.805c.187.096.34.248.436.436l.806 1.577c.67 1.312 2.193 1.943 3.595 1.49l1.685-.546a1.1 1.1 0 0 1 .616 0l1.685.546c1.402.454 2.925-.177 3.595-1.49l.806-1.577a2.09 2.09 0 0 1 .436-.436l1.577-.805c1.312-.67 1.943-2.194 1.49-3.596l-.546-1.685a1.1 1.1 0 0 1 0-.616l.546-1.685c.453-1.402-.178-2.925-1.49-3.595l-1.577-.806a2.09 2.09 0 0 1-.436-.436L17.588 3.593c-.67-1.312-2.193-1.943-3.595-1.49l-1.685.546a1.1 1.1 0 0 1-.616 0L10.007 2.104Z"
          fill="#0095F6"
        />
        {/* Coche blanche immaculée */}
        <path
          d="M6.76 11.757l1.414-1.414L11.002 13.17l5.657-5.657 1.414 1.414-7.07 7.072-4.243-4.243Z"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
}

/**
 * Pilule Vérifié premium incluant le badge officiel Facebook/Instagram.
 */
export function VerifiedPill({
  className = "",
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-[#0064C8] bg-[#EBF5FF] border border-[#B9E0FF] shadow-xs hover:bg-[#E1F0FF] transition-all duration-150 select-none ${className}`}
      title="Profil vérifié & certifié par Proximo CI"
    >
      <MetaVerifiedBadge className="w-3.5 h-3.5" />
      {showText && <span>Vérifié</span>}
    </span>
  );
}

/**
 * Badge de Formule / Plan ultra-stylé (Pro, Entreprise, Gratuit).
 * Pro : Dégradé chaud solaire/ambre avec couronne dorée et lueur subtile.
 * Entreprise : Dégradé royal violet/indigo avec diamant.
 */
export function PlanBadge({
  plan,
  size = "md",
  className = "",
}: {
  plan?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const currentPlan = (plan || "Gratuit").trim();

  if (currentPlan === "Pro") {
    const sizeClasses =
      size === "lg"
        ? "px-4 py-1.5 text-sm gap-2"
        : size === "sm"
        ? "px-2 py-0.5 text-[10px] gap-1"
        : "px-3 py-1 text-xs gap-1.5";

    return (
      <span
        className={`inline-flex items-center font-black tracking-wider text-white uppercase rounded-full shadow-sm bg-gradient-to-r from-[#F59E0B] via-[#F26522] to-[#EA580C] border border-amber-200/60 shadow-orange-500/25 transition-transform hover:scale-105 select-none ${sizeClasses} ${className}`}
        title="Abonnement Professionnel actif"
      >
        <RiVipCrown2Fill className={size === "lg" ? "w-4 h-4 text-amber-100" : "w-3.5 h-3.5 text-amber-100"} />
        <span>PRO</span>
        <RiSparkling2Fill className="w-2.5 h-2.5 text-amber-200/80 -ml-0.5" />
      </span>
    );
  }

  if (currentPlan === "Entreprise") {
    const sizeClasses =
      size === "lg"
        ? "px-4 py-1.5 text-sm gap-2"
        : size === "sm"
        ? "px-2 py-0.5 text-[10px] gap-1"
        : "px-3 py-1 text-xs gap-1.5";

    return (
      <span
        className={`inline-flex items-center font-black tracking-wider text-white uppercase rounded-full shadow-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 border border-purple-200/50 shadow-purple-500/25 transition-transform hover:scale-105 select-none ${sizeClasses} ${className}`}
        title="Abonnement Entreprise actif"
      >
        <RiVipDiamondFill className={size === "lg" ? "w-4 h-4 text-purple-100" : "w-3.5 h-3.5 text-purple-100"} />
        <span>ENTREPRISE</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-[#6B7280] bg-[#F4F8F9] border border-[#E8F2F5] select-none ${className}`}
    >
      Plan Gratuit
    </span>
  );
}

/**
 * Bouton d'action pour modifier la photo de profil (Avatar).
 * Design rond moderne avec anneau blanc, ombre portée, icône caméra nette et lisible.
 */
export function AvatarEditButton({
  onClick,
  title = "Changer la photo de profil",
  className = "",
}: {
  onClick: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute -bottom-2 -right-2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#F26522] to-[#FF7A30] hover:from-[#E05312] hover:to-[#F26522] text-white ring-4 ring-white shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer group/cam ${className}`}
      title={title}
      aria-label={title}
    >
      <RiCamera3Fill className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-xs transition-transform group-hover/cam:scale-110" />
    </button>
  );
}
