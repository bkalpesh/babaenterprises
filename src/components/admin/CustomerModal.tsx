import React, { useState, useEffect } from 'react';
import { X, Building2, CheckCircle2, AlertCircle, Save, ShieldCheck } from 'lucide-react';
import { Customer } from '../../types';
import { INDIAN_STATES, getStateByCode } from '../../data/indianStates';
import { validateGSTINChecksum, validateGSTINStateMatch, extractStateCode, extractPAN } from '../../utils/gstinUtils';
import { ApiService } from '../../services/apiService';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
  customerToEdit?: Customer | null;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customerToEdit,
}) => {
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [gstRegistrationType, setGstRegistrationType] = useState<'Registered' | 'Unregistered' | 'Composition' | 'Overseas'>('Registered');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('27');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customerToEdit) {
      setLegalName(customerToEdit.legal_name || '');
      setTradeName(customerToEdit.trade_name || '');
      setGstRegistrationType(customerToEdit.gst_registration_type || 'Registered');
      setGstin(customerToEdit.gstin || '');
      setPan(customerToEdit.pan || '');
      setBillingAddress(customerToEdit.billing_address || '');
      setCity(customerToEdit.city || '');
      setStateCode(customerToEdit.state_code || '27');
      setPincode(customerToEdit.pincode || '');
      setCountry(customerToEdit.country || 'India');
      setContactPerson(customerToEdit.contact_person || '');
      setMobile(customerToEdit.mobile || '');
      setEmail(customerToEdit.email || '');
      setNotes(customerToEdit.notes || '');
    } else {
      setLegalName('');
      setTradeName('');
      setGstRegistrationType('Registered');
      setGstin('');
      setPan('');
      setBillingAddress('');
      setCity('');
      setStateCode('27');
      setPincode('');
      setCountry('India');
      setContactPerson('');
      setMobile('');
      setEmail('');
      setNotes('');
    }
    setError(null);
  }, [customerToEdit, isOpen]);

  // Handle GSTIN change with auto state detection and PAN derivation
  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().trim();
    setGstin(upper);

    if (upper.length >= 2) {
      const code = extractStateCode(upper);
      if (code && getStateByCode(code)) {
        setStateCode(code);
      }
    }
    if (upper.length >= 12) {
      const derivedPan = extractPAN(upper);
      if (derivedPan) setPan(derivedPan);
    }
  };

  if (!isOpen) return null;

  const isGstinValid = gstin ? validateGSTINChecksum(gstin) : false;
  const isGstinStateMatched = gstin && stateCode ? validateGSTINStateMatch(gstin, stateCode) : true;
  const selectedState = getStateByCode(stateCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!legalName.trim()) {
      setError('Legal Entity Name is mandatory.');
      return;
    }

    if (gstRegistrationType === 'Registered') {
      if (!gstin.trim()) {
        setError('GSTIN is required for Registered taxpayers. Select "Unregistered" for B2C/exempt buyers.');
        return;
      }
      if (!validateGSTINChecksum(gstin.trim())) {
        setError('Invalid GSTIN checksum or pattern. Please enter a valid 15-character statutory GSTIN.');
        return;
      }
      if (!validateGSTINStateMatch(gstin.trim(), stateCode)) {
        setError(`GSTIN state prefix (${gstin.trim().substring(0, 2)}) must match selected state code (${stateCode}).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Customer> = {
        legal_name: legalName.trim(),
        trade_name: tradeName.trim() || undefined,
        gstin: gstRegistrationType === 'Registered' ? gstin.trim() : undefined,
        pan: pan.trim() || undefined,
        gst_registration_type: gstRegistrationType,
        billing_address: billingAddress.trim() || undefined,
        city: city.trim() || undefined,
        state: selectedState?.name || 'Maharashtra',
        state_code: stateCode,
        pincode: pincode.trim() || undefined,
        country: country.trim() || 'India',
        contact_person: contactPerson.trim() || undefined,
        mobile: mobile.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      let saved: Customer;
      if (customerToEdit?.id) {
        const res = await ApiService.updateCustomer(customerToEdit.id, payload);
        if (!res.success || !res.customer) throw new Error(res.error || 'Failed to update customer');
        saved = res.customer;
      } else {
        const res = await ApiService.createCustomer(payload);
        if (!res.success || !res.customer) throw new Error(res.error || 'Failed to create customer');
        saved = res.customer;
      }

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0755A5] rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {customerToEdit ? 'Edit Customer Master Record' : 'Create New Customer Master'}
              </h3>
              <p className="text-xs text-slate-400">
                Statutory GST master profile for quotations and tax invoices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Registration Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              GST Registration Category <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['Registered', 'Unregistered', 'Composition', 'Overseas'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGstRegistrationType(type)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition ${
                    gstRegistrationType === type
                      ? 'bg-[#0755A5] text-white border-[#0755A5] shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {type === 'Registered' ? 'Regular GST' : type}
                </button>
              ))}
            </div>
          </div>

          {/* Legal and Trade Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Legal Entity Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Bharat Forge Limited"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trade Name / Operating Name (Optional)
              </label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="e.g. BFL Heavy Forgings Division"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
              />
            </div>
          </div>

          {/* GSTIN and PAN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  GSTIN {gstRegistrationType === 'Registered' && <span className="text-red-500">*</span>}
                </label>
                {gstin && (
                  <span className="text-[11px] font-medium flex items-center gap-1">
                    {isGstinValid && isGstinStateMatched ? (
                      <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mod-36 Valid
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Check format/state
                      </span>
                    )}
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={15}
                disabled={gstRegistrationType === 'Unregistered'}
                value={gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                placeholder={gstRegistrationType === 'Unregistered' ? 'Unregistered Buyer (N/A)' : 'e.g. 27AAACB2026R1Z9'}
                className={`w-full px-3 py-2 text-sm font-mono uppercase border rounded-lg focus:outline-none focus:ring-2 transition ${
                  gstRegistrationType === 'Unregistered'
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : isGstinValid
                    ? 'border-emerald-500 focus:ring-emerald-200 bg-emerald-50/20'
                    : 'border-slate-300 focus:ring-[#0755A5]/20 focus:border-[#0755A5]'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PAN (Permanent Account Number)
              </label>
              <input
                type="text"
                maxLength={10}
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="e.g. AAACB2026R"
                className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
              />
            </div>
          </div>

          {/* State & Code Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                State / Union Territory <span className="text-red-500">*</span>
              </label>
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.code} - {st.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GST State Code
              </label>
              <div className="px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-800">
                Code: {stateCode}
              </div>
            </div>
          </div>

          {/* Address, City, Pincode */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Factory / Registered Billing Address
            </label>
            <textarea
              rows={2}
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              placeholder="e.g. Plot No. 24, Mundhwa Industrial Area, Ghorpadi"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City / District</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Pune"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code</label>
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 411036"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
              />
            </div>
          </div>

          {/* Contact Person, Mobile, Email */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Mr. Rajesh Kulkarni"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile / Phone</label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. +91 98220 12345"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="procurement@company.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Notes & Delivery Instructions (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Quality inspection gate pass required at entry"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
            />
          </div>

          {/* Statutory Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-[#0755A5] flex-shrink-0" />
            <span>
              Customer Master data will automatically autofill buyer details on quotations and invoices, guaranteeing full compliance with GST Rule 46.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-[#0755A5] hover:bg-[#064485] rounded-lg transition shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : customerToEdit ? 'Update Customer' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
