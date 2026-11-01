import { BusinessContactInfo, BusinessEnquiry, CustomerReference, Product } from '../types';
import { INITIAL_CUSTOMER_REFERENCES, INITIAL_ENQUIRIES, INITIAL_PRODUCTS, OFFICIAL_BUSINESS_INFO } from '../data/initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'baba_enterprises_products_v1',
  REFERENCES: 'baba_enterprises_references_v1',
  ENQUIRIES: 'baba_enterprises_enquiries_v1',
  CONTACT: 'baba_enterprises_contact_v1',
};

export const StorageService = {
  getProducts(): Product[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fallback
    }
    return INITIAL_PRODUCTS;
  },

  saveProducts(products: Product[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch {
      // Fallback
    }
  },

  getProductBySlug(slug: string): Product | undefined {
    const products = this.getProducts();
    return products.find((p) => p.slug === slug || p.id === slug);
  },

  updateProduct(updated: Product): Product[] {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === updated.id);
    if (index !== -1) {
      products[index] = updated;
      this.saveProducts(products);
    }
    return products;
  },

  addProduct(newProduct: Product): Product[] {
    const products = this.getProducts();
    products.unshift(newProduct);
    this.saveProducts(products);
    return products;
  },

  // Customer References
  getReferences(): CustomerReference[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REFERENCES);
      if (data) {
        const parsed: CustomerReference[] = JSON.parse(data);
        return parsed.map((item) => {
          const init = INITIAL_CUSTOMER_REFERENCES.find((r) => r.id === item.id || r.shortName === item.shortName);
          return {
            ...item,
            logo: item.logo || init?.logo,
            logoAlt: item.logoAlt || init?.logoAlt,
          };
        });
      }
    } catch {
      // Fallback
    }
    return INITIAL_CUSTOMER_REFERENCES;
  },

  saveReferences(references: CustomerReference[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.REFERENCES, JSON.stringify(references));
    } catch {
      // Fallback
    }
  },

  // Business Enquiries
  getEnquiries(): BusinessEnquiry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ENQUIRIES);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fallback
    }
    return INITIAL_ENQUIRIES;
  },

  saveEnquiries(enquiries: BusinessEnquiry[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ENQUIRIES, JSON.stringify(enquiries));
    } catch {
      // Fallback
    }
  },

  createEnquiry(payload: Omit<BusinessEnquiry, 'id' | 'referenceNumber' | 'status' | 'createdAt'>): BusinessEnquiry {
    const enquiries = this.getEnquiries();
    const count = enquiries.length + 845;
    const dateStr = new Date().toISOString().slice(2, 4);
    const refNum = `BE-${dateStr}-${String(count).padStart(4, '0')}`;
    
    const newEnquiry: BusinessEnquiry = {
      ...payload,
      id: 'enq-' + Date.now(),
      referenceNumber: refNum,
      status: 'New',
      createdAt: new Date().toISOString(),
    };

    enquiries.unshift(newEnquiry);
    this.saveEnquiries(enquiries);
    return newEnquiry;
  },

  updateEnquiryStatus(id: string, status: BusinessEnquiry['status'], internalNotes?: string): BusinessEnquiry[] {
    const enquiries = this.getEnquiries();
    const target = enquiries.find((e) => e.id === id);
    if (target) {
      target.status = status;
      if (internalNotes !== undefined) {
        target.internalNotes = internalNotes;
      }
      this.saveEnquiries(enquiries);
    }
    return enquiries;
  },

  deleteEnquiry(id: string): BusinessEnquiry[] {
    let enquiries = this.getEnquiries();
    enquiries = enquiries.filter((e) => e.id !== id);
    this.saveEnquiries(enquiries);
    return enquiries;
  },

  // Contact Info
  getContactInfo(): BusinessContactInfo {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONTACT);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fallback
    }
    return OFFICIAL_BUSINESS_INFO;
  },

  saveContactInfo(info: BusinessContactInfo): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONTACT, JSON.stringify(info));
    } catch {
      // Fallback
    }
  },

  exportEnquiriesToCSV(): string {
    const enquiries = this.getEnquiries();
    const headers = [
      'Reference Number',
      'Date',
      'Status',
      'Company Name',
      'Contact Person',
      'Email',
      'Mobile',
      'Product Category',
      'Quantity Required',
      'Technical Requirements',
      'Drawing Attachment',
      'Message',
      'Internal Notes',
    ];

    const rows = enquiries.map((e) => [
      `"${e.referenceNumber}"`,
      `"${new Date(e.createdAt).toLocaleString('en-IN')}"`,
      `"${e.status}"`,
      `"${(e.companyName || '').replace(/"/g, '""')}"`,
      `"${(e.contactPerson || '').replace(/"/g, '""')}"`,
      `"${e.email}"`,
      `"${e.mobile}"`,
      `"${(e.productCategory || '').replace(/"/g, '""')}"`,
      `"${(e.quantityRequired || '').replace(/"/g, '""')}"`,
      `"${(e.technicalRequirements || '').replace(/"/g, '""')}"`,
      `"${e.drawingFileName || 'None'}"`,
      `"${(e.message || '').replace(/"/g, '""')}"`,
      `"${(e.internalNotes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },
};
