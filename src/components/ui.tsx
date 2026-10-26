import type { ReactNode } from "react";

import { I } from "./Icon";
export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-[#6B7280]" role="status">
      <span className="inline-block w-6 h-6 border-2 border-[#E8F2F5] border-t-[#F26522] rounded-full animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600" role="alert"><I e="⚠️" /> {message}</div>
  );
}

export function Field({ label, id, required, error, children }: { label: string; id: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-[#1D4E5B] mb-2">
        {label} {required && <span className="text-[#F26522]">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

export const inputClass = "w-full border-2 border-[#D1D9DC] rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-[#1D4E5B] transition-colors";
export const selectClass = `${inputClass} bg-white text-[#1D4E5B] font-semibold`;
