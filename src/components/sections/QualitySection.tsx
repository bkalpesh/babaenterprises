import React from 'react';
import { Microscope, Ruler, ShieldCheck, Cpu, SlidersHorizontal, CheckSquare, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface QualitySectionProps {
  onOpenQuoteModal: () => void;
}

export const QualitySection: React.FC<QualitySectionProps> = ({ onOpenQuoteModal }) => {
  const { language, t } = useLanguage();

  const pillars = [
    {
      icon: Ruler,
      title: language === 'mr' ? 'आकारमान परिमाणे (Tolerances)' : 'Dimensional Requirements',
      desc:
        language === 'mr'
          ? 'अचूक फिटमेंटसाठी क्राॉस-सेक्शन्स, जाडी आणि व्यासांची काटेकोर तपासणी.'
          : 'Accurate cross-sections, concentricity, and wall thickness inspection to ensure precision fitment with mating metal housings, shafts, and ports.',
    },
    {
      icon: Microscope,
      title: language === 'mr' ? 'योग्य मटेरियल निवड' : 'Material Selection',
      desc:
        language === 'mr'
          ? 'कार्यरत तापमान, तेल, केमिकल संपर्क आणि वातावरणीय परिस्थितीनुसार सुयोग्य पॉलिमर.'
          : 'Expert polymer compound recommendations based on operating temperature, fluid contact (oils, acids, solvents), and atmospheric ozone exposure.',
    },
    {
      icon: SlidersHorizontal,
      title: language === 'mr' ? 'उत्पादनाची सुसंगतता' : 'Product Suitability',
      desc:
        language === 'mr'
          ? 'डायनॅमिक आणि स्टॅटिक गरजा, कॉम्प्रेशन सेट आणि ताण सहनशक्तीचे मूल्यमापन.'
          : 'Evaluating dynamic vs static duty requirements, mechanical compression set resilience, and tensile elongation demands before supply.',
    },
    {
      icon: Cpu,
      title: language === 'mr' ? 'ॲप्लिकेशननुसार कडकपणा' : 'Application-Specific Components',
      desc:
        language === 'mr'
          ? 'गरजेनुसार ड्युरोमीटर हार्डनेस (४० Shore A ते ९५ Shore A किंवा इंजिनिअरिंग प्लास्टिक).'
          : 'Tailoring durometer hardness (from soft 40 Shore A up to rigid 95 Shore A or structural plastics) to match application duty cycles.',
    },
    {
      icon: CheckSquare,
      title: language === 'mr' ? 'ग्राहकांचे तांत्रिक नकाशे' : 'Customer Specifications',
      desc:
        language === 'mr'
          ? 'ग्राहकांनी दिलेल्या 2D/3D नकाशे आणि इंजिनिअरिंग पॅरामीटर्सचे काटेकोर पालन.'
          : 'Adherence to detailed buyer engineering parameters, 2D tolerance callouts, and performance criteria specified in customer drawings.',
    },
    {
      icon: ShieldCheck,
      title: language === 'mr' ? 'सातत्यपूर्ण पुरवठा' : 'Consistent Supply Requirements',
      desc:
        language === 'mr'
          ? 'अखंड औद्योगिक उत्पादनासाठी प्रत्येक बॅचमध्ये भौतिक गुणधर्मांची एकसमानता.'
          : 'Repeatable compounding and post-cure handling ensuring batch-to-batch physical uniformity for uninterrupted industrial production lines.',
    },
  ];

  const materialMatrix = [
    { polymer: 'Nitrile (NBR)', temp: '-30°C to +110°C', media: language === 'mr' ? 'हायड्रोलिक तेल, इंधन, ग्रीस' : 'Hydraulic Oils, Fuels, Greases', strength: language === 'mr' ? 'तेल प्रतिकार आणि उत्तम ताण' : 'Oil resistance & tensile strength' },
    { polymer: 'EPDM', temp: '-40°C to +140°C', media: language === 'mr' ? 'हवामान, वाफ, पाणी, ब्रेक फ्लुइड' : 'Weather, Steam, Water, Brake Fluid', strength: language === 'mr' ? 'ओझोन व बाहेरच्या हवामानाचा प्रतिकार' : 'Ozone & outdoor UV resistance' },
    { polymer: 'Neoprene (CR)', temp: '-35°C to +110°C', media: language === 'mr' ? 'तेल, हवामान, समुद्राचे पाणी' : 'Moderate Oils, Weather, Sea Water', strength: language === 'mr' ? 'लवचिकता व आग प्रतिरोधक क्षमता' : 'Resilience & flame retardancy' },
    { polymer: 'Silicone (VMQ)', temp: '-60°C to +200°C', media: language === 'mr' ? 'उच्च/कमी तापमान, अन्न प्रक्रिया' : 'Extreme High/Low Temp, Food', strength: language === 'mr' ? 'तापीय स्थिरता व डायइलेक्ट्रिक गुणधर्म' : 'Thermal stability & dielectric properties' },
    { polymer: 'Viton / FKM', temp: '-20°C to +220°C', media: language === 'mr' ? 'तीव्र रसायने, इंधन, ॲसिड' : 'Aggressive Chemicals, Fuels, Acids', strength: language === 'mr' ? 'उत्कृष्ट रासायनिक निष्क्रियता' : 'Superior chemical inertness' },
    { polymer: 'Polyacetal (POM/Delrin)', temp: '-40°C to +100°C', media: language === 'mr' ? 'वंगणयुक्त आणि सुके मेकॅनिक्स' : 'Lubricated and dry mechanics', strength: language === 'mr' ? 'कडकपणा, कमी घर्षण आणि आकारमान स्थिरता' : 'Rigidity, low friction & dimensional stability' },
  ];

  return (
    <section id="quality" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0755A5] uppercase tracking-wider mb-2">
              <span>{t.quality.eyebrow}</span>
              <span aria-hidden="true">·</span>
              <span>TECHNICAL INTEGRITY</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#102F59] tracking-tight text-balance">
              {t.quality.title}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed text-balance">
              {language === 'mr'
                ? 'औद्योगिक घटकांची कामगिरी ही योग्य रबर/प्लास्टिक कम्पाउंड निवडण्यावर आणि अचूक आकारमानावर अवलंबून असते.'
                : 'Industrial component performance relies on selecting the right polymer compound, verifying dimensional tolerances, and matching physical properties to the operational environment.'}
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={onOpenQuoteModal}
              className="px-6 py-3 bg-[#0755A5] hover:bg-[#102F59] text-white font-semibold text-xs sm:text-sm rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>{language === 'mr' ? 'तांत्रिक चर्चा करा' : 'DISCUSS YOUR REQUIREMENT'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 6 Quality Pillars */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="p-6 rounded-xl bg-white border border-slate-200 hover:border-[#0755A5]/60 hover:shadow-md transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0755A5] mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-heading text-base font-bold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Engineering Material Competence Table */}
        <div className="mt-14 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-200 bg-slate-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900 uppercase tracking-wider">
                {language === 'mr' ? 'मटेरियल फॉर्म्युलेशन चार्ट' : 'Material Formulation Matrix'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'mr'
                  ? 'कामाच्या स्वरूपानुसार पुरवले जाणारे मुख्य रबर व प्लास्टिक कम्पाउंड्स'
                  : 'Common elastomer and polymer compounds supplied based on duty cycles'}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">BABA ENTERPRISES Spec Guide</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 sm:px-6">{language === 'mr' ? 'पॉलिमर ग्रेड' : 'Polymer Grade'}</th>
                  <th className="py-3 px-4">{language === 'mr' ? 'कार्यरत तापमान श्रेणी' : 'Working Temp Range'}</th>
                  <th className="py-3 px-4">{language === 'mr' ? 'द्रव व रासायनिक संपर्क' : 'Immersion / Chemical Media'}</th>
                  <th className="py-3 px-4 sm:px-6">{language === 'mr' ? 'मुख्य वैशिष्ट्य / फायदा' : 'Primary Performance Advantage'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {materialMatrix.map((m, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-[#102F59] whitespace-nowrap">
                      {m.polymer}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {m.temp}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs sm:text-sm">
                      {m.media}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600 text-xs sm:text-sm">
                      {m.strength}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
