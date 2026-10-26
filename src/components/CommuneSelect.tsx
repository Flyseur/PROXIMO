import { useState, useRef, useEffect } from "react";
import { RiArrowDownSLine, RiCheckLine, RiSearchLine, RiCloseLine } from "react-icons/ri";
import { I } from "./Icon";
import { COMMUNES } from "../lib/api";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
  variant?: "hero" | "standard" | "form";
  hasError?: boolean;
  showAllOption?: boolean;
}

export default function CommuneSelect({
  value,
  onChange,
  placeholder = "Toutes communes...",
  allLabel = "Toutes les communes (CI)",
  className = "",
  variant = "hero",
  hasError = false,
  showAllOption = variant !== "form",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const filtered = COMMUNES.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase().trim())
  );

  function select(commune: string) {
    onChange(commune);
    setOpen(false);
    setSearch("");
  }

  const isHero = variant === "hero";
  const isForm = variant === "form";

  return (
    <div ref={containerRef} className={`relative ${isForm ? "w-full" : ""} ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`group flex items-center justify-between gap-2.5 transition-all cursor-pointer focus:outline-none select-none ${
          isHero
            ? "px-3 py-2 rounded-xl text-sm font-semibold text-[#1D4E5B] hover:bg-[#F4F8F9] min-w-[160px]"
            : isForm
            ? `w-full px-4 py-3.5 rounded-xl border-2 ${
                hasError
                  ? "border-red-400 bg-red-50/20"
                  : open
                  ? "border-[#1D4E5B] ring-2 ring-[#1D4E5B]/10"
                  : "border-[#D1D9DC] hover:border-[#1D4E5B]"
              } text-base font-semibold text-[#1D4E5B] bg-white shadow-xs`
            : "px-4 py-3 rounded-xl border-2 border-[#D1D9DC] hover:border-[#1D4E5B] text-sm font-semibold text-[#1D4E5B] bg-white min-w-[180px] shadow-xs"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[#F26522] text-base shrink-0 group-hover:scale-110 transition-transform">
            <I e="📍" />
          </span>
          <span className={`truncate ${isForm ? "text-base" : "text-sm"} font-semibold ${value ? "text-[#1D4E5B]" : "text-[#9CA3AF] font-normal"}`}>
            {value || placeholder}
          </span>
        </div>
        <RiArrowDownSLine
          className={`w-4 h-4 text-[#8FAFB7] transition-transform duration-200 shrink-0 ${
            open ? "rotate-180 text-[#F26522]" : "group-hover:text-[#1D4E5B]"
          }`}
        />
      </button>

      {/* Custom Dropdown Popover */}
      {open && (
        <div
          role="listbox"
          className={`absolute top-full mt-2.5 ${
            isForm ? "left-0 right-0 w-full" : "right-0 w-[330px] sm:w-[400px]"
          } bg-white rounded-2xl shadow-2xl border-2 border-[#E8F2F5] p-3 z-[100] ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md`}
        >
          {/* Header */}
          <div className="px-2 pt-1 pb-2.5 border-b border-[#E8F2F5] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1D4E5B] flex items-center gap-1.5">
              <I e="🇨🇮" /> Communes d'Abidjan
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-[#F26522] border border-orange-200/50">
              10 zones
            </span>
          </div>

          {/* Search/filter within communes */}
          <div className="py-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F4F8F9] rounded-xl border border-[#E8F2F5] text-xs">
              <RiSearchLine className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filtrer une commune (ex: Cocody, Plateau)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent focus:outline-none text-[#1A1A1A] placeholder-[#9CA3AF] text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-[#9CA3AF] hover:text-[#1A1A1A] p-0.5"
                >
                  <RiCloseLine className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* All Communes button */}
          {showAllOption && !search && (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => select("")}
              className={`w-full mb-2 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                !value
                  ? "bg-[#1D4E5B] text-white shadow-xs"
                  : "bg-[#F4F8F9] text-[#1D4E5B] hover:bg-[#E8F2F5]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🌐</span>
                <span>{allLabel}</span>
              </div>
              {!value && <RiCheckLine className="w-4 h-4 text-emerald-400 font-bold" />}
            </button>
          )}

          {/* 2-Column Grid of all 10 Communes: perfectly visible at once, zero scrolling, never cut off! */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {filtered.map((c) => {
              const isSelected = value === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => select(c)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left group ${
                    isSelected
                      ? "bg-orange-50 text-[#F26522] font-bold border border-orange-200"
                      : "bg-[#F4F8F9]/60 hover:bg-[#E8F2F5] text-[#3D3D3D] hover:text-[#1D4E5B] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-sm shrink-0 transition-transform group-hover:scale-110 ${
                        isSelected ? "text-[#F26522]" : "text-[#8FAFB7] group-hover:text-[#F26522]"
                      }`}
                    >
                      <I e="📍" />
                    </span>
                    <span className="truncate text-xs font-semibold">{c}</span>
                  </div>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-orange-100 text-[#F26522] flex items-center justify-center shrink-0">
                      <RiCheckLine className="w-3 h-3 font-bold" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="py-6 text-center text-xs text-[#9CA3AF]">
              Aucune commune trouvée pour « {search} »
            </div>
          )}
        </div>
      )}
    </div>
  );
}
