import { FaWhatsapp } from "react-icons/fa6";

// Logo officiel WhatsApp (Font Awesome Brands)
export default function WhatsAppIcon({ className = "w-5 h-5 flex-shrink-0" }: { className?: string }) {
  return <FaWhatsapp className={className} aria-hidden="true" />;
}
