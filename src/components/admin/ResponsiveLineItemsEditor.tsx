import React from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';

interface ResponsiveLineItemsEditorProps {
  items: any[];
  availableProducts?: any[];
  onAdd: () => void;
  onUpdate: (index: number, field: string, value: any) => void;
  onProductSelect: (index: number, productId: string) => void;
  onRemove: (index: number) => void;
  documentLabel: 'Invoice' | 'Quotation';
}

export const ResponsiveLineItemsEditor: React.FC<ResponsiveLineItemsEditorProps> = ({
  items,
  availableProducts = [],
  onAdd,
  onUpdate,
  onProductSelect,
  onRemove,
  documentLabel,
}) => (
  <section className="space-y-3 md:hidden" aria-label={`${documentLabel} line items`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Layers className="h-4 w-4 shrink-0 text-[#0755A5]" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Items ({items.length})</h4>
      </div>
      <button type="button" onClick={onAdd} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-3 text-xs font-semibold text-[#0755A5]">
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>
    </div>
    {items.map((row, idx) => {
      const gross = Number(row.quantity || 0) * Number(row.rate || 0);
      const taxable = Math.max(0, gross - gross * (Number(row.discountPercent || 0) / 100));
      return (
        <article key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-700">Item {idx + 1}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-900">₹{taxable.toFixed(2)}</span>
              <button type="button" disabled={items.length <= 1} onClick={() => onRemove(idx)} aria-label={`Remove item ${idx + 1}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {availableProducts.length > 0 && (
              <label className="block text-[11px] font-semibold text-slate-600">Catalogue product
                <select value={row.productId || ''} onChange={(e) => onProductSelect(idx, e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  <option value="">Select product (optional)</option>
                  {availableProducts.map((p) => <option key={p.id} value={p.id}>{p.name} {p.hsnCode || p.hsn_code ? `[HSN: ${p.hsnCode || p.hsn_code}]` : ''}</option>)}
                </select>
              </label>
            )}
            <label className="block text-[11px] font-semibold text-slate-600">Item description
              <input type="text" required value={row.itemDescription} onChange={(e) => onUpdate(idx, 'itemDescription', e.target.value)} placeholder="Enter item description" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] font-semibold text-slate-600">HSN / SAC
                <input type="text" inputMode="numeric" maxLength={8} value={row.hsnCode} onChange={(e) => onUpdate(idx, 'hsnCode', e.target.value.replace(/\\D/g, ''))} placeholder="4–8 digits" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">GST rate
                <select value={row.gstRate !== null ? String(row.gstRate) : ''} onChange={(e) => onUpdate(idx, 'gstRate', e.target.value === '' ? null : Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm">
                  <option value="0">0% (Nil)</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option><option value="">Unconfirmed</option>
                </select>
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Quantity
                <input type="number" min="1" step="any" value={row.quantity} onChange={(e) => onUpdate(idx, 'quantity', Number(e.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Unit
                <select value={row.unitOfMeasure} onChange={(e) => onUpdate(idx, 'unitOfMeasure', e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm">
                  <option value="NOS">NOS</option><option value="KGS">KGS</option><option value="SET">SET</option><option value="MTR">MTR</option><option value="LOT">LOT</option>
                </select>
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Unit rate (₹)
                <input type="number" min="0" step="0.01" value={row.rate} onChange={(e) => onUpdate(idx, 'rate', Number(e.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Discount (%)
                <input type="number" min="0" max="100" step="0.1" value={row.discountPercent} onChange={(e) => onUpdate(idx, 'discountPercent', Number(e.target.value) || 0)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
              </label>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-600">Taxable amount</span><strong className="font-mono text-slate-900">₹{taxable.toFixed(2)}</strong>
            </div>
          </div>
        </article>
      );
    })}
  </section>
);
