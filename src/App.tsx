import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import { useEffect } from "react";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import ArtisanProfile from "./pages/ArtisanProfile";
import PostJob from "./pages/PostJob";
import JobPost from "./pages/JobPost";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import TwoFA from "./pages/TwoFA";
import Account from "./pages/Account";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import Contact from "./pages/Contact";
import Legal from "./pages/Legal";
import { Link } from "react-router";

import { I } from "./components/Icon";
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-6 py-32 text-center">
      <p className="text-8xl mb-6" aria-hidden="true">404</p>
      <h1 className="text-4xl text-[#1D4E5B] mb-3">Page introuvable</h1>
      <p className="text-[#6B7280] mb-8">La page que vous cherchez n'existe pas ou a été déplacée.</p>
      <Link to="/" className="px-6 py-4 bg-[#F26522] text-white rounded-xl text-base font-bold hover:bg-[#C84E10] transition-colors"><I e="🏠" /> Retour à l'accueil</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/recherche" element={<Search />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:slug" element={<ServiceDetail />} />
          <Route path="/artisan/:id" element={<ArtisanProfile />} />
          <Route path="/poster-offre" element={<PostJob />} />
          <Route path="/publier-offre" element={<JobPost />} />
          <Route path="/tarifs" element={<Pricing />} />
          <Route path="/tableau-de-bord" element={<Account />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/mentions-legales" element={<Legal />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/connexion" element={<Login />} />
        <Route path="/2fa" element={<TwoFA />} />
        <Route path="/backoffice-login" element={<AdminLogin />} />
        <Route path="/backoffice-secret" element={<Dashboard />} />
        <Route path="/admin" element={<Navigate to="/backoffice-login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
