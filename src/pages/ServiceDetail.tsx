import { useParams, Link } from "react-router";
import WhatsAppButton from "../components/WhatsAppButton";
import VoiceAssistant from "../components/VoiceAssistant";
import { Spinner, ErrorBox } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import type { ServiceDetail as Detail } from "../lib/api";

import { I } from "../components/Icon";
export default function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useFetch<Detail>(slug ? `/services/${encodeURIComponent(slug)}` : null);

  if (loading) return <Spinner />;
  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <ErrorBox message={error?.status === 404 ? "Ce service n'existe pas." : (error?.message ?? "Erreur de chargement.")} />
        <Link to="/services" className="inline-block mt-6 text-[#F26522] font-bold hover:underline"><I e="←" /> Tous les services</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="relative bg-[#1D4E5B] text-white">
        <img src={data.img} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <nav className="text-sm text-[#8FAFB7] mb-6 flex items-center gap-2 flex-wrap">
            <Link to="/" className="hover:text-white"><I e="🏠" /> Accueil</Link><span>/</span>
            <Link to="/services" className="hover:text-white"><I e="🛠️" /> Services</Link><span>/</span>
            <span className="text-white font-semibold">{data.title}</span>
          </nav>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-5xl mb-3" aria-hidden="true"><I e={data.icon} /></p>
              <h1 className="text-5xl md:text-6xl mb-3">{data.title}</h1>
              <p className="text-[#B0D4DC] text-lg max-w-xl leading-relaxed mb-6">{data.longDesc}</p>
              <div className="flex flex-wrap gap-3">
                <Link to={`/recherche?categorie=${encodeURIComponent(data.title)}`} className="px-6 py-4 bg-[#F26522] text-white rounded-xl font-bold text-base hover:bg-[#C84E10] transition-colors shadow-md"><I e="🔍" /> Rechercher maintenant</Link>
                <VoiceAssistant label="Écouter" text={`${data.title}. ${data.longDesc}`} />
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-5 text-center border border-white/20 flex-shrink-0">
              <p className="text-sm text-[#B0D4DC]">Prix moyen</p>
              <p className="text-3xl font-bold text-[#F26522] mt-1">{data.avgPrice}</p>
              <p className="text-xs text-[#8FAFB7] mt-1">Devis gratuit en 24h</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            {data.tasks.length > 0 && (
              <div className="mb-10">
                <h2 className="text-3xl text-[#1D4E5B] mb-5">Ce qu'ils font</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.tasks.map((t) => (
                    <li key={t} className="flex items-center gap-3 bg-[#F4F8F9] border-2 border-[#E8F2F5] rounded-xl px-5 py-3.5 text-sm font-semibold text-[#1D4E5B]"><span className="text-[#F26522] text-lg"><I e="✓" /></span>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            <h2 className="text-3xl text-[#1D4E5B] mb-5">Prestataires disponibles</h2>
            {data.pros.length === 0 && <p className="text-[#6B7280]">Aucun prestataire inscrit pour le moment. <Link to="/poster-offre" className="text-[#F26522] font-bold hover:underline">Postez une offre</Link> pour être contacté.</p>}
            <div className="flex flex-col gap-4">
              {data.pros.map((p) => (
                <div key={p.id} className="bg-white border-2 border-[#E8F2F5] rounded-2xl p-5 flex items-center gap-5 hover:border-[#1D4E5B] transition-all">
                  <img src={p.img} alt={`Photo de ${p.name}`} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-[#E8F2F5]" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1D4E5B] text-base">{p.name}</p>
                    <p className="text-sm text-[#F26522] font-semibold"><I e="📍" /> {p.commune}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[#F26522] text-sm"><I e="★" /> {p.rating}</span>
                      <span className="text-xs text-[#9CA3AF]">({p.reviews} avis)</span>
                      <span className="ml-auto font-bold text-[#1D4E5B]">{p.price}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Link to={`/artisan/${p.id}`} className="px-4 py-2.5 bg-[#1D4E5B] text-white rounded-xl text-xs font-bold hover:bg-[#163A43] transition-colors whitespace-nowrap text-center"><I e="👤" /> Profil</Link>
                    <WhatsAppButton phone={p.phone} message={`Bonjour ${p.name}, je vous contacte via Proximo CI !`} label="WhatsApp" size="sm" className="justify-center" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="bg-white border-2 border-[#1D4E5B] rounded-2xl p-6 sticky top-24">
              <h3 className="font-bold text-[#1D4E5B] text-lg mb-4">Trouver : {data.title.split("/")[0].trim()}</h3>
              <Link to={`/recherche?categorie=${encodeURIComponent(data.title)}`} className="flex items-center justify-center gap-2 w-full py-4 bg-[#F26522] text-white rounded-xl font-bold text-base hover:bg-[#C84E10] transition-colors shadow-md mb-3"><I e="🔍" /> Lancer la recherche</Link>
              <Link to="/poster-offre" className="flex items-center justify-center gap-2 w-full py-4 border-2 border-[#1D4E5B] text-[#1D4E5B] rounded-xl font-bold text-base hover:bg-[#E8F2F5] transition-colors mb-3"><I e="📋" /> Poster une offre</Link>
              <WhatsAppButton label="Aide par WhatsApp" message={`Bonjour Proximo CI, je cherche : ${data.title.toLowerCase()} !`} size="md" className="w-full justify-center" />
              <hr className="my-5 border-[#E8F2F5]" />
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between"><dt className="text-[#6B7280]">Prestataires actifs</dt><dd className="font-bold text-[#1D4E5B]">{data.pros.length}</dd></div>
                <div className="flex justify-between"><dt className="text-[#6B7280]">Prix moyen</dt><dd className="font-bold text-[#F26522]">{data.avgPrice}</dd></div>
                <div className="flex justify-between"><dt className="text-[#6B7280]">Délai de réponse</dt><dd className="font-bold text-[#1D4E5B]">&lt; 2h</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
