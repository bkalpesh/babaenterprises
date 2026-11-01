import React, { useState, useEffect } from 'react';
import { Menu, X, ShieldAlert, Phone, ChevronRight, Globe } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface NavbarProps {
  onOpenQuoteModal: () => void;
  onOpenAdmin: () => void;
  activeSection?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenQuoteModal, onOpenAdmin }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: t.nav.home, href: '#', isHome: true },
    { label: t.nav.about, href: '#about' },
    { label: t.nav.products, href: '#products' },
    { label: t.nav.industries, href: '#industries' },
    { label: t.nav.quality, href: '#quality' },
    { label: t.nav.gallery, href: '#gallery' },
    { label: t.nav.contact, href: '#contact' },
  ];

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    if (href === '#') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const elem = document.querySelector(href);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-200 ${
        isScrolled
          ? 'shadow-md py-2 sm:py-2.5 border-b border-slate-200/90'
          : 'py-2.5 sm:py-3.5 border-b border-slate-200/60 shadow-xs'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 sm:gap-4 min-h-[64px] sm:min-h-[72px] lg:min-h-[82px]">
          {/* Logo */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('#');
            }}
            className="flex items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0755A5] rounded-md transition-opacity hover:opacity-95 py-1"
            aria-label="BABA ENTERPRISES Home"
          >
            <img
              src="/assets/aistudio/Baba_Header_b3cf9ca8.png"
              alt="BABA ENTERPRISES - Industrial Rubber & Plastic Components"
              className="w-[170px] xs:w-[195px] sm:w-[215px] md:w-[275px] xl:w-[340px] 2xl:w-[350px] h-auto object-contain block"
              loading="eager"
            />
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden xl:flex items-center gap-5 2xl:gap-7 text-sm font-semibold text-slate-700">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className={`relative py-1 transition-colors ${
                  link.isHome
                    ? 'text-[#1b5bb8] font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#1b5bb8] after:rounded-full'
                    : 'text-slate-700 hover:text-[#1b5bb8]'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Right Controls (Language Switcher, Phone, CTA, Admin) */}
          <div className="hidden lg:flex items-center gap-4 2xl:gap-5 shrink-0">
            {/* Desktop Language Switcher */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-100 text-xs font-bold">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-[#0c2444] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label="Switch to English"
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('mr')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  language === 'mr'
                    ? 'bg-[#0c2444] text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
                aria-label="मराठी भाषेवर स्विच करा"
              >
                मराठी
              </button>
            </div>

            {/* Phone Contact Block */}
            <div className="flex items-center gap-2.5 text-left">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#1b5bb8]">
                <Phone className="w-4 h-4 fill-[#1b5bb8]/20" />
              </div>
              <div className="flex flex-col text-xs font-heading font-bold text-[#0c2444] leading-tight">
                <a href="tel:9028260011" className="hover:text-[#1b5bb8] transition-colors tabular-nums">
                  9028260011
                </a>
                <a href="tel:8788266934" className="hover:text-[#1b5bb8] transition-colors tabular-nums">
                  8788266934
                </a>
              </div>
            </div>

            {/* Request a Quote CTA */}
            <button
              onClick={onOpenQuoteModal}
              className="px-4 xl:px-5 py-2.5 text-xs font-bold text-white bg-[#0c2444] hover:bg-[#071930] rounded-lg shadow-sm hover:shadow transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 uppercase tracking-wider cursor-pointer"
            >
              <span>{t.nav.requestQuote}</span>
              <ChevronRight className="w-4 h-4 text-white" />
            </button>

            {/* Admin portal icon */}
            <button
              onClick={onOpenAdmin}
              className="p-2 text-slate-400 hover:text-[#0c2444] hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
              title={t.nav.admin}
              aria-label={t.nav.admin}
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile & Tablet Header Controls */}
          <div className="flex lg:hidden items-center gap-2">
            {/* Mobile Header Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'mr' : 'en')}
              className="flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-[#0c2444] active:bg-slate-200 transition-colors"
              aria-label="Toggle Language"
            >
              <Globe className="w-3.5 h-3.5 text-[#1b5bb8]" />
              <span>{language === 'en' ? 'मराठी' : 'EN'}</span>
            </button>

            {/* Quick Phone Call */}
            <a
              href="tel:9028260011"
              className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#1b5bb8] active:bg-blue-100 transition-colors"
              aria-label="Call Baba Enterprises"
            >
              <Phone className="w-3.5 h-3.5 fill-[#1b5bb8]/20" />
            </a>

            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 bg-[#0c2444] text-white hover:bg-[#071930] rounded-lg transition-colors focus:outline-none shadow-xs cursor-pointer"
              aria-label="Toggle Navigation Menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 shadow-xl px-5 pt-4 pb-6 animate-in slide-in-from-top-2 duration-200">
          <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.nav.switchLang === 'EN' ? 'भाषा निवडा (Language)' : 'Select Language'}
            </span>
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-100 text-xs font-bold">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded-md transition-all ${
                  language === 'en' ? 'bg-[#0c2444] text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('mr')}
                className={`px-3 py-1 rounded-md transition-all ${
                  language === 'mr' ? 'bg-[#0c2444] text-white shadow-xs font-semibold' : 'text-slate-600'
                }`}
              >
                मराठी
              </button>
            </div>
          </div>

          <nav className="flex flex-col gap-2.5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className={`text-base font-semibold py-2 px-3 rounded-md transition-colors ${
                  link.isHome
                    ? 'bg-blue-50 text-[#1b5bb8] font-bold'
                    : 'text-slate-800 hover:bg-slate-50 hover:text-[#1b5bb8]'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-3">
            <div className="text-xs text-slate-500 font-medium">Direct Contact:</div>
            <div className="flex flex-col gap-1 text-sm font-bold text-[#0c2444]">
              <a href="tel:9028260011" className="flex items-center gap-2 hover:text-[#1b5bb8]">
                <Phone className="w-4 h-4 text-[#1b5bb8]" />
                <span className="font-mono">9028260011</span>
              </a>
              <a href="tel:8788266934" className="flex items-center gap-2 hover:text-[#1b5bb8]">
                <Phone className="w-4 h-4 text-[#1b5bb8]" />
                <span className="font-mono">8788266934</span>
              </a>
            </div>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenQuoteModal();
              }}
              className="mt-2 w-full py-3 text-center text-xs font-bold text-white bg-[#0c2444] active:bg-[#071930] rounded-lg uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <span>{t.nav.requestQuote}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenAdmin();
              }}
              className="mt-1 text-xs text-slate-500 hover:text-slate-800 text-center py-1.5 cursor-pointer"
            >
              {t.nav.admin}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
