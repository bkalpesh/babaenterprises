import React, { useState } from 'react';
import { MapPin, Phone, MessageSquare, Clock, CheckCircle2, Send } from 'lucide-react';
import { OFFICIAL_BUSINESS_INFO } from '../../data/initialData';
import { StorageService } from '../../services/storageService';
import { useLanguage } from '../../context/LanguageContext';

export const ContactSection: React.FC = () => {
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickMessage, setQuickMessage] = useState('');
  const [quickSubmitted, setQuickSubmitted] = useState(false);
  const { language, t } = useLanguage();

  const handleQuickContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim() || !quickPhone.trim()) return;

    StorageService.createEnquiry({
      companyName: 'Direct Contact Form',
      contactPerson: quickName.trim(),
      email: 'not-provided@direct.contact',
      mobile: quickPhone.trim(),
      productCategory: 'General Inquiry',
      quantityRequired: 'Direct Consultation',
      technicalRequirements: '',
      message: quickMessage.trim() || 'Callback requested via quick contact form.',
    });

    setQuickSubmitted(true);
    setQuickName('');
    setQuickPhone('');
    setQuickMessage('');
  };

  return (
    <section id="contact" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0755A5] uppercase tracking-wider mb-2">
            <span>{t.contact.eyebrow}</span>
            <span aria-hidden="true">·</span>
            <span>DIRECT CONNECT</span>
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#102F59] tracking-tight">
            {t.contact.title}
          </h2>

          <p className="mt-3 text-base text-slate-600 leading-relaxed text-balance">
            {language === 'mr'
              ? 'तांत्रिक मूल्यमापन, दर करार, नकाशा तपासणी आणि पुरवठा समन्वयासाठी थेट बाबा एंटरप्रायझेसशी संपर्क साधा.'
              : 'Connect directly with BABA ENTERPRISES for component technical assessments, rate contracts, drawing evaluations, and dispatch coordination.'}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-6">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  {language === 'mr' ? 'अधिकृत व्यवसायाचे नाव' : 'Official Business Name'}
                </span>
                <h3 className="font-heading text-xl font-extrabold text-[#102F59] mt-0.5">
                  {OFFICIAL_BUSINESS_INFO.companyName}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {language === 'mr' ? 'औद्योगिक रबर आणि प्लास्टिक घटक' : OFFICIAL_BUSINESS_INFO.category}
                </span>
              </div>

              <div className="pt-4 border-t border-slate-200/80 flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-blue-50 text-[#0755A5] shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    {t.contact.addressHeading}
                  </span>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {language === 'mr' ? t.contact.addressVal : `${OFFICIAL_BUSINESS_INFO.addressLine1}, ${OFFICIAL_BUSINESS_INFO.addressLine2}`}
                  </p>
                  <span className="inline-block mt-1.5 text-xs text-slate-500 font-mono">
                    State: {OFFICIAL_BUSINESS_INFO.state} (Code: {OFFICIAL_BUSINESS_INFO.stateCode})
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200/80 flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 shrink-0 mt-0.5">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    {t.contact.phonesHeading}
                  </span>
                  <div className="space-y-1">
                    <a
                      href="tel:9028260011"
                      className="block font-mono text-sm font-bold text-[#102F59] hover:text-[#0755A5] transition-colors"
                    >
                      +91 9028260011
                    </a>
                    <a
                      href="tel:8788266934"
                      className="block font-mono text-sm font-bold text-[#102F59] hover:text-[#0755A5] transition-colors"
                    >
                      +91 8788266934
                    </a>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                    {t.contact.gstHeading}
                  </span>
                  <span className="font-mono text-slate-900 font-semibold bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                    {OFFICIAL_BUSINESS_INFO.gstin}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 uppercase tracking-wider block mb-0.5">
                    {t.contact.hoursHeading}
                  </span>
                  <span className="text-slate-600 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{language === 'mr' ? t.contact.hoursVal : OFFICIAL_BUSINESS_INFO.operatingHours}</span>
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={`https://wa.me/919028260011?text=${encodeURIComponent(
                    'Hello BABA ENTERPRISES, I would like to inquire about industrial rubber and plastic components.'
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{t.contact.whatsappBtn} (+91 9028260011)</span>
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-slate-100">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-4 h-4 text-[#0755A5]" />
                  <span>Khandobamal, Bhosari, Pune – 411039</span>
                </div>
                <a
                  href="https://maps.google.com/?q=Bhosari,+Pune,+Maharashtra+411039"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0755A5] font-semibold hover:underline"
                >
                  {language === 'mr' ? 'गुगल मॅपवर उघडा' : 'Open in Google Maps'}
                </a>
              </div>

              <div className="aspect-[16/9] w-full">
                <iframe
                  title="BABA ENTERPRISES Bhosari Pune Location"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15124.629858348633!2d73.83447957754665!3d18.618683501064166!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c78f0b78c909%3A0x6a2c2c0919326d9c!2sBhosari%2C%20Pimpri-Chinchwad%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
              <h3 className="font-heading text-base font-bold text-slate-900 mb-1">
                {language === 'mr' ? 'त्वरित कॉल बॅकची विनंती करा' : 'Request a Quick Callback'}
              </h3>
              <p className="text-xs text-slate-600 mb-4">
                {language === 'mr'
                  ? 'तुमचे नाव आणि फोन नंबर टाका; आमची इंजिनिअरिंग टिम तुम्हाला संपर्क करेल.'
                  : 'Leave your name and number; our engineering supply desk will call you back within business hours.'}
              </p>

              {quickSubmitted ? (
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  <span>
                    {language === 'mr'
                      ? 'धन्यवाद! आमची टीम लवकरच आपल्याशी संपर्क साधेल.'
                      : 'Thank you! We will call you back shortly on your provided number.'}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleQuickContact} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder={language === 'mr' ? 'तुमचे नाव *' : 'Your Name *'}
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                  />
                  <input
                    type="tel"
                    required
                    placeholder={language === 'mr' ? 'मोबाईल नंबर *' : 'Mobile Number *'}
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    className="px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#102F59] hover:bg-[#0755A5] text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{language === 'mr' ? 'कॉल बॅक विनंती' : 'Request Callback'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
