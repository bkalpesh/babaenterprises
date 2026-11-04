import React, { useState, useRef } from 'react';
import { StorageService } from '../../services/storageService';
import { ApiService, EnquirySubmissionResult } from '../../services/apiService';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, X, ArrowRight, ShieldCheck, AlertTriangle, PhoneCall } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface EnquirySectionProps {
  prefilledCategory?: string;
}

export const EnquirySection: React.FC<EnquirySectionProps> = ({ prefilledCategory }) => {
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [productCategory, setProductCategory] = useState(prefilledCategory || 'Rubber Washers');
  const [quantityRequired, setQuantityRequired] = useState('');
  const [technicalRequirements, setTechnicalRequirements] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<EnquirySubmissionResult | null>(null);

  const { language, t } = useLanguage();

  const categories = [
    'Rubber Washers',
    'Rubber Bushes & Bushings',
    'Rubber Grommets',
    'O-Rings & Sealing Components',
    'Rubber Bellows',
    'Rubber Bumpers',
    'Rubber T-Nuts',
    'Industrial Rubber Profiles & Shapes',
    'Plastic Industrial Components',
    'Customised Rubber & Plastic Components',
    'Rubber Mountings & Anti-Vibration',
    'Rubber Couplings & Flexible Spiders',
    'Other Engineering Rubber / Plastic',
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (!file) {
      setFileName(null);
      setFileData(undefined);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError(
        language === 'mr'
          ? 'फाईल आकार १० MB पेक्षा जास्त आहे.'
          : 'File size exceeds 10MB. Please upload a smaller file or compressed archive.'
      );
      return;
    }

    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'dwg', 'dxf', 'step', 'stp'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      setFileError(
        language === 'mr'
          ? 'स्वीकृत स्वरूप: PDF, JPG, PNG, DWG, DXF, STEP (१० MB पर्यंत)'
          : 'Supported formats: PDF, JPG, PNG, DWG, DXF, STEP (up to 10MB)'
      );
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setFileName(null);
    setFileData(undefined);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!companyName.trim()) {
      newErrors.companyName = language === 'mr' ? 'कंपनीचे नाव आवश्यक आहे' : 'Company name is required';
    }
    if (!contactPerson.trim()) {
      newErrors.contactPerson = language === 'mr' ? 'संपर्क व्यक्तीचे नाव आवश्यक आहे' : 'Contact person name is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      newErrors.email = language === 'mr' ? 'कृपया वैध व्यावसायिक ईमेल द्या' : 'Please provide a valid corporate email address';
    }

    const cleanedMobile = mobile.replace(/[^0-9]/g, '');
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!cleanedMobile || !mobileRegex.test(cleanedMobile.slice(-10))) {
      newErrors.mobile = language === 'mr' ? 'वैध १०-अंकी भारतीय मोबाईल नंबर टाका' : 'Enter a valid 10-digit Indian mobile number';
    }

    if (!productCategory) {
      newErrors.productCategory = language === 'mr' ? 'कृपया घटक श्रेणी निवडा' : 'Please select a product category';
    }
    if (!quantityRequired.trim()) {
      newErrors.quantityRequired = language === 'mr' ? 'कृपया आवश्यक प्रमाण नमूद करा' : 'Please specify estimated quantity or supply frequency';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot) return;
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const fileToUpload = fileInputRef.current?.files?.[0];
      const result = await ApiService.submitEnquiry({
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        productCategory,
        quantityRequired: quantityRequired.trim(),
        technicalRequirements: technicalRequirements.trim(),
        message: message.trim(),
        drawingFile: fileToUpload,
      });

      setSubmissionResult(result);
      setCompanyName('');
      setContactPerson('');
      setEmail('');
      setMobile('');
      setQuantityRequired('');
      setTechnicalRequirements('');
      setMessage('');
      removeFile();
      setErrors({});
    } catch {
      setErrors({
        general:
          language === 'mr'
            ? 'चौकशी नोंदवण्यात अडचण आली. कृपया पुन्हा प्रयत्न करा किंवा ९०२८२६००११ वर कॉल करा.'
            : 'Failed to record enquiry. Please try again or call 9028260011.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="enquiry" className="py-20 bg-slate-100 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-block max-w-[290px]">
              <img
                src="/assets/aistudio/Baba_Header_b3cf9ca8.png"
                alt="BABA ENTERPRISES - Industrial Rubber & Plastic Components"
                className="w-full h-auto object-contain block"
                loading="lazy"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-[#0755A5] uppercase tracking-wider mb-2">
              <span>{t.enquiry.eyebrow}</span>
            </div>

            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#102F59] tracking-tight leading-tight">
              {t.enquiry.title}
            </h2>

            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
              {t.enquiry.subtitle}
            </p>

            <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-4 shadow-xs">
              <h4 className="font-heading text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0755A5]" />
                <span>{t.enquiry.checklistTitle}</span>
              </h4>

              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0755A5] mt-1.5 shrink-0" />
                  <span>{t.enquiry.c1}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0755A5] mt-1.5 shrink-0" />
                  <span>{t.enquiry.c2}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0755A5] mt-1.5 shrink-0" />
                  <span>{t.enquiry.c3}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0755A5] mt-1.5 shrink-0" />
                  <span>{t.enquiry.c4}</span>
                </li>
              </ul>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{t.enquiry.directHotline}</span>
                <a href="tel:9028260011" className="font-mono font-bold text-[#102F59] hover:underline">
                  +91 9028260011
                </a>
              </div>
            </div>
          </div>

          {/* Right Column Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
              {submissionResult ? (
                submissionResult.isOffline ? (
                  /* OFFLINE PENDING STATE - NEVER CLAIMS SERVER SYNC SUCCESS */
                  <div className="py-8 px-4 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-200">
                      <AlertTriangle className="w-8 h-8" />
                    </div>

                    <h3 className="font-heading text-2xl font-bold text-slate-900">
                      {language === 'mr' ? 'चौकशी स्थानिकरित्या जतन केली (सर्व्हर सिंक प्रलंबित)' : 'Enquiry Saved Locally (Server Sync Pending)'}
                    </h3>

                    <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                      {submissionResult.message}
                    </p>

                    <div className="inline-block p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-left space-y-1">
                      <div className="text-xs text-amber-800 uppercase tracking-wider font-semibold">
                        {language === 'mr' ? 'स्थानिक संदर्भ क्रमांक' : 'Local Offline Tracking Reference'}
                      </div>
                      <div className="font-mono text-lg font-bold text-amber-900">
                        {submissionResult.referenceNumber}
                      </div>
                    </div>

                    <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <a
                        href="tel:9028260011"
                        className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-[#102F59] hover:bg-[#0755A5] rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span>Call +91 9028260011</span>
                      </a>
                      <button
                        onClick={() => setSubmissionResult(null)}
                        className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        {t.enquiry.submitAnother}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* SERVER SYNCHRONIZED STATE */
                  <div className="py-12 px-4 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>

                    <h3 className="font-heading text-2xl font-bold text-slate-900">
                      {t.enquiry.successTitle}
                    </h3>

                    <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                      {submissionResult.message}
                    </p>

                    <div className="inline-block p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-1">
                      <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                        {t.enquiry.refNotice}
                      </div>
                      <div className="font-mono text-lg font-bold text-[#102F59]">
                        {submissionResult.referenceNumber}
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={() => setSubmissionResult(null)}
                        className="px-6 py-2.5 text-xs font-semibold text-white bg-[#0755A5] hover:bg-[#102F59] rounded-lg transition-colors cursor-pointer"
                      >
                        {t.enquiry.submitAnother}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <input
                    type="text"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  {errors.general && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errors.general}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        {t.enquiry.companyName} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder={t.enquiry.companyNamePlaceholder}
                        className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border ${
                          errors.companyName ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                        } focus:outline-none focus:ring-2 focus:ring-[#0755A5]`}
                      />
                      {errors.companyName && (
                        <p className="mt-1 text-[11px] text-red-600">{errors.companyName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        {t.enquiry.contactPerson} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder={t.enquiry.contactPersonPlaceholder}
                        className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border ${
                          errors.contactPerson ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                        } focus:outline-none focus:ring-2 focus:ring-[#0755A5]`}
                      />
                      {errors.contactPerson && (
                        <p className="mt-1 text-[11px] text-red-600">{errors.contactPerson}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        {t.enquiry.email} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="rajesh@company.com"
                        className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border ${
                          errors.email ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                        } focus:outline-none focus:ring-2 focus:ring-[#0755A5]`}
                      />
                      {errors.email && <p className="mt-1 text-[11px] text-red-600">{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        {t.enquiry.mobile} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                          +91
                        </span>
                        <input
                          type="tel"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          placeholder="9822012345"
                          maxLength={10}
                          className={`w-full pl-11 pr-3.5 py-2.5 text-xs sm:text-sm rounded-lg border font-mono ${
                            errors.mobile ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                          } focus:outline-none focus:ring-2 focus:ring-[#0755A5]`}
                        />
                      </div>
                      {errors.mobile && <p className="mt-1 text-[11px] text-red-600">{errors.mobile}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        {t.enquiry.productCategory} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={productCategory}
                        onChange={(e) => setProductCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                      >
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      {errors.productCategory && (
                        <p className="mt-1 text-[11px] text-red-600">{errors.productCategory}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        {t.enquiry.quantity} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={quantityRequired}
                        onChange={(e) => setQuantityRequired(e.target.value)}
                        placeholder={t.enquiry.quantityPlaceholder}
                        className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border ${
                          errors.quantityRequired ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                        } focus:outline-none focus:ring-2 focus:ring-[#0755A5]`}
                      />
                      {errors.quantityRequired && (
                        <p className="mt-1 text-[11px] text-red-600">{errors.quantityRequired}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      {t.enquiry.technicalReq}
                    </label>
                    <input
                      type="text"
                      value={technicalRequirements}
                      onChange={(e) => setTechnicalRequirements(e.target.value)}
                      placeholder={t.enquiry.technicalReqPlaceholder}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      {t.enquiry.uploadLabel}
                    </label>

                    {fileName ? (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-xs">
                        <div className="flex items-center gap-2 text-slate-800 font-medium truncate">
                          <FileText className="w-4 h-4 text-[#0755A5] shrink-0" />
                          <span className="truncate">{fileName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={removeFile}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#0755A5] hover:bg-slate-50 transition-colors"
                      >
                        <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                        <span className="text-xs font-medium text-slate-700 block">
                          {t.enquiry.uploadText}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {t.enquiry.maxSize}
                        </span>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.step,.stp"
                      className="hidden"
                    />

                    {fileError && <p className="mt-1 text-[11px] text-red-600">{fileError}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      {t.enquiry.additionalMsg}
                    </label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t.enquiry.additionalMsgPlaceholder}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0755A5]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 text-center text-xs sm:text-sm font-semibold text-white bg-[#102F59] hover:bg-[#0755A5] rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span>{t.enquiry.submitting}</span>
                      ) : (
                        <>
                          <span>{t.enquiry.submit}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
