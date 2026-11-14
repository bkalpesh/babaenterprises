// ==============================================================================
// BABA ENTERPRISES — CLIENT API SERVICE WITH AUDITED OFFLINE FALLBACK
// Connects frontend to Cloudflare Worker / Node backend
// Guarantees: Local fallback NEVER claims server synchronization success
// ==============================================================================

import type { BusinessContactInfo, BusinessEnquiry, CustomerReference, Product, Customer } from '../types/index.ts';
import { StorageService } from './storageService.ts';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('baba_admin_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function mapDBCustomer(c: any): Customer {
  const legalName = c.legal_name || c.legalName || '';
  const tradeName = c.trade_name || c.tradeName || null;
  const gstin = c.gstin || null;
  const billingAddress = c.billing_address || c.billingAddress || '';
  const city = c.city || '';
  const state = c.state || '';
  const stateCode = c.state_code || c.stateCode || '';
  const pincode = c.pincode || '';
  const country = c.country || 'India';
  const contactPerson = c.contact_person || c.contactPerson || '';
  const mobile = c.mobile || '';
  const email = c.email || null;
  const notes = c.notes || null;
  const isActive = c.is_active === 1 || c.is_active === true || c.isActive === true || c.is_active === undefined;
  const regType = c.gst_registration_type || c.gstRegistrationType || (gstin ? 'Regular' : 'Unregistered');
  const pan = c.pan || (gstin && gstin.length >= 12 ? gstin.substring(2, 12) : null);

  return {
    id: c.id,
    legalName,
    tradeName,
    gstin,
    pan,
    gstRegistrationType: regType,
    billingAddress,
    city,
    state,
    stateCode,
    pincode,
    country,
    contactPerson,
    mobile,
    email,
    notes,
    isActive,
    legal_name: legalName,
    trade_name: tradeName,
    gst_registration_type: regType,
    billing_address: billingAddress,
    state_code: stateCode,
    contact_person: contactPerson,
    is_active: isActive,
    createdAt: c.created_at || c.createdAt,
    updatedAt: c.updated_at || c.updatedAt,
  };
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
  customer_id?: string | null;
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
  customer_id?: string | null;
  buyer_name: string; // Legal entity name, same meaning as invoice buyer_name
  buyer_company: string | null; // Trade / operating name, same meaning as invoice buyer_trade_name
  buyer_contact_person?: string | null;
  buyer_gstin: string | null;
  buyer_state_code: string;
  buyer_state_name: string;
  buyer_address: string | null;
  buyer_city?: string | null;
  buyer_pincode?: string | null;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted';
  converted_invoice_id: string | null;
  taxable_amount_paise: number;
  total_tax_paise: number;
  total_amount_paise: number;
  created_at: string;
}

