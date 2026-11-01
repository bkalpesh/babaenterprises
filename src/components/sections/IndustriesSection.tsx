import React from 'react';
import { Industry } from '../../types';
import { ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface IndustriesSectionProps {
  industries: Industry[];
  onSelectIndustry?: (industry: Industry) => void;
}

export const IndustriesSection: React.FC<IndustriesSectionProps> = ({ industries }) => {
  const { language, t } = useLanguage();

  return (
    <section id="industries" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0755A5] uppercase tracking-wider mb-2">
            <span>{t.industries.eyebrow}</span>
            <span aria-hidden="true">·</span>
            <span>PROVEN INDUSTRIAL RELIABILITY</span>
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#102F59] tracking-tight">
            {t.industries.title}
          </h2>

          <p className="mt-3 text-base text-slate-600 leading-relaxed text-balance">
            {t.industries.subtitle}
          </p>
        </div>

        {/* 6 Industry Cards Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {industries.map((ind, index) => (
            <div
              key={ind.id}
              className="group rounded-xl border border-slate-200 overflow-hidden bg-white hover:border-[#0755A5] hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Image Viewport */}
                <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                  <img
                    src={ind.image}
                    alt={ind.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#102F59]/90 via-[#102F59]/20 to-transparent" />
                  
                  <span className="absolute top-3 left-3 text-[11px] font-mono font-bold text-white/90 bg-[#102F59]/80 px-2 py-0.5 rounded">
                    SECTOR 0{index + 1}
                  </span>
                  
                  <h3 className="absolute bottom-3 left-4 right-4 font-heading text-lg font-bold text-white leading-snug drop-shadow-xs">
                    {ind.title}
                  </h3>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {ind.description}
                  </p>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {language === 'mr' ? 'मुख्य ॲप्लिकेशन्स:' : 'Common Applications:'}
                    </span>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {ind.applications.slice(0, 3).map((app, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#0755A5] font-bold">›</span>
                          <span>{app}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Tag */}
              <div className="px-5 pb-5 pt-0">
                <a
                  href="#enquiry"
                  className="w-full py-2 px-3 text-xs font-semibold text-[#0755A5] bg-blue-50/70 hover:bg-[#0755A5] hover:text-white rounded-md transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>
                    {language === 'mr'
                      ? 'या क्षेत्रासाठी चौकशी करा'
                      : `Enquire for ${ind.title.split(' ')[0]} applications`}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
