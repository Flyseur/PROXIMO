import WhatsAppIcon from "./WhatsAppIcon";

interface Props {
  phone?: string;
  message?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function WhatsAppButton({
  phone = "2250747002255",
  message = "Bonjour, je vous contacte via Proximo CI !",
  label = "Contacter sur WhatsApp",
  size = "md",
  className = "",
}: Props) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  const sizeClasses = { sm: "px-4 py-2.5 text-sm gap-2", md: "px-5 py-3.5 text-base gap-2.5", lg: "px-7 py-4 text-lg gap-3" };
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={label}
      className={`inline-flex items-center justify-center rounded-full font-semibold bg-[#25D366] text-white hover:bg-[#1EB85A] active:bg-[#17943F] transition-colors shadow-md ${sizeClasses[size]} ${className}`}>
      <WhatsAppIcon className={size === "lg" ? "w-6 h-6" : "w-5 h-5"} />
      {label}
    </a>
  );
}
