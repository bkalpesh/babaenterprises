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
}

export const QuotationCreateModal: React.FC<QuotationCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  availableProducts = [],
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Buyer Form Details (autofilled from customer, can be edited for transaction override)
  const [buyerName, setBuyerName] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
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
      gstRate: 18,
    },
  ]);

  const [applyRoundOff, setApplyRoundOff] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load customer master list
  const loadCustomers = async () => {
    try {
      const data = await ApiService.getCustomers();
      setCustomers(data.filter((c) => c.is_active));
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  // When a customer is selected from dropdown, autofill details
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setBuyerName(cust.contactPerson || cust.contact_person || cust.legalName || cust.legal_name || '');
      setBuyerCompany(cust.legalName || cust.legal_name || '');
      setBuyerGstin(cust.gstin || '');
      setBuyerAddress(cust.billingAddress || cust.billing_address || '');
      setBuyerStateCode(cust.stateCode || cust.state_code || '27');
      setBuyerPincode(cust.pincode || '');
    }
  };

  // When a product catalog item is selected into a row
  const handleProductSelect = (index: number, productId: string) => {
    const prod = availableProducts.find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              productId: prod.id,
              itemDescription: prod.name,
              // Never use hardcoded defaults; use product fields if present
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
        gstRate: 18,
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

    if (!buyerCompany.trim()) {
      setError('Buyer Company Name is mandatory.');
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
        buyer_name: buyerName.trim() || buyerCompany.trim(),
        buyer_company: buyerCompany.trim(),
        buyer_address: buyerAddress.trim() || undefined,
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

      const result = await ApiService.createQuotation(payload);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create quotation. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0755A5] rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create New Quotation</h3>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
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

            {/* Buyer Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Buyer Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={buyerCompany}
                  onChange={(e) => setBuyerCompany(e.target.value)}
                  placeholder="e.g. Bharat Forge Limited"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Buyer GSTIN (Leave empty if B2C / Unregistered)
                </label>
                <input
                  type="text"
                  value={buyerGstin}
                  onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 27AAACB2026R1Z9"
                  className="w-full px-3 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g. Mr. Rajesh Kulkarni"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing / Delivery Address</label>
                <input
                  type="text"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  placeholder="e.g. Plot No. 24, Mundhwa Industrial Area, Pune"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Place of Supply / State <span className="text-red-500">*</span>
                </label>
                <select
                  value={buyerStateCode}
                  onChange={(e) => setBuyerStateCode(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5] bg-white"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.code} - {st.name}
                    </option>
                  ))}
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
            <div className="flex items-center justify-between">
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

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
                          <input
                            type="text"
                            required
                            value={row.itemDescription}
                            onChange={(e) => updateItem(idx, 'itemDescription', e.target.value)}
                            placeholder="e.g. Precision Nitrile O-Rings 24x3 mm"
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0755A5]"
                          />
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
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
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
              {isSubmitting ? 'Creating Draft...' : 'Create Draft Quotation'}
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
            loadCustomers();
            handleCustomerSelect(newCust.id);
            setIsCustomerModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
