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
  isActive?: boolean;
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
