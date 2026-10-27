import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import VoiceAssistant from "../components/VoiceAssistant";
import ContactChooser from "../components/ContactChooser";
import { Spinner, ErrorBox } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import type { Artisan } from "../lib/api";
import CommuneSelect from "../components/CommuneSelect";

import { I, Rich } from "../components/Icon";
export default function Search() {
  const [sp] = useSearchParams();
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [debounced, setDebounced] = useState(query);
  const [activeCategory, setActiveCategory] = useState(sp.get("categorie") ?? "Tous");
  const [activeCommune, setActiveCommune] = useState(sp.get("commune") ?? "Toutes");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const { data: dbCategories } = useFetch<{ label: string; slug: string; icon: string; count: number }[]>("/categories");
  const categories = ["Tous", ...(dbCategories ?? []).map((c) => c.label.split(" & ")[0].split("/")[0].trim())];

  useEffect(() => { const t = setTimeout(() => setDebounced(query), 300); return () => clearTimeout(t); }, [query]);

  const p = new URLSearchParams();
  if (debounced) p.set("q", debounced);
  if (activeCategory !== "Tous") p.set("categorie", activeCategory);
  if (activeCommune !== "Toutes") p.set("commune", activeCommune);
  if (onlyAvailable) p.set("available", "1");
  const { data, loading, error } = useFetch<{ total: number; items: Artisan[] }>(`/artisans?${p}`);
  const items = data?.items ?? [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h1 className="text-5xl text-[#1D4E5B] mb-2">Rechercher un artisan</h1>
      <p className="text-[#6B7280] mb-8">Des professionnels vérifiés en Côte d'Ivoire.</p>

      <div className="flex gap-3 mb-5 flex-wrap items-center" role="search">
        <div className="flex-1 min-w-64 flex items-center gap-3 border-2 border-[#D1D9DC] rounded-xl px-4 py-2.5 focus-within:border-[#1D4E5B] transition-colors bg-white shadow-xs">
          <span className="w-8 h-8 rounded-lg bg-orange-50 text-[#F26522] flex items-center justify-center shrink-0 text-base" aria-hidden="true">
            <I e="🔍" />
          </span>
          <input type="search" placeholder="Nom, métier..." value={query} onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-base text-[#1A1A1A] focus:outline-none placeholder-[#9CA3AF] bg-transparent" aria-label="Rechercher par nom ou métier" />
          <VoiceAssistant iconOnly label="Recherche vocale" text="Dites le nom d'un artisan ou d'un métier pour lancer la recherche." />
        </div>
        <CommuneSelect
          value={activeCommune === "Toutes" ? "" : activeCommune}
          onChange={(c) => setActiveCommune(c || "Toutes")}
          variant="standard"
          placeholder="Toutes communes..."
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filtres par catégorie">
        {categories.map((c) => (
          <button key={c} onClick={() => setActiveCategory(c)} aria-pressed={activeCategory === c}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeCategory === c ? "bg-[#1D4E5B] text-white shadow-md" : "bg-[#E8F2F5] text-[#1D4E5B] hover:bg-[#1D4E5B] hover:text-white"}`}>{c}</button>
        ))}
        <button onClick={() => setOnlyAvailable(!onlyAvailable)} aria-pressed={onlyAvailable}
          className={`ml-auto px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${onlyAvailable ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-600 hover:text-white"}`}>
          <I e="✓" /> Disponibles uniquement
        </button>
      </div>

      {error && <ErrorBox message={error.message} />}
      <p className="text-sm text-[#6B7280] mb-6" aria-live="polite">
        <strong className="text-[#1D4E5B]">{data?.total ?? 0}</strong> artisan{(data?.total ?? 0) > 1 ? "s" : ""} trouvé{(data?.total ?? 0) > 1 ? "s" : ""}
      </p>

      {loading && !data ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((a) => (
            <article key={a.id} className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-5 hover:border-[#1D4E5B] hover:shadow-lg transition-all flex flex-col gap-4">
              <div className="flex items-start gap-4">
                {a.img ? (
                  <img src={a.img} alt={`Photo de ${a.name}`} className="w-16 h-16 rounded-xl object-cover bg-[#E8F2F5] flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#1D4E5B] to-[#2B6D7F] text-white flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-xs">
                    {a.name.split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "PRO"}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-[#1D4E5B] text-base">{a.name}</p>
                      <p className="text-sm text-[#6B7280]">{a.trade}</p>
                      <p className="text-xs text-[#F26522] font-semibold"><I e="📍" /> {a.commune}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1.5 rounded-full font-bold flex-shrink-0 ${a.available ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{a.available ? <Rich text={"✓ Dispo"} /> : <Rich text={"✗ Occupé"} />}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.tags.map((t) => <span key={t} className="text-xs bg-[#E8F2F5] text-[#1D4E5B] font-medium px-2.5 py-1 rounded-lg">{t}</span>)}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#F26522] font-bold"><I e="★" /> {a.rating}</span>
                <span className="text-[#9CA3AF]">({a.reviews} avis)</span>
                <span className="ml-auto font-bold text-[#1D4E5B] text-base">{a.price}</span>
              </div>
              <div className="flex gap-2 pt-3 border-t border-[#E8F2F5]">
                <Link to={`/artisan/${a.id}`} className="flex-1 text-center py-3 rounded-xl bg-[#E8F2F5] text-[#1D4E5B] font-bold text-sm hover:bg-[#1D4E5B] hover:text-white transition-colors"><I e="👤" /> Voir profil</Link>
                <ContactChooser phone={a.phone} name={a.name} className="flex-1" />
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-[#F4F8F9] border-2 border-dashed border-[#D1D9DC] rounded-3xl p-10 md:p-14 text-center max-w-2xl mx-auto my-8">
          <div className="w-20 h-20 bg-orange-50 text-[#F26522] rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5 shadow-xs">
            <I e="👷" />
          </div>
          <h2 className="text-3xl text-[#1D4E5B] font-bold mb-3">Aucun artisan inscrit dans ce critère pour le moment</h2>
          <p className="text-[#6B7280] text-sm md:text-base leading-relaxed mb-8 max-w-lg mx-auto">
            La plateforme Proximo CI est en plein déploiement. Vous êtes artisan ou prestataire en Côte d'Ivoire ? Soyez le premier de votre corps de métier à vous inscrire et recevez des demandes de clients immédiatement !
          </p>
          <div className="flex flex-col sm:flex-row gap-3.5 justify-center items-center">
            <Link
              to="/connexion?mode=signup"
              className="w-full sm:w-auto px-7 py-4 bg-[#F26522] text-white rounded-xl font-bold text-sm hover:bg-[#C84E10] transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <I e="🚀" /> Devenir artisan partenaire (Gratuit)
            </Link>
            <Link
              to="/poster-offre"
              className="w-full sm:w-auto px-7 py-4 border-2 border-[#1D4E5B] text-[#1D4E5B] rounded-xl font-bold text-sm hover:bg-[#E8F2F5] transition-colors flex items-center justify-center gap-2"
            >
              <I e="📋" /> Poster un besoin de travaux
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
