import React from 'react';
import { MapPin, Phone, MessageSquare, ShieldCheck, ArrowRight } from 'lucide-react';
import { OFFICIAL_BUSINESS_INFO } from '../../data/initialData';
import { useLanguage } from '../../context/LanguageContext';

interface FooterProps {
  onOpenQuoteModal: () => void;
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenQuoteModal, onOpenAdmin }) => {
  const { language, t } = useLanguage();

  return (
    <footer className="bg-[#102F59] text-white pt-16 pb-8 border-t border-slate-800 relative overflow-hidden">
      {/* Restrained Tricolour Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1 flex">
        <div className="h-full w-1/3 bg-[#F28C00]" />
        <div className="h-full w-1/3 bg-[#FFFFFF]" />
        <div className="h-full w-1/3 bg-[#168B43]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          {/* Column 1: Brand & Official Identity */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <div className="inline-block mb-2 max-w-[320px]">
                <img
                  src="/assets/aistudio/Baba_Footer_5627e09a.png"
                  alt="BABA ENTERPRISES - Industrial Rubber & Plastic Components"
                  className="w-full h-auto object-contain block"
                  loading="lazy"
                />
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-md pt-2">
              {t.footer.desc}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="text-blue-300 font-semibold">{t.footer.gstLabel}</span>
              <span className="font-mono bg-white/10 px-2.5 py-1 rounded border border-white/10 text-white tracking-wider">
                {OFFICIAL_BUSINESS_INFO.gstin}
              </span>
              <span className="text-slate-400">{t.footer.stateCode}</span>
            </div>
          </div>

          {/* Column 2: Product Categories */}
          <div>
            <h4 className="font-heading text-sm font-semibold tracking-wider uppercase text-blue-200 mb-4">
              {t.footer.componentsCol}
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <a href="#products" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-[#F28C00]" /> {language === 'mr' ? 'रबर वॉशर्स आणि बुशेस' : 'Rubber Washers & Bushes'}
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-[#F28C00]" /> {language === 'mr' ? 'ओ-रिंग आणि सील्स' : 'O-Rings & Fluid Seals'}
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-[#F28C00]" /> {language === 'mr' ? 'रबर बेलोज आणि बंपर्स' : 'Rubber Bellows & Bumpers'}
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-[#F28C00]" /> {language === 'mr' ? 'एक्सट्रूडेड रबर प्रोफाईल्स' : 'Extruded Rubber Profiles'}
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-[#F28C00]" /> {language === 'mr' ? 'औद्योगिक प्लास्टिक भाग' : 'Industrial Plastic Parts'}
                </a>
              </li>
              <li>
                <a href="#products" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-[#F28C00]" /> {language === 'mr' ? 'कस्टम मोल्डेड भाग' : 'Custom Engineering Moulds'}
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Navigation */}
          <div>
            <h4 className="font-heading text-sm font-semibold tracking-wider uppercase text-blue-200 mb-4">
              {t.footer.companyCol}
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  {t.nav.about}
                </a>
              </li>
              <li>
                <a href="#industries" className="hover:text-white transition-colors">
                  {t.nav.industries}
                </a>
              </li>
              <li>
                <a href="#quality" className="hover:text-white transition-colors">
                  {t.nav.quality}
                </a>
              </li>
              <li>
                <a href="#gallery" className="hover:text-white transition-colors">
                  {t.nav.gallery}
                </a>
              </li>
              <li>
                <a href="#references" className="hover:text-white transition-colors">
                  {language === 'mr' ? 'सन्माननीय ग्राहक' : 'Customer References'}
                </a>
              </li>
              <li>
                <button
                  onClick={onOpenQuoteModal}
                  className="text-[#F28C00] hover:text-white font-medium transition-colors text-left cursor-pointer"
                >
                  {t.nav.requestQuote}
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Official Contact */}
          <div>
            <h4 className="font-heading text-sm font-semibold tracking-wider uppercase text-blue-200 mb-4">
              {t.footer.officeCol}
            </h4>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#F28C00] shrink-0 mt-0.5" />
                <span className="leading-snug">
                  {language === 'mr' ? t.contact.addressVal : `${OFFICIAL_BUSINESS_INFO.addressLine1}, ${OFFICIAL_BUSINESS_INFO.addressLine2}`}
                </span>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex flex-col font-mono text-xs text-white">
                  <a href="tel:9028260011" className="hover:text-blue-300">
                    +91 9028260011
                  </a>
                  <a href="tel:8788266934" className="hover:text-blue-300">
                    +91 8788266934
                  </a>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={`https://wa.me/919028260011?text=${encodeURIComponent(
                    'Hello BABA ENTERPRISES, I would like to inquire about industrial rubber/plastic components.'
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>{t.footer.rights}</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t.footer.gstTag}</span>
            </span>
            <button
              onClick={onOpenAdmin}
              className="text-slate-400 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
            >
              {t.footer.adminLink}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
