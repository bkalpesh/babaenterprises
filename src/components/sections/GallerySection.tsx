import React, { useState } from 'react';
import { Maximize2, X, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface GalleryItem {
  id: string;
  title: string;
  category: 'rubber' | 'plastic' | 'moulded' | 'sealing';
  categoryLabel: string;
  src: string;
  description: string;
}

export const GallerySection: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const { language, t } = useLanguage();

  const galleryItems: GalleryItem[] = [
    {
      id: 'g-01',
      title: language === 'mr' ? 'रबर वॉशर्स आणि गॅस्केट्स' : 'Rubber Washers & Gaskets',
      category: 'rubber',
      categoryLabel: language === 'mr' ? 'रबर घटक' : 'Rubber Components',
      src: '/assets/aistudio/rubber_washers.jpg',
      description: language === 'mr' ? 'यांत्रिक बोल्ट आणि पाईप फ्लँजसाठी सीलिंग वॉशर्स.' : 'Flat elastomer sealing washers for mechanical bolts, pipe flanges, and electrical boxes.',
    },
    {
      id: 'g-02',
      title: language === 'mr' ? 'व्हायब्रेशन डॅम्पिंग बुशेस' : 'Vibration Damping Bushes',
      category: 'rubber',
      categoryLabel: language === 'mr' ? 'रबर घटक' : 'Rubber Components',
      src: '/assets/aistudio/rubber_bushes_d4fb5aab.jpg',
      description: language === 'mr' ? 'कंपानाचा प्रभाव कमी करण्यासाठी अचूक बुशेस.' : 'Precision cylindrical bushes designed for mechanical shock isolation and pivot joint dampening.',
    },
    {
      id: 'g-03',
      title: language === 'mr' ? 'ओ-रिंग आणि सीलिंग असॉर्टमेंट' : 'O-Rings & Sealing Assortment',
      category: 'sealing',
      categoryLabel: language === 'mr' ? 'सीलिंग सोल्यूशन्स' : 'Sealing Solutions',
      src: '/assets/aistudio/o_rings_4afab30b.jpg',
      description: language === 'mr' ? 'हायड्रोलिक आणि न्युमॅटिक सीलिंगसाठी एनबीआर, व्हिटॉन ओ-रिंग्स.' : 'High-precision elastomeric O-rings in NBR, Viton, and Silicone for hydraulic and pneumatic sealing.',
    },
    {
      id: 'g-04',
      title: language === 'mr' ? 'अकॉर्डियन रबर बेलोज' : 'Accordion Rubber Bellows',
      category: 'rubber',
      categoryLabel: language === 'mr' ? 'रबर घटक' : 'Rubber Components',
      src: '/assets/aistudio/rubber_bellows_936d983a.jpg',
      description: language === 'mr' ? 'मशीनच्या भागांच्या संरक्षणासाठी डस्ट बूट्स आणि बेलोज.' : 'Convoluted dust boots and dynamic expansion bellows for machine ways and cylinder protection.',
    },
    {
      id: 'g-05',
      title: language === 'mr' ? 'इंजिनिअर्ड प्लास्टिक पार्टस्' : 'Engineered Plastic Parts',
      category: 'plastic',
      categoryLabel: language === 'mr' ? 'औद्योगिक प्लास्टिक' : 'Industrial Plastic',
      src: '/assets/aistudio/plastic_components_8af871df.jpg',
      description: language === 'mr' ? 'नायलॉन व डेल्रिनमधील मोल्डेड आणि मशीन केलेले प्लास्टिक घटक.' : 'Moulded and machined polymer wear blocks, insulators, and guide components in POM and Nylon.',
    },
    {
      id: 'g-06',
      title: language === 'mr' ? 'हेवी बफर स्टॉप्स आणि बंपर्स' : 'Heavy Buffer Stops & Bumpers',
      category: 'rubber',
      categoryLabel: language === 'mr' ? 'रबर घटक' : 'Rubber Components',
      src: '/assets/aistudio/rubber_bumpers_d296620e.jpg',
      description: language === 'mr' ? 'मशीनरी आणि क्रेनच्या संरक्षणासाठी इम्पॅक्ट कशन्स.' : 'Conical and cylindrical impact cushions for automated machinery and crane buffer limits.',
    },
    {
      id: 'g-07',
      title: language === 'mr' ? 'कस्टम मोल्डेड रबर कॉम्पोनंट्स' : 'Custom Moulded Rubber Components',
      category: 'moulded',
      categoryLabel: language === 'mr' ? 'कस्टम मोल्डस्' : 'Moulded Parts',
      src: '/assets/aistudio/custom_moulded_parts_14debddf.jpg',
      description: language === 'mr' ? 'ग्राहकांच्या CAD नकाशांनुसार तयार केलेले रबर भाग.' : 'Complex contour moulded rubber parts fabricated to specific buyer CAD drawings and sample moulds.',
    },
    {
      id: 'g-08',
      title: language === 'mr' ? 'रोटरी शाफ्ट सील्स आणि ग्रॉमेट्स' : 'Rotary Shaft Seals & Grommets',
      category: 'sealing',
      categoryLabel: language === 'mr' ? 'सीलिंग सोल्यूशन्स' : 'Sealing Solutions',
      src: '/assets/aistudio/rubber_seals_677f39ec.jpg',
      description: language === 'mr' ? 'ऑइल सील्स आणि केबल पास-थ्रू ग्रॉमेट्स.' : 'Precision radial lip oil seals and cable pass-through grommets for electrical switchboards.',
    },
    {
      id: 'g-09',
      title: language === 'mr' ? 'मशीन केलेले प्लास्टिक स्लीव्हज' : 'Machined Engineering Sleeves',
      category: 'plastic',
      categoryLabel: language === 'mr' ? 'औद्योगिक प्लास्टिक' : 'Industrial Plastic',
      src: '/assets/aistudio/plastic_bushes_39227ab4.jpg',
      description: language === 'mr' ? 'स्वयं-वंगण प्लास्टिक बुशेस आणि स्लीव्हज.' : 'Self-lubricating polymer bushes and bushings turned from cast nylon and Delrin rod stock.',
    },
    {
      id: 'g-10',
      title: language === 'mr' ? 'कंटिन्युअस रबर प्रोफाईल्स' : 'Continuous Rubber Profiles',
      category: 'rubber',
      categoryLabel: language === 'mr' ? 'रबर घटक' : 'Rubber Components',
      src: '/assets/aistudio/rubber_profiles_09b545eb.jpg',
      description: language === 'mr' ? 'दरवाजे आणि एनक्लोजरसाठी एक्सट्रूडेड EPDM प्रोफाईल्स.' : 'Extruded sponge and solid EPDM profiles for enclosure doors and container sealing.',
    },
    {
      id: 'g-11',
      title: language === 'mr' ? 'हेवी मशिनरी माउंटिंग्स' : 'Heavy Machinery Mountings',
      category: 'rubber',
      categoryLabel: language === 'mr' ? 'रबर घटक' : 'Rubber Components',
      src: '/assets/aistudio/rubber_mountings_b27eb86e.jpg',
      description: language === 'mr' ? 'इंजिन व कॉम्प्रेसरसाठी अँटी-व्हायब्रेशन माउंटिंग्स.' : 'Threaded stud anti-vibration mountings for diesel engines, motor bases, and compressors.',
    },
    {
      id: 'g-12',
      title: language === 'mr' ? 'इंडस्ट्रियल कपलिंग्ज आणि स्पायडर्स' : 'Industrial Couplings & Spiders',
      category: 'rubber',
      categoryLabel: language === 'mr' ? 'रबर घटक' : 'Rubber Components',
      src: '/assets/aistudio/rubber_couplings_0ffa30d0.jpg',
      description: language === 'mr' ? 'ड्राइव्ह शाफ्टमधील धक्के शोषण्यासाठी फ्लेक्सिबल स्टार इन्सर्ट्स.' : 'Flexible jaw star inserts for absorbing start-up shock and angular misalignment in drive shafts.',
    },
  ];

  const filteredItems = galleryItems.filter(
    (item) => activeFilter === 'all' || item.category === activeFilter
  );

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImageIndex(null);
  };

  const nextImage = () => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % filteredItems.length);
    }
  };

  const prevImage = () => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex(
        (selectedImageIndex - 1 + filteredItems.length) % filteredItems.length
      );
    }
  };

  return (
    <section id="gallery" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0755A5] uppercase tracking-wider mb-2">
              <Layers className="w-3.5 h-3.5" />
              <span>{t.gallery.eyebrow}</span>
              <span aria-hidden="true">·</span>
              <span>INDEPENDENT COMPONENT VIEWS</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#102F59] tracking-tight">
              {t.gallery.title}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed text-balance">
              {language === 'mr'
                ? 'आमचे रबर वॉशर्स, बुशेस, सील्स, बेलोज आणि प्लास्टिक घटक पाहा. फोटोवर क्लिक करून मोठा फोटो पाहा.'
                : 'Inspect our supplied rubber washers, bushes, seals, bellows, moulded parts, and engineering plastics. Click any photograph to view high-resolution details in lightbox.'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: language === 'mr' ? 'सर्व फोटो' : 'All Items' },
              { id: 'rubber', label: language === 'mr' ? 'रबर' : 'Rubber' },
              { id: 'sealing', label: language === 'mr' ? 'सील्स' : 'Seals & O-Rings' },
              { id: 'plastic', label: language === 'mr' ? 'प्लास्टिक' : 'Plastics' },
              { id: 'moulded', label: language === 'mr' ? 'कस्टम मोल्डस्' : 'Custom Moulds' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activeFilter === f.id
                    ? 'bg-[#102F59] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredItems.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => openLightbox(idx)}
              className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200"
            >
              <img
                src={item.src}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-108"
                loading="lazy"
                referrerPolicy="no-referrer"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#102F59]/90 via-[#102F59]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-4 flex flex-col justify-end text-white">
                <span className="text-[10px] uppercase font-mono tracking-wider text-blue-200 mb-1">
                  {item.categoryLabel}
                </span>
                <h4 className="font-heading text-sm font-bold leading-tight">
                  {item.title}
                </h4>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-200">
                  <span className="text-[11px] text-slate-300 line-clamp-1">{item.description}</span>
                  <Maximize2 className="w-4 h-4 shrink-0 text-white ml-2" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedImageIndex !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
            onClick={closeLightbox}
          >
            <div
              className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800 text-white">
                <div>
                  <span className="text-[11px] font-mono text-[#F28C00] uppercase tracking-wider block">
                    {filteredItems[selectedImageIndex].categoryLabel}
                  </span>
                  <h3 className="font-heading text-lg font-bold">
                    {filteredItems[selectedImageIndex].title}
                  </h3>
                </div>
                <button
                  onClick={closeLightbox}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  aria-label="Close Lightbox"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[65vh] p-4">
                <img
                  src={filteredItems[selectedImageIndex].src}
                  alt={filteredItems[selectedImageIndex].title}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg"
                />

                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-colors"
                  aria-label="Previous Image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-colors"
                  aria-label="Next Image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 text-slate-300 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p>{filteredItems[selectedImageIndex].description}</p>
                <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
                  {selectedImageIndex + 1} of {filteredItems.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
