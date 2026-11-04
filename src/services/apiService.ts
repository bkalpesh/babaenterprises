// ==============================================================================
// BABA ENTERPRISES — CLIENT API SERVICE WITH AUDITED OFFLINE FALLBACK
// Connects frontend to Cloudflare Worker / Node backend
// Guarantees: Local fallback NEVER claims server synchronization success
// ==============================================================================

import { BusinessContactInfo, BusinessEnquiry, CustomerReference, Product } from '../types';
import { StorageService } from './storageService';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = sessionStorage.getItem('baba_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface EnquirySubmissionResult {
  status: 'synced' | 'offline_pending';
  referenceNumber: string;
  isOffline: boolean;
  message: string;
}

export interface StagingInvoice {
  id: string;
  status: 'Draft' | 'Issued' | 'Cancelled';
  invoice_number: string | null;
  invoice_prefix: string;
  sequence_number: number | null;
  invoice_date: string | null;
  financial_year: string;
  seller_gstin: string;
  buyer_name: string | null;
  buyer_trade_name: string | null;
  buyer_address: string | null;
  buyer_city: string | null;
  buyer_state_name: string | null;
  buyer_state_code: string | null;
  buyer_pincode: string | null;
  buyer_gstin: string | null;
  is_interstate: number;
  place_of_supply: string | null;
  reference_quotation_id: string | null;
  subtotal_gross_paise: number;
  total_discount_paise: number;
  taxable_amount_paise: number;
  cgst_amount_paise: number;
  sgst_amount_paise: number;
  igst_amount_paise: number;
  total_tax_paise: number;
  apply_round_off: number;
  round_off_paise: number;
  total_invoice_amount_paise: number;
  payment_status: 'Unpaid' | 'Partially_Paid' | 'Paid';
  cancellation_reason: string | null;
  created_at: string;
}

export interface StagingQuotation {
  id: string;
  quotation_number: string;
  quotation_date: string;
  valid_until: string;
  buyer_name: string;
  buyer_company: string | null;
  buyer_gstin: string | null;
  buyer_state_code: string;
  buyer_state_name: string;
  buyer_address: string | null;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted';
  converted_invoice_id: string | null;
  taxable_amount_paise: number;
  total_tax_paise: number;
  total_amount_paise: number;
  created_at: string;
}

