import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Plus,
  Trash2,
  Building2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Save,
  UserPlus,
  Layers,
  Calculator,
} from 'lucide-react';
import { Customer, Product } from '../../types';
import { ApiService, StagingQuotation } from '../../services/apiService';
import { INDIAN_STATES, getStateByCode } from '../../data/indianStates';
import { CustomerModal } from './CustomerModal';
import { ResponsiveLineItemsEditor } from './ResponsiveLineItemsEditor';

interface LineItemRow {
  productId?: string;
  itemDescription: string;
  hsnCode: string;
  quantity: number;
  unitOfMeasure: string;
  rate: number;
  discountPercent: number;
  gstRate: number | null; // 0, 5, 12, 18, 28 or null (unconfirmed)
}

interface QuotationCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (quotation: StagingQuotation) => void;
  availableProducts?: Product[];
  initialData?: StagingQuotation | null;
}

export const QuotationCreateModal: React.FC<QuotationCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  availableProducts = [],
  initialData = null,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Buyer Form Details (autofilled from customer, can be edited for transaction override)
  const [buyerName, setBuyerName] = useState(''); // Legal entity name, aligned with invoice buyer_name
  const [buyerCompany, setBuyerCompany] = useState(''); // Trade / operating name
  const [buyerContactPerson, setBuyerContactPerson] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerCity, setBuyerCity] = useState('');
  const [buyerStateCode, setBuyerStateCode] = useState('27');
  const [buyerPincode, setBuyerPincode] = useState('');

  // Quotation Line Items
  const [items, setItems] = useState<LineItemRow[]>([
    {
      itemDescription: '',
      hsnCode: '',
      quantity: 100,
      unitOfMeasure: 'NOS',
      rate: 0,
      discountPercent: 0,
      gstRate: null, // Default to null (unconfirmed)
    },
  ]);

  const [applyRoundOff, setApplyRoundOff] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load customer master list and populate initialData if editing
  const loadInitialState = async () => {
    let customerMaster: Customer[] = [];
    try {
      customerMaster = await ApiService.getCustomers();
      setCustomers(customerMaster.filter((c) => c.is_active));
    } catch {
      // Offline fallback
    }

    if (initialData) {
      setSelectedCustomerId(initialData.customer_id || '');
      const isLegacyBuyerRecord = Number(initialData.buyer_fields_version || 1) < 2;
      setBuyerName(isLegacyBuyerRecord ? (initialData.buyer_company || initialData.buyer_name || '') : (initialData.buyer_name || ''));
      setBuyerCompany(isLegacyBuyerRecord ? '' : (initialData.buyer_company || ''));
      setBuyerContactPerson(isLegacyBuyerRecord
        ? (initialData.buyer_company && initialData.buyer_name !== initialData.buyer_company ? initialData.buyer_name : '')
        : (initialData.buyer_contact_person || ''));
      setBuyerPhone(initialData.buyer_phone || '');
      setBuyerEmail(initialData.buyer_email || '');
      setBuyerGstin(initialData.buyer_gstin || '');
      setBuyerAddress(initialData.buyer_address || '');
      setBuyerCity(initialData.buyer_city || '');
      setBuyerStateCode(initialData.buyer_state_code || '27');
      setBuyerPincode(initialData.buyer_pincode || '');

      // For legacy quotations, use linked Customer Master data to fill fields the old form did not store.
      if (isLegacyBuyerRecord && initialData.customer_id) {
        const masterCustomer = customerMaster.find((c) => c.id === initialData.customer_id);
        if (masterCustomer) {
          setBuyerName(masterCustomer.legalName || masterCustomer.legal_name || initialData.buyer_company || initialData.buyer_name || '');
          setBuyerCompany(masterCustomer.tradeName || masterCustomer.trade_name || '');
          setBuyerContactPerson(masterCustomer.contactPerson || masterCustomer.contact_person || (initialData.buyer_company && initialData.buyer_name !== initialData.buyer_company ? initialData.buyer_name : ''));
          setBuyerGstin(initialData.buyer_gstin || masterCustomer.gstin || '');
          setBuyerAddress(initialData.buyer_address || masterCustomer.billingAddress || masterCustomer.billing_address || '');
          setBuyerCity(initialData.buyer_city || masterCustomer.city || '');
          setBuyerStateCode(initialData.buyer_state_code || masterCustomer.stateCode || masterCustomer.state_code || '27');
          setBuyerPincode(initialData.buyer_pincode || masterCustomer.pincode || '');
          setBuyerPhone(initialData.buyer_phone || masterCustomer.mobile || '');
          setBuyerEmail(initialData.buyer_email || masterCustomer.email || '');
        }
      }

      // Load full items from backend
      try {
        const fullQuote = await ApiService.getQuotation(initialData.id);
        if (fullQuote.success && Array.isArray(fullQuote.items) && fullQuote.items.length > 0) {
          setItems(
            fullQuote.items.map((it: any) => ({
              productId: it.product_id || undefined,
              itemDescription: it.item_description || it.name || '',
              hsnCode: it.hsn_code || '',
              quantity: it.quantity_microunits ? it.quantity_microunits / 1_000_000 : (it.quantity || 1),
              unitOfMeasure: it.unit_of_measure || 'NOS',
              rate: it.unit_price_paise ? it.unit_price_paise / 100 : (it.rate || 0),
              discountPercent: it.discount_bps ? it.discount_bps / 100 : (it.discountPercent || 0),
              gstRate: it.gst_rate_bps !== null && it.gst_rate_bps !== undefined ? it.gst_rate_bps / 100 : null,
            }))
          );
        }
      } catch {
        // Keep default row if fetch fails
      }
    } else {
      // Reset form to blank state for creation
      setSelectedCustomerId('');
      setBuyerName('');
      setBuyerCompany('');
      setBuyerContactPerson('');
      setBuyerPhone('');
      setBuyerEmail('');
      setBuyerGstin('');
      setBuyerAddress('');
      setBuyerCity('');
      setBuyerStateCode('27');
      setBuyerPincode('');
      setItems([
        {
          itemDescription: '',
          hsnCode: '',
          quantity: 100,
          unitOfMeasure: 'NOS',
          rate: 0,
          discountPercent: 0,
          gstRate: null,
        },
      ]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadInitialState();
    }
  }, [isOpen, initialData?.id]);

  // When a customer is selected from dropdown, autofill details
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setBuyerName(cust.legalName || cust.legal_name || '');
      setBuyerCompany(cust.tradeName || cust.trade_name || '');
      setBuyerContactPerson(cust.contactPerson || cust.contact_person || '');
      setBuyerPhone(cust.mobile || '');
      setBuyerEmail(cust.email || '');
      setBuyerGstin(cust.gstin || '');
      setBuyerAddress(cust.billingAddress || cust.billing_address || '');
      setBuyerCity(cust.city || '');
      setBuyerStateCode(cust.stateCode || cust.state_code || '27');
      setBuyerPincode(cust.pincode || '');
    }
  };

  // When a product catalog item is selected into a row
  const handleProductSelect = (index: number, productId: string) => {
    if (!productId) {
      setItems((prev) =>
        prev.map((row, i) => (i === index ? { ...row, productId: undefined } : row))
      );
      return;
    }

    const prod = availableProducts.find((p) => p.id === productId);
    if (!prod) return;

    const unitPrice = prod.unitPricePaise
      ? prod.unitPricePaise / 100
      : prod.unit_price_paise
      ? prod.unit_price_paise / 100
      : 0;

    const rawGstBps = prod.gstRateBps ?? prod.gst_rate_bps;
    const gstRateVal = rawGstBps !== undefined && rawGstBps !== null ? rawGstBps / 100 : null;

    const hsnVal = prod.hsnCode || prod.hsn_code || '';

    setItems((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              productId: prod.id,
              itemDescription: prod.name,
              hsnCode: hsnVal || row.hsnCode,
              rate: unitPrice > 0 ? unitPrice : row.rate,
              gstRate: gstRateVal,
              unitOfMeasure: 'NOS',
            }
          : row
      )
    );
  };

  // Line item change handlers
  const updateItem = (index: number, field: keyof LineItemRow, value: any) => {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        itemDescription: '',
        hsnCode: '',
        quantity: 100,
        unitOfMeasure: 'NOS',
        rate: 0,
        discountPercent: 0,
        gstRate: null, // Default to null (unconfirmed)
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // GST Calculation & Tax determination
  // Seller is BABA ENTERPRISES (State 27 - Maharashtra)
  const SELLER_STATE = '27';
  const isInterstate = buyerStateCode !== SELLER_STATE;
  const buyerState = getStateByCode(buyerStateCode);

  // Compute live totals
  let grossTotal = 0;
  let totalDiscount = 0;
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  items.forEach((it) => {
    const lineGross = it.quantity * it.rate;
    const lineDiscount = lineGross * ((it.discountPercent || 0) / 100);
    const lineTaxable = Math.max(0, lineGross - lineDiscount);
    const gstPct = it.gstRate ?? 0;

    grossTotal += lineGross;
    totalDiscount += lineDiscount;
    taxableTotal += lineTaxable;

    if (isInterstate) {
      igstTotal += lineTaxable * (gstPct / 100);
    } else {
      const halfRate = gstPct / 2;
      cgstTotal += lineTaxable * (halfRate / 100);
      sgstTotal += lineTaxable * (halfRate / 100);
    }
  });

  const totalTax = cgstTotal + sgstTotal + igstTotal;
  const rawGrandTotal = taxableTotal + totalTax;
  const grandTotal = applyRoundOff ? Math.round(rawGrandTotal) : rawGrandTotal;
  const roundOff = applyRoundOff ? grandTotal - rawGrandTotal : 0;

  // Validation warnings
  const hasMissingHsn = items.some((it) => !it.hsnCode || it.hsnCode.trim().length < 4);
  const hasUnconfirmedGst = items.some((it) => it.gstRate === null || it.gstRate === undefined);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!buyerName.trim()) {
      setError('Buyer Legal Name is mandatory.');
      return;
    }
    if (buyerPincode.trim() && !/^[1-9][0-9]{5}$/.test(buyerPincode.trim())) {
      setError('Buyer PIN Code must be a valid 6-digit Indian PIN code.');
      return;
    }

    if (items.length === 0) {
      setError('At least one line item is required.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.itemDescription.trim()) {
        setError(`Item #${i + 1}: Description is required.`);
        return;
      }
      if (it.quantity <= 0) {
        setError(`Item #${i + 1}: Quantity must be greater than zero.`);
        return;
      }
      if (it.rate <= 0) {
        setError(`Item #${i + 1}: Unit price must be greater than zero.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer_id: selectedCustomerId || undefined,
        buyer_name: buyerName.trim(),
        buyer_company: buyerCompany.trim() || undefined,
        buyer_contact_person: buyerContactPerson.trim() || undefined,
        buyer_phone: buyerPhone.trim() || undefined,
        buyer_email: buyerEmail.trim() || undefined,
        buyer_address: buyerAddress.trim() || undefined,
        buyer_city: buyerCity.trim() || undefined,
        buyer_state_name: buyerState?.name || 'Maharashtra',
        buyer_state_code: buyerStateCode,
        buyer_pincode: buyerPincode.trim() || undefined,
        buyer_gstin: buyerGstin.trim() || undefined,
        is_interstate: isInterstate ? 1 : 0,
        apply_round_off: applyRoundOff ? 1 : 0,
        items: items.map((it) => ({
          productId: it.productId || undefined,
          name: it.itemDescription.trim(),
          hsn_code: it.hsnCode.trim() || undefined,
          quantity: it.quantity,
          unitOfMeasure: it.unitOfMeasure,
          rate: it.rate,
          discount_bps: Math.round((it.discountPercent || 0) * 100),
          gst_rate_bps: it.gstRate !== null && it.gstRate !== undefined ? Math.round(it.gstRate * 100) : null,
        })),
      };

      const result = initialData
        ? await ApiService.updateQuotation(initialData.id, payload)
        : await ApiService.createQuotation(payload);

      if (result && result.success === false) {
        setError(result.error || 'Failed to save quotation. Please check your inputs.');
        return;
      }

      onSuccess(result.quotation || result);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save quotation. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl sm:h-auto sm:max-h-[94vh] sm:max-w-4xl sm:rounded-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3 text-white sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0755A5] rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {initialData ? `Edit Quotation (${initialData.quotation_number})` : 'Create New Quotation'}
              </h3>
              <p className="text-xs text-slate-400">
                Draft quotation with customer master autofill & statutory GST calculation
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-8 space-y-5 sm:space-y-6 sm:p-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Customer Selection & Buyer Details */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0755A5]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Buyer & Customer Master Selection
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0755A5] hover:text-[#064485] hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                + Create New Customer Inline
              </button>
            </div>

            {/* Customer Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select from Customer Master
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white font-medium"
              >
                <option value="">-- Choose an existing customer or enter details below --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legal_name} {c.gstin ? `[GSTIN: ${c.gstin}]` : '[Unregistered]'} — {c.city || c.state}
                  </option>
                ))}
              </select>
            </div>

            {/* Buyer Details: field names and semantics aligned with InvoiceCreateModal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Buyer Legal Name <span className="text-red-500">*</span></label>
                <input type="text" required value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="e.g. Rajesh Kulkarni" className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trade / Operating Name</label>
                <input type="text" value={buyerCompany} onChange={(e) => setBuyerCompany(e.target.value)} placeholder="e.g. Bharat Forge Limited" className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Buyer GSTIN (optional for unregistered buyers)</label>
                <input type="text" value={buyerGstin} onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())} placeholder="e.g. 27AAACB2026R1Z9" className="w-full px-3 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                <input type="text" value={buyerContactPerson} onChange={(e) => setBuyerContactPerson(e.target.value)} placeholder="e.g. Mr. Rajesh Kulkarni" className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="Customer phone" className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
                <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="Customer email" className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery / Factory Address</label>
                <input type="text" value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} placeholder="Street, building, industrial area" className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input type="text" value={buyerCity} onChange={(e) => setBuyerCity(e.target.value)} placeholder="e.g. Pune" className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Buyer PIN Code</label>
                <input type="text" inputMode="numeric" maxLength={6} value={buyerPincode} onChange={(e) => setBuyerPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit PIN" className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Place of Supply / State <span className="text-red-500">*</span></label>
                <select value={buyerStateCode} onChange={(e) => setBuyerStateCode(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white">
                  {INDIAN_STATES.map((st) => <option key={st.code} value={st.code}>{st.code} - {st.name}</option>)}
                </select>
              </div>
            </div>

            {/* Jurisdiction Badge */}
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-white border border-slate-200">
              <span className="text-slate-600">
                Supply Jurisdiction:{' '}
                <strong>{buyerState?.name || 'Maharashtra'}</strong> (Code {buyerStateCode})
              </span>
              <span
                className={`font-semibold px-2.5 py-0.5 rounded text-[11px] ${
                  isInterstate
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {isInterstate ? 'Inter-State Supply (IGST 100%)' : 'Intra-State Supply (CGST 50% + SGST 50%)'}
              </span>
            </div>
          </div>

          {/* Section 2: Multi-Line Items */}
          <div className="space-y-3">
            <div className="hidden md:flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0755A5]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Quotation Line Items ({items.length})
                </span>
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#0755A5] bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Row
              </button>
            </div>

            <ResponsiveLineItemsEditor items={items} availableProducts={availableProducts || []} onAdd={addItemRow} onUpdate={updateItem} onProductSelect={handleProductSelect} onRemove={removeItemRow} documentLabel="Quotation" />

            <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Item Description</th>
                    <th className="py-2.5 px-2 w-24">HSN/SAC</th>
                    <th className="py-2.5 px-2 w-20">Qty</th>
                    <th className="py-2.5 px-2 w-16">UOM</th>
                    <th className="py-2.5 px-2 w-24">Unit Rate (₹)</th>
                    <th className="py-2.5 px-2 w-20">Disc %</th>
                    <th className="py-2.5 px-2 w-24">GST %</th>
                    <th className="py-2.5 px-3 w-28 text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {items.map((row, idx) => {
                    const gross = row.quantity * row.rate;
                    const disc = gross * ((row.discountPercent || 0) / 100);
                    const taxable = Math.max(0, gross - disc);

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                        <td className="py-2.5 px-3">
                          <div className="space-y-1">
                            {availableProducts && availableProducts.length > 0 && (
                              <select
                                value={row.productId || ''}
                                onChange={(e) => handleProductSelect(idx, e.target.value)}
                                className="w-full px-1.5 py-1 text-[11px] font-medium border border-slate-200 rounded bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0755A5]"
                              >
                                <option value="">-- Select Product Catalogue Item --</option>
                                {availableProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.hsnCode || p.hsn_code ? `[HSN: ${p.hsnCode || p.hsn_code}]` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                            <input
                              type="text"
                              required
                              value={row.itemDescription}
                              onChange={(e) => updateItem(idx, 'itemDescription', e.target.value)}
                              placeholder="e.g. Precision Nitrile O-Rings 24x3 mm"
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0755A5]"
                            />
                          </div>
                        </td>

                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            maxLength={8}
                            value={row.hsnCode}
                            onChange={(e) => updateItem(idx, 'hsnCode', e.target.value.replace(/\D/g, ''))}
                            placeholder="e.g. 4016"
                            className={`w-full px-2 py-1 text-xs font-mono border rounded focus:outline-none focus:ring-1 ${
                              !row.hsnCode || row.hsnCode.length < 4
                                ? 'border-amber-300 bg-amber-50/30'
                                : 'border-slate-300'
                            }`}
                          />
                        </td>

                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-xs text-right border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0755A5]"
                          />
                        </td>

                        <td className="py-2.5 px-2">
                          <select
                            value={row.unitOfMeasure}
                            onChange={(e) => updateItem(idx, 'unitOfMeasure', e.target.value)}
                            className="w-full px-1 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0755A5] bg-white"
                          >
                            <option value="NOS">NOS</option>
                            <option value="KGS">KGS</option>
                            <option value="SET">SET</option>
                            <option value="MTR">MTR</option>
                            <option value="LOT">LOT</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.rate}
                            onChange={(e) => updateItem(idx, 'rate', Number(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-xs text-right border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0755A5]"
                          />
                        </td>

                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={row.discountPercent}
                            onChange={(e) => updateItem(idx, 'discountPercent', Number(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-xs text-right border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0755A5]"
                          />
                        </td>

                        <td className="py-2.5 px-2">
                          <select
                            value={row.gstRate !== null ? String(row.gstRate) : ''}
                            onChange={(e) =>
                              updateItem(
                                idx,
                                'gstRate',
                                e.target.value === '' ? null : Number(e.target.value)
                              )
                            }
                            className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0755A5] bg-white font-medium"
                          >
                            <option value="0">0% (Nil)</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18% (Standard)</option>
                            <option value="28">28%</option>
                            <option value="">Unconfirmed</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                          ₹{taxable.toFixed(2)}
                        </td>

                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => removeItemRow(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-20 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Warnings */}
            {(hasMissingHsn || hasUnconfirmedGst) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Statutory Advisory: </span>
                  {hasMissingHsn && 'Some items are missing 4-to-8 digit HSN codes. '}
                  {hasUnconfirmedGst && 'Some items have unconfirmed GST rates. '}
                  <span>Quotation can be saved as Draft, but HSN and confirmed GST rates will be strictly enforced before conversion to invoice.</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Summary Totals Card */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1 text-xs text-slate-400">
              <div>Subtotal Gross: <span className="font-mono text-slate-200">₹{grossTotal.toFixed(2)}</span></div>
              <div>Discount: <span className="font-mono text-slate-200">- ₹{totalDiscount.toFixed(2)}</span></div>
              <div>Taxable Amount: <span className="font-mono text-white font-semibold">₹{taxableTotal.toFixed(2)}</span></div>
              <div className="pt-1">
                {isInterstate ? (
                  <span>Integrated Tax (IGST): <span className="font-mono text-purple-300 font-semibold">₹{igstTotal.toFixed(2)}</span></span>
                ) : (
                  <span>
                    CGST: <span className="font-mono text-blue-300 font-semibold">₹{cgstTotal.toFixed(2)}</span> | SGST:{' '}
                    <span className="font-mono text-blue-300 font-semibold">₹{sgstTotal.toFixed(2)}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-slate-800 sm:pl-6 w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-slate-400 mb-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyRoundOff}
                    onChange={(e) => setApplyRoundOff(e.target.checked)}
                    className="rounded text-[#0755A5]"
                  />
                  <span>Apply Round Off ({roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`})</span>
                </label>
              </div>
              <div className="text-xs uppercase text-slate-400 font-semibold">Grand Total (INR)</div>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400">Status: Unnumbered Draft Record</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 -mx-3 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-3 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:gap-3 sm:border-0 sm:pt-2 sm:px-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-11 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0755A5] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#064485] disabled:opacity-50 sm:w-auto"
            >
              <Save className="w-4 h-4" />
              {isSubmitting
                ? (initialData ? 'Saving Changes...' : 'Creating Draft...')
                : (initialData ? 'Save Changes' : 'Create Draft Quotation')}
            </button>
          </div>
        </form>
      </div>

      {/* Inline Customer Creation Modal */}
      {isCustomerModalOpen && (
        <CustomerModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          onSuccess={(newCust) => {
            loadInitialState();
            handleCustomerSelect(newCust.id);
            setIsCustomerModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
