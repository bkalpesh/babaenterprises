// ==============================================================================
// BABA ENTERPRISES — CLOUDFLARE WORKER TYPE DEFINITIONS
// ==============================================================================

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: any;
  error?: string;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec<T = unknown>(query: string): Promise<D1Result<T>>;
}

export interface R2PutOptions {
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  body: ReadableStream;
  customMetadata?: Record<string, string>;
  writeHttpMetadata(headers: Headers): void;
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: any): Promise<any>;
}

export interface Fetcher {
  fetch(request: Request | string, requestInit?: any): Promise<Response>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface Env {
  DB: D1Database;
  DOCUMENTS_BUCKET: R2Bucket;
  ASSETS?: Fetcher;
  ENVIRONMENT: string;
  GST_INVOICE_PREFIX: string;
  SELLER_GSTIN: string;
  SELLER_STATE_CODE: string;
  ADMIN_PASSCODE?: string;
  JWT_SECRET?: string;
  STAGING_EMAIL_API_KEY?: string;
}

export interface BusinessSettings {
  id: number;
  legal_name: string;
  trade_name: string;
  gstin: string;
  pan: string;
  state_name: string;
  state_code: string;
  address_line1: string;
  address_line2: string;
  city: string;
  pincode: string;
  phone_primary: string;
  phone_secondary: string;
  email: string;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  default_payment_terms: string | null;
  default_invoice_notes: string | null;
  updated_at: string;
}

export interface DBProduct {
  id: string;
  name: string;
  slug: string;
  category: 'rubber' | 'plastic' | 'sealing' | 'moulded' | 'custom' | 'extruded';
  category_label: string;
  image_url: string | null;
  short_description: string;
  full_description: string;
  hsn_code: string | null;
  unit_price_paise: number;
  gst_rate_bps: number | null; // NULL if unverified
  applications_json: string;
  materials_json: string;
  features_json: string;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DBEnquiry {
  id: string;
  reference_number: string;
  company_name: string;
  contact_person: string;
  email: string;
  mobile: string;
  product_category: string;
  quantity_required: string;
  technical_requirements: string | null;
  message: string | null;
  drawing_file_key: string | null;
  drawing_file_name: string | null;
  drawing_file_size: number | null;
  drawing_content_type: string | null;
  status: 'New' | 'Contacted' | 'Quotation Sent' | 'In Discussion' | 'Closed';
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBInvoice {
  id: string;
  status: 'Draft' | 'Issued' | 'Cancelled';
  invoice_number: string | null;
  invoice_prefix: string;
  sequence_number: number | null;
  invoice_date: string | null;
  financial_year: string;
  seller_gstin: string;
  seller_state_code: string;
  seller_legal_name: string;
  seller_trade_name: string;
  seller_address: string;
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
  customer_id?: string | null;
  payment_status: 'Unpaid' | 'Partially_Paid' | 'Paid';
  payment_mode: string | null;
  payment_reference: string | null;
  payment_received_date: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  pdf_r2_key: string | null;
  pdf_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBCustomer {
  id: string;
  legal_name: string;
  trade_name: string | null;
  gstin: string | null;
  gst_registration_type: 'Regular' | 'Composition' | 'Unregistered' | 'Consumer' | 'Overseas';
  billing_address: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  country: string;
  contact_person: string;
  mobile: string;
  email: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DBInvoiceItem {
  id: string;
  invoice_id: string;
  line_number: number;
  product_id: string | null;
  item_description: string;
  hsn_code: string | null;
  quantity_microunits: number; // e.g. 10 units = 10,000,000 microunits (6 decimals)
  unit_of_measure: string;
  unit_price_paise: number;
  gross_amount_paise: number;
  discount_bps: number; // e.g. 500 = 5.00%
  discount_amount_paise: number;
  taxable_amount_paise: number;
  gst_rate_bps: number | null; // 0, 500, 1200, 1800, 2800 or null if unconfirmed
  cgst_rate_bps: number;
  sgst_rate_bps: number;
  igst_rate_bps: number;
  cgst_amount_paise: number;
  sgst_amount_paise: number;
  igst_amount_paise: number;
  total_amount_paise: number;
}

export interface DBQuotation {
  id: string;
  quotation_number: string | null;
  quotation_prefix?: string;
  sequence_number?: number | null;
  financial_year?: string;
  quotation_date: string;
  valid_until: string;
  buyer_name: string;
  buyer_company: string | null;
  buyer_gstin: string | null;
  buyer_state_code: string;
  buyer_state_name: string;
  buyer_address: string | null;
  buyer_pincode?: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  place_of_supply: string | null;
  customer_id?: string | null;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted';
  converted_invoice_id: string | null;
  client_approval_evidence: string | null;
  accepted_at: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  status_changed_by: string | null;
  currency: string;
  subtotal_gross_paise: number;
  total_discount_paise: number;
  subtotal_amount_paise?: number;
  discount_amount_paise?: number;
  taxable_amount_paise: number;
  cgst_amount_paise: number;
  sgst_amount_paise: number;
  igst_amount_paise: number;
  total_tax_paise: number;
  apply_round_off: number;
  round_off_paise: number;
  total_amount_paise: number;
  payment_terms: string | null;
  delivery_terms: string | null;
  notes: string | null;
  dispatch_id: string | null;
  sent_at: string | null;
  sent_to_recipient: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBCustomerReference {
  id: string;
  name: string;
  short_name: string;
  category: string;
  sector: string;
  logo_url: string | null;
  logo_alt: string | null;
  contact_person: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  buyer_gstin: string | null;
  is_verified: number;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface DBQuotationDispatch {
  id: string;
  quotation_id: string;
  idempotency_key: string;
  recipient_email: string;
  recipient_name: string | null;
  dispatch_status: 'PENDING' | 'TRANSMITTING' | 'ACCEPTED' | 'FAILED' | 'TIMED_OUT' | 'SIMULATED';
  provider_name: string;
  provider_message_id: string | null;
  provider_idempotency_key: string;
  error_message: string | null;
  retry_count: number;
  initiated_at: string;
  completed_at: string | null;
  initiated_by: string;
}

export interface DBQuotationItem {
  id: string;
  quotation_id: string;
  line_number: number;
  product_id: string | null;
  item_description: string;
  hsn_code: string | null;
  quantity_microunits: number;
  unit_of_measure: string;
  unit_price_paise: number;
  gross_amount_paise: number;
  discount_bps: number;
  discount_amount_paise: number;
  taxable_amount_paise: number;
  gst_rate_bps: number | null;
  cgst_rate_bps: number;
  sgst_rate_bps: number;
  igst_rate_bps: number;
  cgst_amount_paise: number;
  sgst_amount_paise: number;
  igst_amount_paise: number;
  total_amount_paise: number;
}
