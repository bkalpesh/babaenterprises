/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HeroSection } from './components/sections/HeroSection';
import { AboutSection } from './components/sections/AboutSection';
import { ProductSection } from './components/sections/ProductSection';
import { IndustriesSection } from './components/sections/IndustriesSection';
import { CustomerReferencesSection } from './components/sections/CustomerReferencesSection';
import { WhyUsSection } from './components/sections/WhyUsSection';
import { QualitySection } from './components/sections/QualitySection';
import { GallerySection } from './components/sections/GallerySection';
import { EnquirySection } from './components/sections/EnquirySection';
import { ContactSection } from './components/sections/ContactSection';
import { ProductDetailModal } from './components/modals/ProductDetailModal';
import { QuotationModal } from './components/modals/QuotationModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StorageService } from './services/storageService';
import { Product, CustomerReference, Industry } from './types';
import { INITIAL_INDUSTRIES } from './data/initialData';

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [references, setReferences] = useState<CustomerReference[]>(() => StorageService.getReferences());
  const [industries] = useState<Industry[]>(INITIAL_INDUSTRIES);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [prefilledEnquiryCategory, setPrefilledEnquiryCategory] = useState<string>('');

  // Handle URL hash routing (e.g. #products/rubber-washers or #admin)
  useEffect(() => {
    const checkHashRoute = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#products/')) {
        const slug = hash.replace('#products/', '');
        const target = StorageService.getProductBySlug(slug);
        if (target) {
          setSelectedProduct(target);
        }
      } else if (hash === '#admin') {
        setIsAdminOpen(true);
      }
    };

    checkHashRoute();
    window.addEventListener('hashchange', checkHashRoute);
    return () => window.removeEventListener('hashchange', checkHashRoute);
  }, []);

  const handleDataChange = useCallback(() => {
    setProducts(StorageService.getProducts());
    setReferences(StorageService.getReferences());
  }, []);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    window.history.pushState(null, '', `#products/${product.slug}`);
  };

  const handleCloseProductModal = () => {
    setSelectedProduct(null);
    if (window.location.hash.startsWith('#products/')) {
      window.history.pushState(null, '', '#products');
    }
  };

  const handleEnquireForProduct = (product: Product) => {
    setPrefilledEnquiryCategory(product.name);
    // Smooth scroll down to enquiry form
    const enquiryElem = document.getElementById('enquiry');
    if (enquiryElem) {
      enquiryElem.scrollIntoView({ behavior: 'smooth' });
    } else {
      setIsQuoteModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#252B33]">
      {/* Top Sticky Navigation */}
      <Navbar
        onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      <main className="flex-1">
        {/* Section 01: Hero & Showcase */}
        <HeroSection
          onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
          products={products}
          onSelectProduct={handleSelectProduct}
        />

        {/* Section 02: About Company */}
        <AboutSection />

        {/* Section 03: Products */}
        <ProductSection
          products={products}
          onSelectProduct={handleSelectProduct}
          onEnquireProduct={handleEnquireForProduct}
        />

        {/* Section 04: Industries */}
        <IndustriesSection industries={industries} />

        {/* Section 05: Customer References */}
        <CustomerReferencesSection references={references} />

        {/* Section 06: Why Choose Us */}
        <WhyUsSection />

        {/* Section 07: Engineering & Quality */}
        <QualitySection onOpenQuoteModal={() => setIsQuoteModalOpen(true)} />

        {/* Section 08: Product Gallery */}
        <GallerySection />

        {/* Section 09: Business Technical Enquiry */}
        <EnquirySection prefilledCategory={prefilledEnquiryCategory} />

        {/* Section 10: Official Contact & Location */}
        <ContactSection />
      </main>

      {/* Section 11: Official Footer */}
      <Footer
        onOpenQuoteModal={() => setIsQuoteModalOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        allProducts={products}
        onClose={handleCloseProductModal}
        onEnquire={handleEnquireForProduct}
        onSelectRelated={handleSelectProduct}
      />

      {/* Quick RFQ Quotation Modal */}
      <QuotationModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        defaultProduct={prefilledEnquiryCategory}
      />

      {/* Administration Portal Modal */}
      <AdminDashboard
        isOpen={isAdminOpen}
        onClose={() => {
          setIsAdminOpen(false);
          if (window.location.hash === '#admin') {
            window.history.pushState(null, '', ' ');
          }
        }}
        onDataChange={handleDataChange}
      />
    </div>
  );
}
