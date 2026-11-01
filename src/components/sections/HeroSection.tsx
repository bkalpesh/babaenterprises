import React, { useRef } from 'react';
import {
  LayoutGrid,
  FileText,
  ChevronRight,
  ChevronLeft,
  Settings,
  ShieldCheck,
  Users,
  Handshake,
  Shield,
  Cog,
  Wrench,
  Factory,
  ArrowRight,
} from 'lucide-react';
import { Product } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface HeroSectionProps {
  onOpenQuoteModal: () => void;
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenQuoteModal,
  products = [],
  onSelectProduct,
}) => {
  const showcaseScrollRef = useRef<HTMLDivElement>(null);
  const { language, t } = useLanguage();

  const scrollShowcase = (direction: 'left' | 'right') => {
    if (showcaseScrollRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      showcaseScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const showcaseItems = [
    {
      id: 'prod-01',
      slug: 'rubber-washers',
      nameEn: 'Rubber Washers',
      nameMr: 'रबर वॉशर्स',
      image: '/assets/aistudio/rubber_washers_cropped.jpg',
    },
    {
      id: 'prod-02',
      slug: 'rubber-bushes',
      nameEn: 'Rubber Bushes',
      nameMr: 'रबर बुशेस',
      image: '/assets/aistudio/rubber_bushes_d4fb5aab.jpg',
    },
    {
      id: 'prod-03',
      slug: 'rubber-grommets',
      nameEn: 'Rubber Grommets',
      nameMr: 'रबर ग्रॉमेट्स',
      image: '/assets/aistudio/rubber_grommets_12a01e59.jpg',
    },
    {
      id: 'prod-04',
      slug: 'o-rings',
      nameEn: 'O-Rings & Sealing Components',
      nameMr: 'ओ-रिंग आणि सीलिंग घटक',
      image: '/assets/aistudio/o_rings_4afab30b.jpg',
    },
    {
      id: 'prod-05',
      slug: 'rubber-bellows',
      nameEn: 'Rubber Bellows',
      nameMr: 'रबर बेलोज',
      image: '/assets/aistudio/rubber_bellows_936d983a.jpg',
    },
    {
      id: 'prod-06',
      slug: 'rubber-bumpers',
      nameEn: 'Rubber Bumpers',
      nameMr: 'रबर बंपर्स',
      image: '/assets/aistudio/rubber_bumpers_d296620e.jpg',
    },
    {
      id: 'prod-07',
      slug: 'rubber-t-nuts',
      nameEn: 'Rubber T-Nuts',
      nameMr: 'रबर टी-नट्स',
      image: '/assets/aistudio/rubber_t_nuts_146cf192.jpg',
    },
    {
      id: 'prod-08',
      slug: 'rubber-profiles',
      nameEn: 'Rubber Profiles & Shapes',
      nameMr: 'रबर प्रोफाईल्स आणि शेप्स',
      image: '/assets/aistudio/rubber_profiles_09b545eb.jpg',
    },
    {
      id: 'prod-09',
      slug: 'plastic-components',
      nameEn: 'Plastic Components',
      nameMr: 'प्लास्टिक इंजिनिअरिंग घटक',
      image: '/assets/aistudio/plastic_components_8af871df.jpg',
    },
    {
      id: 'prod-10',
      slug: 'customised-components',
      nameEn: 'Customised Components',
      nameMr: 'कस्टम निर्मिती घटक',
      image: '/assets/aistudio/customised_components_5a5026d5.jpg',
    },
  ];

  const handleProductCardClick = (slug: string) => {
    if (onSelectProduct && products.length > 0) {
      const match = products.find((p) => p.slug === slug || p.id === slug);
      if (match) {
        onSelectProduct(match);
        return;
      }
    }
    const elem = document.getElementById('products');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative pt-[72px] sm:pt-[82px] lg:pt-[94px] bg-[#0c2340] overflow-hidden">
      {/* Main Cinematic Hero */}
      <section className="relative min-h-[580px] lg:min-h-[660px] flex flex-col justify-between overflow-hidden text-white bg-gradient-to-r from-[#0c2340] via-[#0e2a4d] to-[#07192f]">
        {/* Background Visual Composition */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
          <div className="absolute inset-y-0 right-0 w-full lg:w-[62%] h-full overflow-hidden">
            <img
              src="/assets/aistudio/hero_photo_clean_right.jpg"
              alt="Precision Industrial Rubber & Plastic Components in Factory Environment"
              className="w-full h-full object-cover object-right md:object-center brightness-105 contrast-105"
            />
            <div className="absolute inset-0 bg-blue-950/15 mix-blend-multiply" />
          </div>

          <div
            className="hidden lg:block absolute inset-y-0 left-0 w-[55%] z-10 bg-[#0c2340]"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 84% 100%, 0 100%)',
            }}
          />
          <div
            className="hidden lg:block absolute inset-y-0 left-0 w-[55.2%] z-10 pointer-events-none"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 84% 100%, 0 100%)',
              borderRight: '2.5px solid #F28C00',
            }}
          />

          <div className="lg:hidden absolute inset-0 bg-gradient-to-b from-[#0c2340]/95 via-[#0c2340]/85 to-[#08172c]/95 z-10" />
        </div>

        {/* Hero Foreground Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-8 sm:pt-12 pb-6 flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-5 sm:space-y-6">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2">
                  <span className="w-7 h-1 bg-[#F28C00] rounded-full inline-block" />
                  <span className="font-heading font-extrabold text-[#F28C00] tracking-widest text-xs sm:text-sm uppercase">
                    BABA ENTERPRISES
                  </span>
                </div>
                <div className="text-white text-xs sm:text-sm font-semibold tracking-wider uppercase block opacity-95">
                  {t.hero.tagline}
                </div>
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl lg:text-[42px] xl:text-[50px] 2xl:text-[56px] font-black tracking-tight leading-[1.08] text-white text-balance drop-shadow-md">
                {t.hero.heading1}<br />
                <span className="text-[#9bc5fc]">
                  {t.hero.heading2}
                </span>
              </h1>

              <p className="text-sm sm:text-base lg:text-lg text-slate-200 font-normal leading-relaxed max-w-xl text-balance drop-shadow-sm">
                {t.hero.subheading}
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 max-w-md sm:max-w-none">
                <a
                  href="#products"
                  className="px-6 py-3.5 bg-[#1d63d8] hover:bg-[#1551b8] active:bg-[#10439c] text-white font-bold rounded-lg shadow-lg shadow-blue-900/40 transition-all duration-200 flex items-center justify-center gap-2.5 text-xs sm:text-sm uppercase tracking-wider group cursor-pointer"
                >
                  <LayoutGrid className="w-4 h-4 text-white" />
                  <span>{t.hero.exploreProducts}</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>

                <button
                  onClick={onOpenQuoteModal}
                  className="px-6 py-3.5 bg-[#0c2444]/90 hover:bg-[#0c2444] active:bg-[#081a33] text-white font-bold rounded-lg border border-white/20 transition-all duration-200 flex items-center justify-center gap-2.5 text-xs sm:text-sm uppercase tracking-wider backdrop-blur-xs shadow-md cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-white" />
                  <span>{t.hero.requestQuotation}</span>
                  <ChevronRight className="w-4 h-4 text-white/70" />
                </button>
              </div>
            </div>

            {/* Right Floating Badge */}
            <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 justify-end">
              <div className="rounded-xl bg-[#0c2444]/80 border border-white/20 p-5 shadow-2xl backdrop-blur-md max-w-xs text-left animate-in fade-in duration-500">
                <div className="w-6 h-1 bg-[#F28C00] rounded-full mb-3" />
                <h3 className="font-heading text-sm font-extrabold text-white tracking-wide uppercase leading-snug">
                  {t.hero.precisionCardTitle}
                </h3>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="h-1 w-8 bg-[#F28C00] rounded-full" />
                  <div className="h-1 w-8 bg-[#168B43] rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Capability Strip */}
          <div className="mt-10 pt-6 border-t border-white/15">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-left">
              <div className="flex items-start gap-3 group">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-blue-400/40 bg-blue-500/10 flex items-center justify-center text-blue-300 shrink-0 transition-transform group-hover:scale-105">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                    {t.hero.focusLabel}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-snug">
                    {t.hero.focusDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 group lg:border-l lg:border-white/10 lg:pl-6">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-blue-400/40 bg-blue-500/10 flex items-center justify-center text-blue-300 shrink-0 transition-transform group-hover:scale-105">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                    {t.hero.supplyLabel}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-snug">
                    {t.hero.supplyDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 group lg:border-l lg:border-white/10 lg:pl-6">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-blue-400/40 bg-blue-500/10 flex items-center justify-center text-blue-300 shrink-0 transition-transform group-hover:scale-105">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                    {t.hero.appLabel}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-snug">
                    {t.hero.appDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 group lg:border-l lg:border-white/10 lg:pl-6">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-blue-400/40 bg-blue-500/10 flex items-center justify-center text-blue-300 shrink-0 transition-transform group-hover:scale-105">
                  <Handshake className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                    {t.hero.customerLabel}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-snug">
                    {t.hero.customerDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industrial Highlights Blue Bar */}
      <section className="bg-[#0a2347] border-y border-blue-900/50 py-3.5 sm:py-4 px-4 sm:px-6 lg:px-8 text-white relative z-20">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 leading-snug">
              {t.hero.bar1}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 shrink-0">
              <Cog className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 leading-snug">
              {t.hero.bar2}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 leading-snug">
              {t.hero.bar3}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 shrink-0">
              <Factory className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 leading-snug">
              {t.hero.bar4}
            </span>
          </div>
        </div>
      </section>

      {/* Industrial Product Showcase Carousel */}
      <section id="showcase" className="bg-[#F8FAFC] py-8 sm:py-10 border-b border-slate-200 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-5">
            <div className="inline-flex items-center gap-2">
              <span className="w-6 h-1 bg-[#F28C00] rounded-full inline-block" />
              <h2 className="font-heading text-sm sm:text-base font-extrabold text-[#0c2444] tracking-wider uppercase">
                {language === 'mr' ? 'आमचे घटक' : 'OUR INDUSTRIAL COMPONENTS'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => scrollShowcase('left')}
                  className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-xs cursor-pointer"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollShowcase('right')}
                  className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-xs cursor-pointer"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <a
                href="#products"
                className="text-xs sm:text-sm font-bold text-[#1d63d8] hover:text-[#1551b8] inline-flex items-center gap-1 transition-colors group"
              >
                <span>{language === 'mr' ? 'सर्व पाहा' : 'View All'}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>

          <div
            ref={showcaseScrollRef}
            className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-2 pt-1"
          >
            {showcaseItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleProductCardClick(item.slug)}
                className="shrink-0 w-36 sm:w-44 md:w-48 bg-white border border-slate-200 hover:border-[#1d63d8] rounded-xl p-3 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer group snap-start"
              >
                <div className="w-full aspect-square rounded-lg bg-slate-50 flex items-center justify-center p-2 overflow-hidden mb-2.5">
                  <img
                    src={item.image}
                    alt={language === 'mr' ? item.nameMr : item.nameEn}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>

                <h3 className="font-heading text-xs sm:text-sm font-bold text-[#0c2444] group-hover:text-[#1d63d8] text-center leading-snug line-clamp-2 transition-colors">
                  {language === 'mr' ? item.nameMr : item.nameEn}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
