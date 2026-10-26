// Icônes vectorielles modernes et stylisées (Remix Icon + Tabler + Font Awesome via react-icons)
// Offre un design premium, net et coloré pour remplacer les anciens glyphes basiques.
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { FaWhatsapp } from "react-icons/fa6";
import {
  RiMapPin2Fill, RiCheckboxCircleFill, RiStarFill, RiFlashlightFill, RiSearch2Line,
  RiToolsFill, RiWallet3Fill, RiPriceTag3Fill, RiMegaphoneFill, RiChatSmile2Fill,
  RiMessage3Fill, RiUser3Fill, RiTeamFill, RiPhoneFill, RiMailFill, RiLock2Fill,
  RiLockPasswordFill, RiShieldCheckFill, RiFileList3Fill, RiClipboardFill,
  RiBarChartGroupedFill, RiStockFill, RiBuilding4Fill, RiHome4Fill, RiPaletteFill,
  RiHammerFill, RiDropFill, RiSnowflakeFill, RiPlantFill, RiLeafFill, RiSettings5Fill,
  RiCarFill, RiTaxiFill, RiSparkling2Fill, RiScissors2Fill, RiHeartPulseFill,
  RiEmotionHappyFill, RiBrush3Fill, RiRestaurant2Fill, RiCupFill, RiCamera3Fill,
  RiMovie2Fill, RiMic2Fill, RiCheckLine, RiCloseLine, RiArrowRightLine, RiArrowLeftLine,
  RiHeartFill, RiSmartphoneFill, RiBankCardFill, RiTimeFill, RiAlertFill,
  RiInformationFill, RiRefreshLine, RiSendPlaneFill, RiEyeFill, RiEyeCloseFill,
  RiHandHeartFill, RiForbid2Fill, RiHashtag, RiWalkFill, RiImage2Fill, RiEdit2Fill,
  RiTrophyFill, RiMedalFill, RiGraduationCapFill, RiLogoutBoxRFill, RiBriefcase4Fill,
  RiAlarmWarningFill, RiBattery2ChargeFill, RiCalendar2Fill
} from "react-icons/ri";
import {
  TbHelmet, TbWall, TbWindow, TbConfetti, TbCookie, TbBuildingSkyscraper,
  TbBuildingFactory2
} from "react-icons/tb";

const MAP: Record<string, IconType> = {
  // Navigation & Localisation
  "📍": RiMapPin2Fill,
  "🏠": RiHome4Fill,
  "🏡": RiHome4Fill,
  "🏢": RiBuilding4Fill,
  "🏦": RiBuilding4Fill,
  "🏫": RiGraduationCapFill,
  "🏭": TbBuildingFactory2,
  "🏗": TbBuildingSkyscraper,
  "🏗️": TbBuildingSkyscraper,

  // Recherche & Outils
  "🔍": RiSearch2Line,
  "🛠": RiToolsFill,
  "🛠️": RiToolsFill,
  "🔧": RiToolsFill,
  "🔨": RiHammerFill,
  "🔩": RiSettings5Fill,

  // Métiers & Secteurs
  "👷": TbHelmet,
  "🧱": TbWall,
  "🪟": TbWindow,
  "🚿": RiDropFill,
  "⚡": RiFlashlightFill,
  "❄": RiSnowflakeFill,
  "❄️": RiSnowflakeFill,
  "🌿": RiPlantFill,
  "🌱": RiLeafFill,
  "🎨": RiPaletteFill,
  "🚗": RiCarFill,
  "🚘": RiTaxiFill,
  "🔋": RiBattery2ChargeFill,
  "💅": RiSparkling2Fill,
  "💇": RiScissors2Fill,
  "💆": RiHeartPulseFill,
  "👶": RiEmotionHappyFill,
  "🧹": RiBrush3Fill,
  "👨‍🍳": RiRestaurant2Fill,
  "🍽": RiCupFill,
  "🍽️": RiCupFill,
  "📸": RiCamera3Fill,
  "🎬": RiMovie2Fill,
  "🎤": RiMic2Fill,
  "🎙": RiMic2Fill,
  "🎙️": RiMic2Fill,
  "🎉": TbConfetti,
  "🍪": TbCookie,

  // Communication & Comptes
  "📱": RiSmartphoneFill,
  "📲": FaWhatsapp,
  "📞": RiPhoneFill,
  "✉": RiMailFill,
  "✉️": RiMailFill,
  "💬": RiChatSmile2Fill,
  "🗨": RiChatSmile2Fill,
  "🗨️": RiChatSmile2Fill,
  "📢": RiMegaphoneFill,
  "👤": RiUser3Fill,
  "👥": RiTeamFill,
  "💼": RiBriefcase4Fill,
  "🚪": RiLogoutBoxRFill,

  // Confiance & Statuts
  "⭐": RiStarFill,
  "★": RiStarFill,
  "✅": RiCheckboxCircleFill,
  "🛡": RiShieldCheckFill,
  "🛡️": RiShieldCheckFill,
  "🔒": RiLock2Fill,
  "🔐": RiLockPasswordFill,
  "🚨": RiAlarmWarningFill,
  "⚠": RiAlertFill,
  "⚠️": RiAlertFill,
  "🏆": RiTrophyFill,
  "🏅": RiMedalFill,
  "🎓": RiGraduationCapFill,
  "♥": RiHeartFill,
  "👋": RiHandHeartFill,
  "🚫": RiForbid2Fill,

  // Finance & Tarifs
  "💰": RiWallet3Fill,
  "🏷": RiPriceTag3Fill,
  "🏷️": RiPriceTag3Fill,
  "💳": RiBankCardFill,

  // Formulaires & Données
  "📋": RiFileList3Fill,
  "📄": RiFileList3Fill,
  "📝": RiEdit2Fill,
  "📊": RiBarChartGroupedFill,
  "📈": RiStockFill,
  "⏱": RiTimeFill,
  "⏱️": RiTimeFill,
  "⏳": RiTimeFill,
  "📅": RiCalendar2Fill,
  "🔄": RiRefreshLine,
  "ℹ": RiInformationFill,
  "ℹ️": RiInformationFill,
  "📤": RiSendPlaneFill,
  "📨": RiSendPlaneFill,
  "🔢": RiHashtag,
  "🚶": RiWalkFill,
  "🖼": RiImage2Fill,
  "👀": RiEyeFill,
  "👁": RiEyeFill,
  "🙈": RiEyeCloseFill,

  // Symboles & Flèches
  "✓": RiCheckLine,
  "✗": RiCloseLine,
  "✕": RiCloseLine,
  "→": RiArrowRightLine,
  "←": RiArrowLeftLine,
};

