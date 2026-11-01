import React, { useState } from 'react';
import { X, Send, CheckCircle2, Phone } from 'lucide-react';
import { StorageService } from '../../services/storageService';
import { useLanguage } from '../../context/LanguageContext';

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProduct?: string;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  isOpen,
  onClose,
  defaultProduct,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [productCategory, setProductCategory] = useState(defaultProduct || 'Rubber Washers');
  const [quantity, setQuantity] = useState('');
  const [technicalNote, setTechnicalNote] = useState('');
  const [isSuccess, setIsSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { language, t } = useLanguage();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactPerson.trim() || !mobile.trim()) {
      setError(
        language === 'mr'
          ? 'कृपया आवश्यक माहिती भरा (कंपनी, संपर्क व्यक्ती, मोबाईल)'
          : 'Please fill in required fields (Company, Contact Person, Mobile)'
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    setTimeout(() => {
      try {
        const enq = StorageService.createEnquiry({
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim(),
          email: email.trim() || 'direct-quote@babaenterprises.in',
          mobile: mobile.trim(),
          productCategory,
          quantityRequired: quantity.trim() || 'Specification Pending',
          technicalRequirements: technicalNote.trim(),
          message: 'Quotation requested via Quick Modal dialog.',
        });

        setIsSuccess(enq.referenceNumber);
        setIsSubmitting(false);
      } catch {
        setError(
          language === 'mr'
            ? 'सबमिशन अयशस्वी. कृपया ९०२८२६००११ वर थेट कॉल करा.'
            : 'Submission failed. Please call 9028260011 directly.'
        );
        setIsSubmitting(false);
      }
    }, 400);
  };

  const handleReset = () => {
    setIsSuccess(null);
    setCompanyName('');
    setContactPerson('');
    setMobile('');
    setEmail('');
    setQuantity('');
    setTechnicalNote('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#102F59] text-white p-5 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-xs max-w-[210px]">
              <img
                src="/assets/aistudio/Baba_Header_b3cf9ca8.png"
                alt="BABA ENTERPRISES - Industrial Rubber & Plastic Components"
                className="w-full h-auto object-contain block"
              />
            </div>
            <h3 className="font-heading text-base font-bold text-white">{t.quoteModal.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-heading text-xl font-bold text-slate-900">{t.quoteModal.dispatched}</h4>
              <p className="text-xs sm:text-sm text-slate-600">
                {language === 'mr' ? 'आपली विनंती नोंदवली गेली आहे. संदर्भ आयडी:' : 'Your request has been logged. Reference ID:'}
              </p>
              <div className="font-mono text-base font-bold text-[#102F59] bg-slate-100 py-2 px-4 rounded-lg inline-block">
                {isSuccess}
              </div>
              <p className="text-xs text-slate-500">
                {t.quoteModal.desc}
              </p>
              <div className="pt-2">
                <button
                  onClick={handleReset}
                  className="px-6 py-2.5 bg-[#0755A5] text-white text-xs font-semibold rounded-lg hover:bg-[#102F59] transition-colors cursor-pointer"
                >
                  {t.quoteModal.close}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.enquiry.companyName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t.enquiry.companyNamePlaceholder}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.enquiry.contactPerson} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder={t.enquiry.contactPersonPlaceholder}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.enquiry.mobile} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="10-digit Mobile"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.enquiry.productCategory}</label>
                  <input
                    type="text"
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t.enquiry.quantity}</label>
                  <input
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={t.enquiry.quantityPlaceholder}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.enquiry.technicalReq}
                </label>
                <textarea
                  rows={2}
                  value={technicalNote}
                  onChange={(e) => setTechnicalNote(e.target.value)}
                  placeholder={t.enquiry.technicalReqPlaceholder}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#102F59] hover:bg-[#0755A5] text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? t.enquiry.submitting : t.quoteModal.title}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{t.quoteModal.speakDirectly}</span>
                <a href="tel:9028260011" className="font-mono font-bold text-[#102F59] flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#0755A5]" />
                  <span>9028260011</span>
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
