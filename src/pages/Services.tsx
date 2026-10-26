import { Link } from "react-router";
import { Spinner, ErrorBox } from "../components/ui";
import { useFetch } from "../lib/useFetch";
import type { ServiceSection, SpecialPage } from "../lib/api";

import { I, Rich } from "../components/Icon";
export default function Services() {
  const { data, loading, error } = useFetch<{ sections: ServiceSection[]; special: SpecialPage[] }>("/services");

  return (
    <div>
      <div className="relative bg-[#1D4E5B] text-white overflow-hidden"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&h=500&fit=crop&auto=format')", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-[#1D4E5B]/80" />
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <nav className="text-sm text-[#8FAFB7] mb-6 flex items-center gap-2" aria-label="Fil d'Ariane">
            <Link to="/" className="hover:text-white transition-colors"><I e="🏠" /> Accueil</Link><span>/</span><span className="text-white font-semibold"><I e="🛠️" /> Services</span>
          </nav>
          <h1 className="text-6xl mb-4">Catalogue de services</h1>
          <p className="text-[#B0D4DC] text-lg max-w-2xl leading-relaxed">Bâtiment, automobile, beauté, services à la personne et événementiel — tous les prestataires de Côte d'Ivoire, tarifs en FCFA.</p>
        </div>
      </div>

      {loading && <Spinner />}
      {error && <div className="max-w-7xl mx-auto px-6 py-10"><ErrorBox message={error.message} /></div>}

      {data && (
        <>
          <div className="bg-white border-b-2 border-[#E8F2F5] sticky top-[60px] z-30">
            <div className="max-w-7xl mx-auto px-6 py-3 flex gap-3 overflow-x-auto" aria-label="Sections">
              {data.sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap px-4 py-2 rounded-full bg-[#E8F2F5] text-[#1D4E5B] text-sm font-semibold hover:bg-[#1D4E5B] hover:text-white transition-all flex-shrink-0"><Rich text={s.title} /></a>
              ))}
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 py-10">
            <p className="text-xs font-black uppercase tracking-widest text-[#F26522] mb-4"><I e="⭐" /> Pages dédiées</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-12">
              {data.special.map((s) => (
                <Link key={s.slug} to={`/services/${s.slug}`} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 ${s.color} hover:scale-105 transition-transform text-center`}>
                  <span className="text-4xl"><I e={s.icon} /></span>
                  <span className="font-bold text-sm">{s.label}</span>
                  <span className="text-xs opacity-70">{s.desc}</span>
                </Link>
              ))}
            </div>

            {data.sections.map((section) => (
              <section key={section.id} id={section.id} className="mb-16 scroll-mt-28">
                <div className="mb-6">
                  <h2 className="text-4xl text-[#1D4E5B]"><Rich text={section.title} /></h2>
                  <p className="text-[#6B7280] text-sm mt-1">{section.desc}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {section.services.map((s) => (
                    <Link key={s.slug} to={`/recherche?categorie=${encodeURIComponent(s.label)}`} className="group bg-white border-2 border-[#E8F2F5] rounded-2xl overflow-hidden hover:border-[#F26522] hover:shadow-lg transition-all">
                      <div className="relative h-32 bg-[#E8F2F5]">
                        <img src={s.img} alt={s.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1D4E5B]/50 to-transparent" />
                        <span className="absolute bottom-2 left-2 text-2xl"><I e={s.icon} /></span>
                        <span className="absolute top-2 right-2 text-[10px] bg-[#F26522] text-white font-bold px-2 py-0.5 rounded-full">{s.count}</span>
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-[#1D4E5B] text-xs group-hover:text-[#F26522] transition-colors leading-tight">{s.label}</p>
                        <p className="text-[10px] text-[#F26522] font-semibold mt-1">{s.avg}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            <div className="bg-[#F26522] rounded-2xl p-10 flex flex-col md:flex-row items-center justify-between gap-6 text-white">
              <div>
                <h2 className="text-3xl mb-2">Vous avez un projet ?</h2>
                <p className="text-white/80">Postez votre offre gratuitement et recevez des devis sous 24h.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <Link to="/poster-offre" className="px-8 py-4 bg-white text-[#F26522] rounded-xl font-bold text-base hover:bg-[#F4F8F9] transition-colors shadow-md"><I e="📋" /> Poster une offre</Link>
                <Link to="/publier-offre" className="px-8 py-4 border-2 border-white text-white rounded-xl font-bold text-base hover:bg-white/10 transition-colors"><I e="📢" /> Offre d'emploi</Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