// Accents de couleurs intelligents quand aucune couleur explicite n'est passée
const DEFAULT_COLORS: Record<string, string> = {
  "⭐": "text-amber-400",
  "★": "text-amber-400",
  "✅": "text-emerald-500",
  "✓": "text-emerald-500",
  "✗": "text-rose-500",
  "✕": "text-rose-500",
  "♥": "text-rose-500",
  "📲": "text-[#25D366]",
  "📍": "text-[#F26522]",
  "⚡": "text-amber-500",
  "⚠": "text-amber-500",
  "⚠️": "text-amber-500",
  "🎉": "text-pink-500",
};

const COLOR_PROP_RX = /(?:^|\s)text-(?:white|black|transparent|current|[a-z]+-\d+|\[[^\]]+\])/;
const FLAG = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;

// Drapeau moderne de la Côte d'Ivoire (orange · blanc · vert)
function CIFlag({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 3 2" role="img" aria-label="Côte d'Ivoire" className={`inline-block h-[0.85em] w-[1.25em] align-[-0.1em] rounded-[3px] shadow-xs ring-1 ring-black/10 shrink-0 ${className}`}>
      <rect width="1" height="2" fill="#F77F00" />
      <rect x="1" width="1" height="2" fill="#FFFFFF" />
      <rect x="2" width="1" height="2" fill="#009E60" />
    </svg>
  );
}

export function I({ e, className = "" }: { e: string; className?: string }) {
  if (!e) return null;
  const key = e.replace(/\uFE0F/g, "");
  if (FLAG.test(key)) return <CIFlag className={className} />;
  const Icon = MAP[key] || MAP[e];
  if (!Icon) return null;

  const hasColor = COLOR_PROP_RX.test(className);
  const colorClass = !hasColor && DEFAULT_COLORS[key] ? DEFAULT_COLORS[key] : "";

  return (
    <Icon
      aria-hidden="true"
      className={`inline-block h-[1.15em] w-[1.15em] align-[-0.18em] shrink-0 transition-transform ${colorClass} ${className}`.trim()}
    />
  );
}

const EMOJI_RX = new RegExp(
  "([\\u{1F1E6}-\\u{1F1FF}]{2}|[\\u{1F000}-\\u{1FAFF}\\u2600-\\u27BF\\u2B00-\\u2BFF\\u2139\\u2190-\\u21FF\\u2300-\\u23FF](?:\\uFE0F|\\u200D[\\u{1F000}-\\u{1FAFF}]\\uFE0F?)*)",
  "u",
);

/** Remplace les emojis d'une chaîne par des icônes vectorielles stylisées. */
export function Rich({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(EMOJI_RX);
  const out: ReactNode[] = parts.map((p, i) => {
    if (i % 2 === 0) return p;
    const key = p.replace(/\uFE0F/g, "");
    return MAP[key] || MAP[p] || FLAG.test(key) ? <I key={i} e={p} /> : p;
  });
  return <>{out}</>;
}

/** Retire les emojis d'une chaîne (pour les attributs : placeholder, aria-label, <option>…). */
export function stripEmoji(text: string) {
  if (!text) return "";
  return text.split(EMOJI_RX).filter((_, i) => i % 2 === 0).join("").replace(/^\s+/, "").replace(/\s{2,}/g, " ");
}
