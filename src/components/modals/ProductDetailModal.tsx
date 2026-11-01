import React from 'react';
import { Product } from '../../types';
import { X, Check, ArrowRight, ShieldCheck, Layers, Cpu } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ProductDetailModalProps {
  product: Product | null;
  allProducts: Product[];
  onClose: () => void;
  onEnquire: (product: Product) => void;
  onSelectRelated: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  allProducts,
  onClose,
  onEnquire,
  onSelectRelated,
}) => {
  const { t } = useLanguage();

  if (!product) return null;

  const related = allProducts
    .filter((p) => p.id !== product.id && (p.category === product.category || p.category === 'rubber'))
    .slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-md px-2 py-1 shadow-xs border border-slate-200 max-w-[140px]">
              <img
                src="/assets/aistudio/Baba_Header_b3cf9ca8.png"
                alt="BABA ENTERPRISES"
                className="w-full h-auto object-contain block"
              />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0755A5] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {product.categoryLabel}
            </span>
            <span className="hidden sm:inline text-slate-400" aria-hidden="true">·</span>
            <span className="hidden sm:inline text-xs font-mono text-slate-500">{t.productModal.idPrefix} {product.slug}</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Close Product View"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Main Visual & Overview Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2 left-2 bg-[#102F59]/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded">
                {t.productModal.specBadge}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-2xl font-black text-[#102F59] tracking-tight">
                  {product.name}
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {product.fullDescription}
                </p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#0755A5]" />
                  <span>{t.productModal.availPolymer}</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {product.materialsSupported.map((mat) => (
                    <span
                      key={mat}
                      className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200/80 font-medium"
                    >
                      {mat}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    onClose();
                    onEnquire(product);
                  }}
                  className="w-full py-3 px-4 bg-[#0755A5] hover:bg-[#102F59] text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>{t.productModal.reqQuoteBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#0755A5]" />
                <span>{t.productModal.primaryApps}</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-700">
                {product.applications.map((app, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{app}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.productModal.perfNotes}</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-700">
                {product.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#102F59] mt-1.5 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {related.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {t.productModal.relatedTitle}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {related.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => onSelectRelated(rel)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-[#0755A5] hover:bg-slate-50 transition-colors cursor-pointer group flex flex-col items-center text-center"
                  >
                    <div className="w-12 h-12 rounded overflow-hidden mb-2 bg-slate-100">
                      <img
                        src={rel.image}
                        alt={rel.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-[#0755A5] line-clamp-1">
                      {rel.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
