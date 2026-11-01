import React, { useState } from 'react';
import { CustomerReference } from '../../types';
import { Building2, Info } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface CustomerReferencesSectionProps {
  references: CustomerReference[];
}

interface CardProps {
  refData: CustomerReference;
  className?: string;
}

const CustomerReferenceCard: React.FC<CardProps> = ({ refData, className = '' }) => {
  const [logoError, setLogoError] = useState(false);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-[#0c1e38]/90 border border-blue-500/25 hover:border-blue-400/50 transition-all duration-300 shadow-xl flex flex-col justify-between p-6 sm:p-7 min-h-[280px] sm:min-h-[300px] backdrop-blur-md ${className}`}
    >
      {/* Layer 2 – Customer Logo Watermark */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5 pointer-events-none select-none overflow-hidden z-[1]">
        {!logoError && refData.logo ? (
          <img
            src={refData.logo}
            alt=""
            aria-hidden="true"
            className="w-[86%] h-[86%] max-w-[290px] max-h-[220px] object-contain object-center opacity-45 md:opacity-[0.48] lg:opacity-50 transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="font-mono font-black text-6xl sm:text-7xl text-white/20 tracking-widest uppercase select-none opacity-45 md:opacity-[0.48] lg:opacity-50"
          >
            {refData.shortName}
          </span>
        )}
      </div>

      {/* Layer 3 – Subtle Localized Text Protection */}
      <div
        className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0c1e38]/70 via-[#0c1e38]/25 to-transparent pointer-events-none z-[1]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0c1e38]/80 via-[#0c1e38]/30 to-transparent pointer-events-none z-[1]"
        aria-hidden="true"
      />

      {/* Layer 4 – Foreground Content */}
      <div className="relative z-[2] flex flex-col justify-between h-full">
        <div>
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-blue-400/40 bg-[#081528]/85 text-xs font-mono font-bold tracking-wider text-blue-300 w-fit shadow-md backdrop-blur-xs">
            {refData.shortName}
          </div>

          <h3 className="font-heading text-lg sm:text-xl font-bold text-white tracking-tight leading-snug mt-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            {refData.name}
          </h3>

          <p className="mt-1.5 text-xs sm:text-sm text-blue-100 font-medium leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {refData.category}
          </p>
        </div>

        <div>
          <div className="border-t border-white/20 my-4 sm:my-5" />

          <div>
            <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-blue-300 font-semibold block mb-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              SECTOR
            </span>
            <span className="text-xs sm:text-sm text-white font-semibold block leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              {refData.sector}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CustomerReferencesSection: React.FC<CustomerReferencesSectionProps> = ({ references }) => {
  const activeReferences = references.filter((r) => r.isActive);
  const { language, t } = useLanguage();

  const card1 = activeReferences[0];
  const card2 = activeReferences[1];
  const card3 = activeReferences[2];
  const card4 = activeReferences[3];
  const card5 = activeReferences[4];

  return (
    <section id="references" className="py-20 bg-slate-900 text-white border-b border-slate-800 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#F28C00] uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>{t.references.eyebrow}</span>
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            {t.references.title}
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed text-balance">
            {t.references.subtitle}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 items-stretch">
          {card1 && (
            <div className="w-full md:col-span-1 lg:col-span-2">
              <CustomerReferenceCard refData={card1} className="h-full" />
            </div>
          )}

          {card2 && (
            <div className="w-full md:col-span-1 lg:col-span-2">
              <CustomerReferenceCard refData={card2} className="h-full" />
            </div>
          )}

          {card3 && (
            <div className="w-full md:col-span-1 lg:col-span-2">
              <CustomerReferenceCard refData={card3} className="h-full" />
            </div>
          )}

          {card4 && (
            <div className="w-full md:col-span-1 lg:col-start-2 lg:col-span-2">
              <CustomerReferenceCard refData={card4} className="h-full" />
            </div>
          )}

          {card5 && (
            <div className="w-full md:col-span-2 md:max-w-md md:mx-auto lg:max-w-none lg:mx-0 lg:col-span-2">
              <CustomerReferenceCard refData={card5} className="h-full" />
            </div>
          )}

          {activeReferences.slice(5).map((ref) => (
            <div key={ref.id} className="w-full md:col-span-1 lg:col-span-2">
              <CustomerReferenceCard refData={ref} className="h-full" />
            </div>
          ))}
        </div>

        <div className="mt-12 p-4 rounded-xl bg-[#0c1e38]/60 border border-slate-700/60 max-w-3xl mx-auto flex items-start gap-3 text-xs text-slate-400 backdrop-blur-sm">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {language === 'mr'
              ? 'प्रदर्शित केलेले सर्व ग्राहक आणि संस्थांचे लोगो हे त्यांच्या संबंधित घटकांचे ट्रेडमार्क आहेत. येथे दिलेली यादी घटकांच्या पुरवठ्याशी संबंधित आहे आणि अधिकृत भागीदाराचा दावा करत नाही.'
              : 'All customer and organization logos displayed are trademarks and property of their respective entities. Reference listing indicates component supply and engineering requirements engagement and does not imply official endorsement, certification, or formal agency partnership.'}
          </p>
        </div>
      </div>
    </section>
  );
};
