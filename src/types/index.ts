export interface Product {
  id: string;
  name: string;
  slug: string;
  category: 'rubber' | 'plastic' | 'sealing' | 'moulded' | 'custom' | 'extruded';
  categoryLabel: string;
  image: string;
  shortDescription: string;
  fullDescription: string;
  applications: string[];
  materialsSupported: string[];
  features: string[];
  hsnCode?: string | null;
  unitPricePaise?: number;
  gstRateBps?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  // Aliases for DB compatibility
  hsn_code?: string | null;
  unit_price_paise?: number;
  gst_rate_bps?: number | null;
  category_label?: string;
  short_description?: string;
  full_description?: string;
  image_url?: string;
  is_active?: number | boolean;
  sort_order?: number;
}

export interface Industry {
  id: string;
  title: string;
  description: string;
  image: string;
  applications: string[];
  keyComponentsSupplied: string[];
}

export interface CustomerReference {
  id: string;
  name: string;
  shortName: string;
  category: string;
  sector: string;
  isActive: boolean;
  isVerified?: boolean;
  logo?: string;
  logoAlt?: string;
}

export interface BusinessEnquiry {
  id: string;
  referenceNumber: string;
  companyName: string;
  contactPerson: string;
  email: string;
  mobile: string;
  productCategory: string;
  quantityRequired: string;
  technicalRequirements: string;
  message: string;
  drawingFileName?: string;
  drawingFileData?: string;
  status: 'New' | 'Contacted' | 'Quotation Sent' | 'In Discussion' | 'Closed';
  internalNotes?: string;
  createdAt: string;
}

export interface BusinessContactInfo {
  companyName: string;
  category: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  country: string;
  phones: string[];
  gstin: string;
  operatingHours: string;
}

export interface Customer {
  id: string;
  legalName: string;
  tradeName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  gstRegistrationType: 'Regular' | 'Composition' | 'Unregistered' | 'Consumer' | 'Overseas' | 'Registered';
  billingAddress: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  country: string;
  contactPerson: string;
  mobile: string;
  email?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;

  // Aliases for DB / component compatibility
  legal_name?: string;
  trade_name?: string | null;
  gst_registration_type?: any;
  billing_address?: string;
  state_code?: string;
  contact_person?: string;
  is_active?: boolean;
}