export const ApiService = {
  // ----------------------------------------------------------------------------
  // Products
  // ----------------------------------------------------------------------------
  async getProducts(): Promise<Product[]> {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.success && Array.isArray(data.products) && data.products.length > 0) {
          return data.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            category: p.category,
            categoryLabel: p.category_label || p.categoryLabel,
            image: p.image_url || p.image || '',
            shortDescription: p.short_description || p.shortDescription || '',
            fullDescription: p.full_description || p.fullDescription || '',
            applications: typeof p.applications_json === 'string' ? JSON.parse(p.applications_json) : (p.applications || []),
            materialsSupported: typeof p.materials_json === 'string' ? JSON.parse(p.materials_json) : (p.materialsSupported || []),
            features: typeof p.features_json === 'string' ? JSON.parse(p.features_json) : (p.features || []),
            isActive: p.is_active === 1 || p.isActive === true,
          }));
        }
      }
    } catch {
      // Fallback
    }
    return StorageService.getProducts();
  },

  // ----------------------------------------------------------------------------
  // Enquiries (Audited Offline State Reporting)
  // ----------------------------------------------------------------------------
  async submitEnquiry(payload: {
    companyName: string;
    contactPerson: string;
    email: string;
    mobile: string;
    productCategory: string;
    quantityRequired: string;
    technicalRequirements?: string;
    message?: string;
    drawingFile?: File;
  }): Promise<EnquirySubmissionResult> {
    let drawingFileKey: string | undefined;
    let drawingFileName: string | undefined;
    let drawingFileSize: number | undefined;
    let drawingContentType: string | undefined;

    // 1. Upload CAD drawing to R2 if provided and network is available
    if (payload.drawingFile) {
      try {
        const formData = new FormData();
        formData.append('file', payload.drawingFile);
        const uploadRes = await fetch(`${API_BASE}/upload-drawing`, {
          method: 'POST',
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = (await uploadRes.json()) as any;
          if (uploadData.success) {
            drawingFileKey = uploadData.fileKey;
            drawingFileName = uploadData.fileName;
            drawingFileSize = uploadData.fileSize;
            drawingContentType = uploadData.contentType;
          }
        }
      } catch {
        // Continue to enquiry submission; file will be noted locally
      }
    }

    // 2. Attempt remote server registration
    try {
      const res = await fetch(`${API_BASE}/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: payload.companyName,
          contact_person: payload.contactPerson,
          email: payload.email,
          mobile: payload.mobile,
          product_category: payload.productCategory,
          quantity_required: payload.quantityRequired,
          technical_requirements: payload.technicalRequirements,
          message: payload.message,
          drawing_file_key: drawingFileKey,
          drawing_file_name: drawingFileName || payload.drawingFile?.name,
          drawing_file_size: drawingFileSize || payload.drawingFile?.size,
          drawing_content_type: drawingContentType || payload.drawingFile?.type,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.success && data.referenceNumber) {
          // Successfully synchronized to central server
          StorageService.createEnquiry({
            companyName: payload.companyName,
            contactPerson: payload.contactPerson,
            email: payload.email,
            mobile: payload.mobile,
            productCategory: payload.productCategory,
            quantityRequired: payload.quantityRequired,
            technicalRequirements: payload.technicalRequirements || '',
            message: payload.message || '',
            drawingFileName: drawingFileName || payload.drawingFile?.name,
          });

          return {
            status: 'synced',
            referenceNumber: data.referenceNumber,
            isOffline: false,
            message: 'Your technical enquiry has been registered on the BABA ENTERPRISES central system.',
          };
        }
      }
    } catch {
      // Network failure -> Fallback to local device storage
    }

    // 3. Fallback: Save locally on device with clear OFFLINE status (NEVER claim server success)
    const localEnq = StorageService.createEnquiry({
      companyName: payload.companyName,
      contactPerson: payload.contactPerson,
      email: payload.email,
      mobile: payload.mobile,
      productCategory: payload.productCategory,
      quantityRequired: payload.quantityRequired,
      technicalRequirements: payload.technicalRequirements || '',
      message: payload.message || '',
      drawingFileName: payload.drawingFile?.name,
    });

    return {
      status: 'offline_pending',
      referenceNumber: `OFFLINE-${localEnq.referenceNumber}`,
      isOffline: true,
      message: 'Network connection was unavailable. Your enquiry is saved locally on this device. Please call our sales desk directly at 9028260011 / 8788266934 for immediate priority quotation.',
    };
  },

  // ----------------------------------------------------------------------------
  // Quotations
  // ----------------------------------------------------------------------------
  async getQuotations(): Promise<StagingQuotation[]> {
    try {
      const res = await fetch(`${API_BASE}/quotations`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.success && Array.isArray(data.quotations)) {
          return data.quotations;
        }
      }
    } catch {
      // Offline fallback
    }
    return [];
  },

  async createQuotation(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/quotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as any;
  },

  async convertQuotationToInvoice(quotationId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/quotations/${quotationId}/convert-to-invoice`, {
      method: 'POST',
      headers: getAuthHeader(),
    });
    return (await res.json()) as any;
  },

  // ----------------------------------------------------------------------------
  // Invoices
  // ----------------------------------------------------------------------------
  async getInvoices(): Promise<StagingInvoice[]> {
    try {
      const res = await fetch(`${API_BASE}/invoices`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.success && Array.isArray(data.invoices)) {
          return data.invoices;
        }
      }
    } catch {
      // Offline fallback
    }
    return [];
  },

  async createInvoice(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as any;
  },

  async issueInvoice(invoiceId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/issue`, {
      method: 'POST',
      headers: getAuthHeader(),
    });
    return (await res.json()) as any;
  },

  async cancelInvoice(invoiceId: string, reason: string): Promise<any> {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ reason }),
    });
    return (await res.json()) as any;
  },

  getInvoiceHtmlUrl(invoiceId: string): string {
    return `${API_BASE}/invoices/${invoiceId}/html`;
  },
};
