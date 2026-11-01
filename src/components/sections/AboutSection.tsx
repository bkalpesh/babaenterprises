import React from 'react';
import { Target, Layers, Wrench, Users, CheckCircle2, MapPin } from 'lucide-react';
import { OFFICIAL_BUSINESS_INFO } from '../../data/initialData';
import { useLanguage } from '../../context/LanguageContext';

export const AboutSection: React.FC = () => {
  const { language, t } = useLanguage();

  const highlights = [
    {
      icon: Target,
      title: language === 'mr' ? 'औद्योगिक घटक फोकस' : 'Industrial Product Focus',
      description:
        language === 'mr'
          ? 'रबर फॉर्म्युलेशन्स, औद्योगिक मोल्डिंग्स आणि कस्टम मेकॅनिकल पॉलिमर घटकांच्या निर्मितीत विशेष तज्ज्ञता.'
          : 'Dedicated specialization in engineering rubber formulations, industrial mouldings, and custom mechanical polymer components.',
    },
    {
      icon: Layers,
      title: language === 'mr' ? 'रबर आणि प्लास्टिक घटक' : 'Rubber & Plastic Components',
      description:
        language === 'mr'
          ? 'वॉशर्स, बुशेस, सील्स, बेलोज आणि अचूक मशीन केलेल्या इंजिनिअरिंग प्लास्टिक घटकांची मोठी क्षमता.'
          : 'Comprehensive supply capability encompassing elastomeric washers, bushes, seals, bellows, and precision machined engineering plastics.',
    },
    {
      icon: Wrench,
      title: language === 'mr' ? 'इंजिनिअरिंग ॲप्लिकेशन्स' : 'Engineering Applications',
      description:
        language === 'mr'
          ? 'इलेक्ट्रिकल उपकरणे, संरक्षण यंत्रणा, ऑटोमेशन आणि यांत्रिक जोडणीसाठी योग्य घटक.'
          : 'Component suitability configured for heavy electrical equipment, defence systems, manufacturing automation, and mechanical assemblies.',
    },
    {
      icon: Users,
      title: language === 'mr' ? 'ग्राहक-केंद्रित सेवा' : 'Customer-Oriented Supply',
      description:
        language === 'mr'
          ? 'तत्पर संवाद, तांत्रिक नकाशे तपासणी आणि वेळेवर पुरवठ्याद्वारे दीर्घकालीन नातेसंबंध.'
          : 'Committed to long-term industrial relationships through responsive communication, drawing evaluation, and dependable delivery schedules.',
    },
  ];

  return (
    <section id="about" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0755A5] uppercase tracking-wider mb-2">
            <span>{t.about.eyebrow}</span>
            <span aria-hidden="true">·</span>
            <span>BHOSARI, PUNE</span>
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#102F59] tracking-tight text-balance leading-tight">
            {t.about.title}
          </h2>

          <p className="mt-5 text-base sm:text-lg text-slate-700 leading-relaxed text-balance">
            {t.about.p1}
          </p>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed text-balance">
            {t.about.p2}
          </p>
        </div>

        {/* Four Highlights Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {highlights.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group p-6 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-[#0755A5]/40 hover:bg-white hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#102F59] group-hover:bg-[#102F59] group-hover:text-white transition-colors shadow-xs">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-mono text-xs text-slate-400 font-semibold">0{idx + 1}</span>
                  </div>

                  <h3 className="font-heading text-base font-bold text-slate-900 group-hover:text-[#0755A5] transition-colors">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200/60 flex items-center gap-1 text-xs font-medium text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{language === 'mr' ? 'गुणवत्ता मानकीकृत' : 'Quality Standardised'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Operational Context Strip */}
        <div className="mt-12 p-6 rounded-xl bg-gradient-to-r from-slate-100 via-blue-50/50 to-slate-100 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#102F59] text-white rounded-lg shrink-0">
              <MapPin className="w-5 h-5 text-[#F28C00]" />
            </div>
            <div>
              <h4 className="font-heading text-sm font-bold text-slate-900">
                {language === 'mr'
                  ? 'पुणे औद्योगिक कॉरिडॉर (एमआयडीसी भोसरी, पुणे)'
                  : 'Strategic Pune Industrial Corridor (MIDC Bhosari)'}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {language === 'mr'
                  ? 'पिंपरी-चिंचवड, चाकण, तळेगाव आणि संपूर्ण भारतातील प्रमुख ऑटोमोटिव्ह, इलेक्ट्रिकल व हेवी इंजिनिअरिंग हबला जलद पुरवठ्यासाठी भोसरी येथे सोयीचे ठिकाण.'
                  : 'Conveniently situated in Bhosari to support major automotive, electrical, and heavy engineering hubs in Pimpri-Chinchwad, Chakan, Talegaon, and across India.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <span className="text-xs font-mono font-medium text-slate-500">GSTIN: {OFFICIAL_BUSINESS_INFO.gstin}</span>
            <a
              href="#contact"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0755A5] hover:bg-[#102F59] rounded-lg transition-colors whitespace-nowrap"
            >
              {language === 'mr' ? 'संपर्क साधा' : 'Contact Facility'}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
