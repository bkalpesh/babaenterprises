import React from 'react';
import { Target, Truck, Users, Cpu, FileSliders, Handshake, CheckCircle } from 'lucide-react';
import { WHY_CHOOSE_US_ITEMS } from '../../data/initialData';
import { useLanguage } from '../../context/LanguageContext';

export const WhyUsSection: React.FC = () => {
  const icons = [Target, Truck, Users, Cpu, FileSliders, Handshake];
  const { language, t } = useLanguage();

  return (
    <section className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0755A5] uppercase tracking-wider mb-2">
            <span>{t.whyUs.eyebrow}</span>
            <span aria-hidden="true">·</span>
            <span>B2B ADVANTAGE</span>
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#102F59] tracking-tight">
            {t.whyUs.title}
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed text-balance">
            {language === 'mr'
              ? 'आमचे मुख्य उद्दिष्ट हे घटकांची उत्कृष्ट गुणवत्ता, पारदर्शक तांत्रिक सहकार्य आणि ठरलेल्या वेळेत पुरवठा करणे हे आहे.'
              : 'Our operating philosophy centers on dependable component quality, straightforward technical cooperation, and adherence to agreed delivery timelines.'}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WHY_CHOOSE_US_ITEMS.map((item, idx) => {
            const Icon = icons[idx] || CheckCircle;
            const title = language === 'mr' ? item.titleMr || item.title : item.title;
            const description = language === 'mr' ? item.descriptionMr || item.description : item.description;

            return (
              <div
                key={item.number}
                className="group p-6 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-[#0755A5]/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#102F59] group-hover:bg-[#102F59] group-hover:text-white transition-colors shadow-xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-400">
                      {item.number}
                    </span>
                  </div>

                  <h3 className="font-heading text-base font-bold text-slate-900 group-hover:text-[#0755A5] transition-colors">
                    {title}
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200/50 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#168B43]" />
                  <span>{language === 'mr' ? 'प्रमाणित कामगिरी' : 'Verified Operational Focus'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
