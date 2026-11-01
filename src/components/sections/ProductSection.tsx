import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { Search, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ProductSectionProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onEnquireProduct: (product: Product) => void;
}

export const ProductSection: React.FC<ProductSectionProps> = ({
  products,
  onSelectProduct,
  onEnquireProduct,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { language, t } = useLanguage();

  const categories = [
    { id: 'all', label: language === 'mr' ? 'सर्व घटक' : 'All Components' },
    { id: 'rubber', label: language === 'mr' ? 'रबर मोल्डिंग्स' : 'Rubber Mouldings' },
    { id: 'sealing', label: language === 'mr' ? 'सीलिंग सोल्यूशन्स' : 'Sealing Solutions' },
    { id: 'extruded', label: 'प्रोफाईल्स आणि एक्सट्रूशन्स' },
    { id: 'plastic', label: language === 'mr' ? 'औद्योगिक प्लास्टिक' : 'Industrial Plastic' },
    { id: 'custom', label: language === 'mr' ? 'कस्टम पार्टस्' : 'Customised Parts' },
  ];

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === 'all' || product.category === activeCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.applications.some((app) => app.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

  return (
    <section id="products" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0755A5] uppercase tracking-wider mb-2">
              <span>{t.products.eyebrow}</span>
              <span aria-hidden="true">·</span>
              <span>ENGINEERED ELASTOMERS & PLASTICS</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#102F59] tracking-tight">
              {t.products.title}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              {t.products.subtitle}
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={language === 'mr' ? 'घटक किंवा ॲप्लिकेशन शोधा...' : 'Search components or applications...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5] focus:border-transparent text-slate-900 placeholder:text-slate-400 shadow-xs"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="mt-8 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-[#102F59] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-[#0755A5]/60 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Product Photograph */}
                <div
                  onClick={() => onSelectProduct(product)}
                  className="relative aspect-[4/3] bg-slate-100 overflow-hidden cursor-pointer"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 bg-[#102F59]/80 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded tracking-wide">
                    {product.categoryLabel}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3
                    onClick={() => onSelectProduct(product)}
                    className="font-heading text-lg font-bold text-slate-900 group-hover:text-[#0755A5] transition-colors cursor-pointer"
                  >
                    {product.name}
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {product.shortDescription}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      {language === 'mr' ? 'मुख्य ॲप्लिकेशन्स' : 'Key Applications'}
                    </span>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {product.applications.slice(0, 3).map((app, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-[#168B43] shrink-0" />
                          <span className="truncate">{app}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-5 pt-0 flex items-center gap-2">
                <button
                  onClick={() => onSelectProduct(product)}
                  className="flex-1 py-2 text-center text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  {t.products.viewSpecs}
                </button>
                <button
                  onClick={() => onEnquireProduct(product)}
                  className="flex-1 py-2 text-center text-xs font-semibold text-white bg-[#0755A5] hover:bg-[#102F59] rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>{t.products.requestQuote}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-16 text-center bg-white rounded-xl border border-slate-200 mt-6">
            <p className="text-slate-600 text-sm">
              {language === 'mr' ? 'कोणतेही घटक सापडले नाहीत.' : 'No components found matching your search.'}
            </p>
            <button
              onClick={() => {
                setActiveCategory('all');
                setSearchQuery('');
              }}
              className="mt-3 text-xs font-semibold text-[#0755A5] hover:underline cursor-pointer"
            >
              {language === 'mr' ? 'फिल्टर रीसेट करा' : 'Reset Filters'}
            </button>
          </div>
        )}

        {/* Custom Component Banner */}
        <div className="mt-14 p-6 sm:p-8 rounded-xl bg-[#102F59] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-[#F28C00]" />
              <span>{language === 'mr' ? 'कस्टम इंजिनिअरिंग मागणी' : 'NON-STANDARD ENGINEERING REQUIREMENTS'}</span>
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold">
              {language === 'mr'
                ? 'कस्टम रबर मोल्डिंग किंवा प्लास्टिक भाग हवे आहेत का?'
                : 'Require Custom Rubber Mouldings or Machined Plastic Parts?'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              {language === 'mr'
                ? 'आम्ही तुमच्या नकाशानुसार (CAD 2D/3D), सॅम्पल किंवा तांत्रिक गरजेनुसार थेट कस्टम घटकांची निर्मिती करतो.'
                : 'We fabricate non-standard elastomeric and polymer parts directly against your CAD 2D/3D drawings, physical samples, or application specifications.'}
            </p>
          </div>

          <a
            href="#enquiry"
            className="px-5 py-3 text-xs sm:text-sm font-semibold text-[#102F59] bg-white hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {language === 'mr' ? 'कोटेशनसाठी नकाशा पाठवा' : 'Submit Drawing for Quotation'}
          </a>
        </div>
      </div>
    </section>
  );
};