export const ApiService = {
  // ----------------------------------------------------------------------------
  // Products (Database Authoritative)
  // ----------------------------------------------------------------------------
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) {
      throw new Error(`Failed to load products from server (HTTP ${res.status})`);
    }
    const data = (await res.json()) as any;
    if (!data.success || !Array.isArray(data.products)) {
      throw new Error('Invalid product catalogue response from server');
    }
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
      hsnCode: p.hsn_code || p.hsnCode || null,
      unitPricePaise: p.unit_price_paise !== undefined ? Number(p.unit_price_paise) : 0,
      gstRateBps: p.gst_rate_bps !== undefined && p.gst_rate_bps !== null ? Number(p.gst_rate_bps) : null,
      sortOrder: p.sort_order !== undefined ? Number(p.sort_order) : 0,
      isActive: p.is_active === 1 || p.is_active === true || p.isActive === true,
      hsn_code: p.hsn_code || p.hsnCode || null,
      unit_price_paise: p.unit_price_paise !== undefined ? Number(p.unit_price_paise) : 0,
      gst_rate_bps: p.gst_rate_bps !== undefined && p.gst_rate_bps !== null ? Number(p.gst_rate_bps) : null,
      category_label: p.category_label || p.categoryLabel,
      short_description: p.short_description || p.shortDescription || '',
      full_description: p.full_description || p.fullDescription || '',
      image_url: p.image_url || p.image || '',
      is_active: p.is_active ?? 1,
      sort_order: p.sort_order ?? 0,
    }));
  },

  async updateProduct(id: string, payload: Partial<Product>): Promise<{ success: boolean; product?: any; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          name: payload.name,
          unit_price_paise: payload.unitPricePaise !== undefined ? payload.unitPricePaise : payload.unit_price_paise,
          gst_rate_bps: payload.gstRateBps !== undefined ? payload.gstRateBps : (payload.gst_rate_bps !== undefined ? payload.gst_rate_bps : null),
          hsn_code: payload.hsnCode !== undefined ? payload.hsnCode : payload.hsn_code,
          short_description: payload.shortDescription !== undefined ? payload.shortDescription : payload.short_description,
          full_description: payload.fullDescription !== undefined ? payload.fullDescription : payload.full_description,
          is_active: payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : (payload.is_active !== undefined ? payload.is_active : undefined),
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true, product: data.product };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while updating product' };
    }
  },

  async createProduct(payload: Partial<Product>): Promise<{ success: boolean; product?: any; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          name: payload.name,
          slug: payload.slug,
          category: payload.category || 'rubber',
          category_label: payload.categoryLabel || payload.category_label || 'Rubber Components',
          image_url: payload.image || payload.image_url,
          short_description: payload.shortDescription || payload.short_description,
          full_description: payload.fullDescription || payload.full_description,
          hsn_code: payload.hsnCode || payload.hsn_code,
          unit_price_paise: payload.unitPricePaise || payload.unit_price_paise || 0,
          gst_rate_bps: payload.gstRateBps !== undefined ? payload.gstRateBps : payload.gst_rate_bps,
          applications: payload.applications || [],
          materials: payload.materialsSupported || [],
          features: payload.features || [],
          is_active: payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : 1,
          sort_order: payload.sortOrder || payload.sort_order || 0,
        }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true, product: data.product };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while creating product' };
    }
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
  // Customers Master (Billing Directory)
  // ----------------------------------------------------------------------------
  async getCustomers(query?: string, activeOnly?: boolean): Promise<Customer[]> {
    try {
      const params = new URLSearchParams();
      if (query && query.trim()) params.set('q', query.trim());
      if (activeOnly) params.set('active', '1');
      const url = `${API_BASE}/customers${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeader() });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.success && Array.isArray(data.customers)) {
          return data.customers.map(mapDBCustomer);
        }
      }
    } catch {
      // Offline fallback
    }
    return [];
  },

  async getCustomer(id: string): Promise<Customer | null> {
    try {
      const res = await fetch(`${API_BASE}/customers/${id}`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.success && data.customer) {
          return mapDBCustomer(data.customer);
        }
      }
    } catch {}
    return null;
  },

  async createCustomer(payload: any): Promise<{ success: boolean; customer?: Customer; error?: string }> {
    const res = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as any;
    if (data.success && data.customer) {
      return { success: true, customer: mapDBCustomer(data.customer) };
    }
    return { success: false, error: data.error || 'Failed to create customer' };
  },

  async updateCustomer(id: string, payload: any): Promise<{ success: boolean; customer?: Customer; error?: string }> {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as any;
    if (data.success && data.customer) {
      return { success: true, customer: mapDBCustomer(data.customer) };
    }
    return { success: false, error: data.error || 'Failed to update customer' };
  },

  async deleteCustomer(id: string): Promise<{ success: boolean; message?: string; deactivated?: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    const data = (await res.json()) as any;
    return data;
  },

  async toggleCustomerActive(id: string): Promise<{ success: boolean; customer?: Customer; error?: string }> {
    const res = await fetch(`${API_BASE}/customers/${id}/toggle-active`, {
      method: 'PATCH',
      headers: getAuthHeader(),
    });
    const data = (await res.json()) as any;
    if (data.success && data.customer) {
      return { success: true, customer: mapDBCustomer(data.customer) };
    }
    return { success: false, error: data.error || 'Failed to toggle customer status' };
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

  async getQuotation(id: string): Promise<{ success: boolean; quotation?: StagingQuotation; items?: any[]; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/quotations/${id}`, {
        headers: getAuthHeader(),
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        return { success: true, quotation: data.quotation, items: data.items || [] };
      }
      return { success: false, error: data.error || `HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error fetching quotation' };
    }
  },

  async openQuotationPdf(id: string): Promise<{ success: boolean; error?: string }> {
    // Open the tab synchronously so browser popup blockers do not reject the later PDF response.
    const pdfWindow = window.open('about:blank', '_blank');
    if (!pdfWindow) return { success: false, error: 'Allow pop-ups to preview the quotation PDF.' };
    try {
      const res = await fetch(`${API_BASE}/quotations/${encodeURIComponent(id)}/pdf`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        pdfWindow.close();
        return { success: false, error: data.error || `PDF request failed (HTTP ${res.status}).` };
      }
      const blob = await res.blob();
      if (blob.type !== 'application/pdf') {
        pdfWindow.close();
        return { success: false, error: 'The server did not return a PDF document.' };
      }
      const objectUrl = URL.createObjectURL(blob);
      pdfWindow.location.href = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return { success: true };
    } catch (err: any) {
      pdfWindow.close();
      return { success: false, error: err.message || 'Unable to load quotation PDF.' };
    }
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

  async updateQuotation(id: string, payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/quotations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as any;
  },

  async updateQuotationStatus(id: string, payload: { status: string; approval_evidence?: string; rejection_reason?: string; expiry_reason?: string; reason?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/quotations/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as any;
  },

  async sendQuotation(id: string, payload: { dispatch_method?: 'EMAIL' | 'MANUAL'; recipient_email?: string; recipient_name?: string; custom_message?: string; manual_confirmation?: boolean }): Promise<any> {
    const res = await fetch(`${API_BASE}/quotations/${id}/send`, {
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

  async getInvoice(id: string): Promise<{ success: boolean; invoice?: StagingInvoice; items?: any[]; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/invoices/${id}`, {
        headers: getAuthHeader(),
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        return { success: true, invoice: data.invoice, items: data.items || [] };
      }
      return { success: false, error: data.error || `HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error fetching invoice' };
    }
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

  async updateInvoice(id: string, payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/invoices/${id}`, {
      method: 'PUT',
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

  async getInvoiceHtml(invoiceId: string): Promise<string> {
    const res = await fetch(this.getInvoiceHtmlUrl(invoiceId), {
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      let errMsg = `Failed to fetch invoice HTML (${res.status})`;
      try {
        const data = (await res.json()) as any;
        if (data && data.error) errMsg = data.error;
      } catch {
        // Fallback to text
      }
      throw new Error(errMsg);
    }
    return await res.text();
  },

  async printInvoice(invoiceId: string): Promise<void> {
    const html = await this.getInvoiceHtml(invoiceId);
    if (typeof window === 'undefined') return;

    // Secure browser print flow: create Blob URL containing the authorized HTML
    // No JWT or token is ever exposed in the URL.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow) {
      // Fallback: render in hidden iframe for direct printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      iframe.src = blobUrl;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        }, 2000);
      };
      return;
    }

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  },
};
