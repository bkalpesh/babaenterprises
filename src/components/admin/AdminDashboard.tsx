import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Unlock,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MessageSquare,
  FileText,
  Trash2,
  Edit2,
  Plus,
  RefreshCw,
  Building2,
  Layers,
  Phone,
  Mail,
  User,
  Shield,
  Save,
  Receipt,
  FileSpreadsheet,
  Printer,
  ExternalLink,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { BusinessContactInfo, BusinessEnquiry, CustomerReference, Product } from '../../types';
import { StorageService } from '../../services/storageService';
import { ApiService, StagingInvoice, StagingQuotation } from '../../services/apiService';
import { CustomerManagement } from './CustomerManagement';
import { QuotationCreateModal } from './QuotationCreateModal';
import { InvoiceCreateModal } from './InvoiceCreateModal';
import { QuotationStatusModal } from './QuotationStatusModal';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChange?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  onDataChange,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('baba_admin_auth') === 'true';
  });
  const [pinCode, setPinCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Tab: 'enquiries' | 'customers' | 'quotations' | 'invoices' | 'products' | 'references' | 'contact'
  const [activeTab, setActiveTab] = useState<'enquiries' | 'customers' | 'quotations' | 'invoices' | 'products' | 'references' | 'contact'>('enquiries');

  // Modals state
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<StagingQuotation | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<StagingInvoice | null>(null);
  const [statusManagingQuotation, setStatusManagingQuotation] = useState<StagingQuotation | null>(null);

  // Enquiries state
  const [enquiries, setEnquiries] = useState<BusinessEnquiry[]>([]);
  const [enquirySearch, setEnquirySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState<BusinessEnquiry | null>(null);

  // Invoices & Quotations state
  const [invoices, setInvoices] = useState<StagingInvoice[]>([]);
  const [quotations, setQuotations] = useState<StagingQuotation[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<StagingInvoice | null>(null);
  const [invoiceActionLoading, setInvoiceActionLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSuccess, setInvoiceSuccess] = useState('');

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productSaveError, setProductSaveError] = useState<string | null>(null);

  // References state
  const [references, setReferences] = useState<CustomerReference[]>([]);
  const [newRefName, setNewRefName] = useState('');
  const [newRefShort, setNewRefShort] = useState('');
  const [newRefSector, setNewRefSector] = useState('');

  // Contact state
  const [contactInfo, setContactInfo] = useState<BusinessContactInfo>(StorageService.getContactInfo());
  const [contactSaved, setContactSaved] = useState(false);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadAllData();
    }
  }, [isOpen, isAuthenticated]);

  const loadProducts = async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const dbProducts = await ApiService.getProducts();
      setProducts(dbProducts);
    } catch (err: any) {
      setProductsError(err.message || 'Failed to load products from database endpoint.');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadAllData = async () => {
    setEnquiries(StorageService.getEnquiries());
    setReferences(StorageService.getReferences());
    setContactInfo(StorageService.getContactInfo());
    loadProducts();
    try {
      const invList = await ApiService.getInvoices();
      setInvoices(invList);
      const qteList = await ApiService.getQuotations();
      setQuotations(qteList);
    } catch {
      // Offline fallback
    }
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode.trim()) {
      setAuthError('Please enter admin passcode.');
      return;
    }
    setIsSubmitting(true);
    setAuthError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passcode: pinCode.trim() }),
      });

      const data = (await response.json()) as any;

      if (response.ok && data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('baba_admin_auth', 'true');
        if (data.token) {
          sessionStorage.setItem('baba_admin_token', data.token);
        }
        setAuthError('');
        setPinCode('');
        loadAllData();
      } else {
        setAuthError(data.error || 'Invalid admin passcode. Access denied.');
      }
    } catch (err) {
      setAuthError('Unable to connect to security server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('baba_admin_auth');
    sessionStorage.removeItem('baba_admin_token');
  };

  // Enquiry Actions
  const handleUpdateStatus = (id: string, status: BusinessEnquiry['status']) => {
    const updated = StorageService.updateEnquiryStatus(id, status);
    setEnquiries([...updated]);
    if (selectedEnquiry && selectedEnquiry.id === id) {
      setSelectedEnquiry({ ...selectedEnquiry, status });
    }
    onDataChange?.();
  };

  const handleSaveNotes = (id: string, notes: string) => {
    const target = enquiries.find((e) => e.id === id);
    if (target) {
      const updated = StorageService.updateEnquiryStatus(id, target.status, notes);
      setEnquiries([...updated]);
      if (selectedEnquiry && selectedEnquiry.id === id) {
        setSelectedEnquiry({ ...selectedEnquiry, internalNotes: notes });
      }
    }
  };

  const handleDeleteEnquiry = (id: string) => {
    if (window.confirm('Are you sure you want to delete this enquiry?')) {
      const updated = StorageService.deleteEnquiry(id);
      setEnquiries([...updated]);
      if (selectedEnquiry?.id === id) {
        setSelectedEnquiry(null);
      }
      onDataChange?.();
    }
  };

  const handleExportCSV = () => {
    const csvContent = StorageService.exportEnquiriesToCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `baba_enterprises_enquiries_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Enquiries
  const filteredEnquiries = enquiries.filter((e) => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchSearch =
      enquirySearch.trim() === '' ||
      e.companyName.toLowerCase().includes(enquirySearch.toLowerCase()) ||
      e.contactPerson.toLowerCase().includes(enquirySearch.toLowerCase()) ||
      e.referenceNumber.toLowerCase().includes(enquirySearch.toLowerCase()) ||
      e.productCategory.toLowerCase().includes(enquirySearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Reference Actions
  const handleAddReference = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefName.trim() || !newRefShort.trim()) return;

    const newRef: CustomerReference = {
      id: 'ref-' + Date.now(),
      name: newRefName.trim(),
      shortName: newRefShort.trim(),
      category: 'Industrial Reference',
      sector: newRefSector.trim() || 'General Engineering',
      isActive: true,
    };

    const updated = [newRef, ...references];
    setReferences(updated);
    StorageService.saveReferences(updated);
    setNewRefName('');
    setNewRefShort('');
    setNewRefSector('');
    onDataChange?.();
  };

  const handleToggleReference = (id: string) => {
    const updated = references.map((r) =>
      r.id === id ? { ...r, isActive: !r.isActive } : r
    );
    setReferences(updated);
    StorageService.saveReferences(updated);
    onDataChange?.();
  };

  // Save Contact
  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveContactInfo(contactInfo);
    setContactSaved(true);
    setTimeout(() => setContactSaved(false), 2500);
    onDataChange?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl max-w-5xl w-full h-[90vh] border border-slate-200 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-[#102F59] text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg px-2.5 py-1.5 shadow-xs shrink-0 max-w-[180px]">
              <img
                src="/assets/aistudio/Baba_Header_b3cf9ca8.png"
                alt="BABA ENTERPRISES"
                className="w-full h-auto object-contain block"
              />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-blue-200">
                  ADMINISTRATION PORTAL
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Enquiry Management, Component Architecture & Business Settings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="text-xs text-blue-200 hover:text-white px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
              >
                Log Out
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close Admin Portal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!isAuthenticated ? (
          /* Authentication Screen */
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-md text-center space-y-6">
              <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs inline-block max-w-[220px] mx-auto">
                <img
                  src="/assets/aistudio/Baba_Header_b3cf9ca8.png"
                  alt="BABA ENTERPRISES"
                  className="w-full h-auto object-contain block"
                />
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-slate-900">
                  Protected Management Desk
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Enter administrative passcode to manage customer RFQs, product records, and registered business
                  details.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <input
                    type="password"
                    placeholder="Enter Admin Passcode"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full text-center px-4 py-2.5 text-sm font-mono tracking-widest rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0755A5] disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  {authError && <p className="mt-1.5 text-xs text-red-600 font-medium leading-normal">{authError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-[#102F59] hover:bg-[#0755A5] disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Passcode...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Unlock Admin Portal</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard Tabs */
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Tab Navigation */}
            <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-6 overflow-x-auto shrink-0">
              <button
                onClick={() => setActiveTab('enquiries')}
                className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === 'enquiries'
                    ? 'border-[#0755A5] text-[#0755A5]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Customer Enquiries ({enquiries.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('customers')}
                className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === 'customers'
                    ? 'border-[#0755A5] text-[#0755A5]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Customers</span>
              </button>

              <button
                onClick={() => setActiveTab('quotations')}
                className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === 'quotations'
                    ? 'border-[#0755A5] text-[#0755A5]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Quotations ({quotations.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('invoices')}
                className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === 'invoices'
                    ? 'border-[#0755A5] text-[#0755A5]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>GST Tax Invoices ({invoices.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('products')}
                className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === 'products'
                    ? 'border-[#0755A5] text-[#0755A5]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Product Catalogue ({products.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('references')}
                className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === 'references'
                    ? 'border-[#0755A5] text-[#0755A5]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Customer References ({references.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('contact')}
                className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === 'contact'
                    ? 'border-[#0755A5] text-[#0755A5]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Phone className="w-4 h-4" />
                <span>Business & Contact Info</span>
              </button>
            </div>

            {/* TAB 1: ENQUIRIES */}
            {activeTab === 'enquiries' && (
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left Enquiry List */}
                <div className="w-full md:w-5/12 border-r border-slate-200 flex flex-col bg-white overflow-hidden">
                  {/* Search and Filters */}
                  <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search company, contact, or ref..."
                        value={enquirySearch}
                        onChange={(e) => setEnquirySearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0755A5]"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {['all', 'New', 'Contacted', 'Quotation Sent', 'In Discussion', 'Closed'].map((st) => (
                          <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`px-2 py-0.5 text-[11px] rounded transition-colors whitespace-nowrap ${
                              statusFilter === st
                                ? 'bg-[#102F59] text-white font-medium'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={handleExportCSV}
                        className="p-1.5 text-slate-600 hover:text-[#0755A5] hover:bg-slate-200 rounded transition-colors shrink-0"
                        title="Download CSV"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* List Container */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredEnquiries.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        No enquiries match the current criteria.
                      </div>
                    ) : (
                      filteredEnquiries.map((enq) => {
                        const isSelected = selectedEnquiry?.id === enq.id;
                        return (
                          <div
                            key={enq.id}
                            onClick={() => setSelectedEnquiry(enq)}
                            className={`p-4 cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/70 border-l-4 border-[#0755A5]' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-mono font-bold text-slate-700">
                                {enq.referenceNumber}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  enq.status === 'New'
                                    ? 'bg-amber-100 text-amber-800'
                                    : enq.status === 'Quotation Sent'
                                    ? 'bg-blue-100 text-blue-800'
                                    : enq.status === 'In Discussion'
                                    ? 'bg-purple-100 text-purple-800'
                                    : enq.status === 'Closed'
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {enq.status}
                              </span>
                            </div>

                            <h4 className="font-heading text-sm font-bold text-slate-900 truncate">
                              {enq.companyName}
                            </h4>

                            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                              <span className="truncate">{enq.contactPerson}</span>
                              <span className="text-[11px] font-mono shrink-0">
                                {new Date(enq.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="mt-2 text-xs text-slate-700 font-medium truncate">
                              {enq.productCategory} · {enq.quantityRequired}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Enquiry Detail View */}
                <div className="flex-1 bg-white p-6 overflow-y-auto">
                  {selectedEnquiry ? (
                    <div className="space-y-6 max-w-2xl">
                      {/* Top Action Bar */}
                      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <div>
                          <span className="text-xs font-mono text-slate-400">REFERENCE NUMBER</span>
                          <h3 className="font-heading text-xl font-bold text-[#102F59]">
                            {selectedEnquiry.referenceNumber}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={selectedEnquiry.status}
                            onChange={(e) =>
                              handleUpdateStatus(selectedEnquiry.id, e.target.value as BusinessEnquiry['status'])
                            }
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="New">Status: New</option>
                            <option value="Contacted">Status: Contacted</option>
                            <option value="Quotation Sent">Status: Quotation Sent</option>
                            <option value="In Discussion">Status: In Discussion</option>
                            <option value="Closed">Status: Closed</option>
                          </select>

                          <button
                            onClick={() => handleDeleteEnquiry(selectedEnquiry.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Enquiry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Contact Specs */}
                      <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div>
                          <span className="text-slate-400 uppercase tracking-wider block">Company</span>
                          <span className="font-bold text-slate-800 text-sm block mt-0.5">
                            {selectedEnquiry.companyName}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase tracking-wider block">Contact Person</span>
                          <span className="font-bold text-slate-800 text-sm block mt-0.5">
                            {selectedEnquiry.contactPerson}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase tracking-wider block">Email</span>
                          <a href={`mailto:${selectedEnquiry.email}`} className="text-[#0755A5] hover:underline font-mono">
                            {selectedEnquiry.email}
                          </a>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase tracking-wider block">Mobile</span>
                          <a href={`tel:${selectedEnquiry.mobile}`} className="font-mono font-bold text-slate-900">
                            +91 {selectedEnquiry.mobile}
                          </a>
                        </div>
                      </div>

                      {/* Requirements */}
                      <div className="space-y-3">
                        <h4 className="font-heading text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Product & Supply Parameters
                        </h4>
                        <div className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Component Category:</span>
                            <span className="font-semibold text-slate-900">{selectedEnquiry.productCategory}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Quantity Required:</span>
                            <span className="font-semibold text-slate-900">{selectedEnquiry.quantityRequired}</span>
                          </div>
                          {selectedEnquiry.technicalRequirements && (
                            <div className="pt-2 border-t border-slate-100">
                              <span className="text-slate-500 block mb-1">Technical Requirements:</span>
                              <p className="text-slate-800 bg-slate-50 p-2.5 rounded font-mono text-xs">
                                {selectedEnquiry.technicalRequirements}
                              </p>
                            </div>
                          )}
                          {selectedEnquiry.message && (
                            <div className="pt-2 border-t border-slate-100">
                              <span className="text-slate-500 block mb-1">Buyer Notes / Message:</span>
                              <p className="text-slate-800">{selectedEnquiry.message}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Attachment View */}
                      {selectedEnquiry.drawingFileName && (
                        <div>
                          <h4 className="font-heading text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                            Attached Drawing / Technical File
                          </h4>
                          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#0755A5]" />
                              <span className="font-medium text-slate-800">{selectedEnquiry.drawingFileName}</span>
                            </div>
                            {selectedEnquiry.drawingFileData && (
                              <a
                                href={selectedEnquiry.drawingFileData}
                                download={selectedEnquiry.drawingFileName}
                                className="px-3 py-1 bg-[#0755A5] text-white rounded text-[11px] font-semibold hover:bg-[#102F59]"
                              >
                                Download Attachment
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Internal Notes */}
                      <div className="space-y-2">
                        <h4 className="font-heading text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Internal Notes & Follow-up Log
                        </h4>
                        <textarea
                          rows={3}
                          placeholder="Log follow-up calls, drawing approvals, or quote numbers..."
                          defaultValue={selectedEnquiry.internalNotes || ''}
                          onBlur={(e) => handleSaveNotes(selectedEnquiry.id, e.target.value)}
                          className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0755A5]"
                        />
                        <span className="text-[11px] text-slate-400 block">
                          Notes auto-save when clicking outside the field.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-center p-8 text-slate-400 text-xs">
                      Select an enquiry from the left list to view technical specifications and update commercial status.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: CUSTOMERS */}
            {activeTab === 'customers' && (
              <div className="flex-1 p-6 overflow-y-auto">
                <CustomerManagement />
              </div>
            )}

            {/* TAB: QUOTATIONS */}
            {activeTab === 'quotations' && (
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-slate-900">
                      Industrial Quotations Desk
                    </h3>
                    <p className="text-xs text-slate-500">
                      Issue formal price offers with dynamic financial year prefixes and convert accepted quotes into GST tax invoices.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setEditingQuotation(null);
                        setIsQuotationModalOpen(true);
                      }}
                      className="px-4 py-2 bg-[#0755A5] hover:bg-[#064485] text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Quotation</span>
                    </button>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                  <span><strong>Statutory Requirement:</strong> Every line item must have a confirmed GST rate (0%, 5%, 12%, 18%, or 28%) and a verified 4-to-8 digit HSN code before a quotation can be dispatched to clients.</span>
                </div>

                {quotations.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
                    No quotations generated yet. Click "Create Quotation" to issue an initial commercial quote.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="p-3">Quotation No.</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Buyer / Company</th>
                          <th className="p-3 text-right">Taxable (₹)</th>
                          <th className="p-3 text-right">Total (₹)</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {quotations.map((q) => (
                          <tr key={q.id} className="hover:bg-slate-50/80">
                            <td className="p-3 font-mono font-bold text-[#102F59]">{q.quotation_number}</td>
                            <td className="p-3 text-slate-500">{q.quotation_date}</td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{q.buyer_name}</div>
                              {q.buyer_company && <div className="text-[11px] text-slate-500">{q.buyer_company}</div>}
                            </td>
                            <td className="p-3 text-right font-mono">₹{(q.taxable_amount_paise / 100).toFixed(2)}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">₹{(q.total_amount_paise / 100).toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                q.status === 'Converted' ? 'bg-purple-100 text-purple-800' :
                                q.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {q.status}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {q.status !== 'Converted' && (
                                  <button
                                    onClick={() => {
                                      setEditingQuotation(q);
                                      setIsQuotationModalOpen(true);
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded flex items-center gap-1 transition-colors"
                                    title="Edit Quotation"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                )}

                                {(q.status === 'Draft' || q.status === 'Sent') && (
                                  <button
                                    onClick={() => setStatusManagingQuotation(q)}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-[#0755A5] text-[11px] font-semibold rounded transition-colors"
                                    title="Manage quotation dispatch or customer decision"
                                  >
                                    {q.status === 'Draft' ? 'Dispatch' : 'Record Decision'}
                                  </button>
                                )}

                                {q.status === 'Accepted' ? (
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(`Convert accepted Quotation ${q.quotation_number} to a Draft GST Tax Invoice?`)) {
                                        const res = await ApiService.convertQuotationToInvoice(q.id);
                                        if (res.success) {
                                          alert('Quotation converted to Draft Invoice successfully!');
                                          loadAllData();
                                          setActiveTab('invoices');
                                        } else {
                                          alert(`Error: ${res.error}`);
                                        }
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded transition-colors"
                                    title="Convert accepted quotation to invoice"
                                  >
                                    Convert
                                  </button>
                                ) : q.status === 'Converted' ? (
                                  <span className="text-[11px] text-purple-700 font-medium">Converted</span>
                                ) : (
                                  <span
                                    className="px-2 py-1 text-[10px] font-medium text-slate-500 bg-slate-100 rounded"
                                    title="A quotation must be sent and accepted before it can be converted"
                                  >
                                    {q.status === 'Draft' ? 'Send for Approval' : 'Awaiting Decision'}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: GST TAX INVOICES */}
            {activeTab === 'invoices' && (
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-slate-900">
                      GST Tax Invoices Master (Prefix: BE/26-27/)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Manage draft tax invoices, allocate immutable sequential numbering, and print statutory GST tax invoices.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingInvoice(null);
                      setIsInvoiceModalOpen(true);
                    }}
                    className="px-4 py-2 bg-[#0755A5] hover:bg-[#064485] text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Draft Invoice</span>
                  </button>
                </div>

                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                  <span><strong>Statutory Compliance Requirement:</strong> All invoice line items must have confirmed GST rates and verified 4-to-8 digit HSN codes before final sequence allocation and issuance. Invoices with unconfirmed items cannot be issued.</span>
                </div>

                {invoices.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
                    No invoices generated yet. Create a Draft Invoice or convert an accepted quotation to begin.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="p-3">Invoice Number</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Buyer Name</th>
                          <th className="p-3">Buyer GSTIN</th>
                          <th className="p-3 text-right">Taxable (₹)</th>
                          <th className="p-3 text-right">Total (₹)</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/80">
                            <td className="p-3 font-mono font-bold text-[#102F59]">
                              {inv.invoice_number || 'DRAFT (Unissued)'}
                            </td>
                            <td className="p-3 text-slate-500">{inv.invoice_date || 'Pending Issuance'}</td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{inv.buyer_name || 'N/A'}</div>
                              <div className="text-[11px] text-slate-500">{inv.buyer_state_name} ({inv.buyer_state_code})</div>
                            </td>
                            <td className="p-3 font-mono text-slate-600">
                              {inv.buyer_gstin || <span className="text-slate-400">URP (B2C)</span>}
                            </td>
                            <td className="p-3 text-right font-mono">₹{(inv.taxable_amount_paise / 100).toFixed(2)}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">₹{(inv.total_invoice_amount_paise / 100).toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.status === 'Issued' ? 'bg-blue-100 text-[#0755A5]' :
                                inv.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {inv.status === 'Draft' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingInvoice(inv);
                                        setIsInvoiceModalOpen(true);
                                      }}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded flex items-center gap-1 transition-colors"
                                      title="Edit Draft Invoice"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>

                                    <button
                                      onClick={async () => {
                                        if (window.confirm('Issue this invoice? This will allocate the next official sequential number (BE/26-27/XXXX) and permanently lock financial details.')) {
                                          try {
                                            const res = await ApiService.issueInvoice(inv.id);
                                            if (res.success) {
                                              alert(`Invoice issued successfully: ${res.invoice.invoice_number}`);
                                              loadAllData();
                                            } else {
                                              alert(`Issuance Error: ${res.error}`);
                                            }
                                          } catch (err: any) {
                                            alert(`Issuance failed: ${err.message}`);
                                          }
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-[#102F59] hover:bg-[#0755A5] text-white text-[11px] font-semibold rounded transition-colors"
                                    >
                                      Issue Invoice
                                    </button>
                                  </>
                                )}

                                {inv.status === 'Issued' && (
                                  <>
                                    <button
                                      onClick={async () => {
                                        try {
                                          await ApiService.printInvoice(inv.id);
                                        } catch (err: any) {
                                          alert(`Failed to load invoice for printing: ${err.message}`);
                                        }
                                      }}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded flex items-center gap-1 transition-colors"
                                      title="Print or Save PDF"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      <span>Print</span>
                                    </button>

                                    <button
                                      onClick={async () => {
                                        const reason = window.prompt('Enter mandatory cancellation reason (min 5 characters):');
                                        if (!reason || reason.trim().length < 5) {
                                          alert('Cancellation cancelled: Reason must be at least 5 characters.');
                                          return;
                                        }
                                        const res = await ApiService.cancelInvoice(inv.id, reason.trim());
                                        if (res.success) {
                                          alert('Invoice cancelled and permanently frozen in audit log.');
                                          loadAllData();
                                        } else {
                                          alert(`Error: ${res.error}`);
                                        }
                                      }}
                                      className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold rounded transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}

                                {inv.status === 'Cancelled' && (
                                  <span className="text-[10px] text-red-600 font-medium italic">
                                    Frozen Record
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PRODUCTS */}
            {activeTab === 'products' && (
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-slate-900">
                      Product Catalogue Master
                    </h3>
                    <p className="text-xs text-slate-500">
                      Database-backed component directory. Updates persist directly to Cloudflare D1.
                    </p>
                  </div>
                  <button
                    onClick={loadProducts}
                    disabled={productsLoading}
                    className="px-3 py-1.5 text-xs font-semibold text-[#0755A5] bg-blue-50 hover:bg-blue-100 rounded-lg transition border border-blue-200"
                  >
                    {productsLoading ? 'Refreshing...' : 'Refresh Catalogue'}
                  </button>
                </div>

                {productsError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
                    <span>{productsError}</span>
                    <button onClick={loadProducts} className="font-bold underline text-red-800">
                      Retry
                    </button>
                  </div>
                )}

                {productsLoading ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    <p className="font-semibold text-slate-700">Loading products from D1 database...</p>
                  </div>
                ) : products.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200">
                    <p className="font-semibold text-slate-700">No products found in the database.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((prod) => {
                      const hsn = prod.hsnCode || prod.hsn_code;
                      const pricePaise = prod.unitPricePaise !== undefined ? prod.unitPricePaise : prod.unit_price_paise;
                      const gstBps = prod.gstRateBps !== undefined && prod.gstRateBps !== null ? prod.gstRateBps : prod.gst_rate_bps;
                      const isActive = prod.isActive ?? prod.is_active ?? true;

                      return (
                        <div
                          key={prod.id}
                          className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              <img
                                src={prod.image || prod.image_url}
                                alt={prod.name}
                                className="w-14 h-14 rounded-lg object-cover bg-slate-100 border border-slate-200"
                              />
                              <div>
                                <h4 className="font-heading text-sm font-bold text-slate-900">{prod.name}</h4>
                                <span className="text-[11px] text-[#0755A5] font-medium">{prod.categoryLabel || prod.category_label}</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 mb-2">{prod.shortDescription || prod.short_description}</p>
                            
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <span>HSN: <strong className="text-slate-800">{hsn || 'Unassigned'}</strong></span>
                              <span>•</span>
                              <span>Rate: <strong className="text-slate-800">{pricePaise && pricePaise > 0 ? `₹${(pricePaise / 100).toFixed(2)}` : 'On Request'}</strong></span>
                              <span>•</span>
                              <span>GST: <strong className="text-slate-800">{gstBps !== undefined && gstBps !== null ? `${gstBps / 100}%` : 'Unconfirmed'}</strong></span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className={isActive ? 'text-emerald-600 font-medium' : 'text-slate-400 font-medium'}>
                              {isActive ? 'Active in Catalogue' : 'Disabled'}
                            </span>
                            <button
                              onClick={() => {
                                setProductSaveError(null);
                                setEditingProduct({ ...prod });
                              }}
                              className="text-[#0755A5] hover:underline font-semibold flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Edit Modal Dialog */}
                {editingProduct && (
                  <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <h4 className="font-heading font-bold text-slate-900">Edit Component Record</h4>
                          <p className="text-[11px] text-slate-500">ID: {editingProduct.id}</p>
                        </div>
                        <button onClick={() => setEditingProduct(null)}>
                          <X className="w-5 h-5 text-slate-400" />
                        </button>
                      </div>

                      {productSaveError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                          {productSaveError}
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Product Name</label>
                        <input
                          type="text"
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">HSN / SAC Code</label>
                          <input
                            type="text"
                            maxLength={8}
                            value={editingProduct.hsnCode || editingProduct.hsn_code || ''}
                            onChange={(e) => setEditingProduct({ ...editingProduct, hsnCode: e.target.value, hsn_code: e.target.value })}
                            placeholder="e.g. 40169990"
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5]"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">Unit Rate (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={((editingProduct.unitPricePaise !== undefined ? editingProduct.unitPricePaise : editingProduct.unit_price_paise) || 0) / 100}
                            onChange={(e) => {
                              const paise = Math.round(Number(e.target.value || 0) * 100);
                              setEditingProduct({ ...editingProduct, unitPricePaise: paise, unit_price_paise: paise });
                            }}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Statutory GST Rate</label>
                        <select
                          value={(editingProduct.gstRateBps !== undefined && editingProduct.gstRateBps !== null) ? String(editingProduct.gstRateBps) : ((editingProduct.gst_rate_bps !== undefined && editingProduct.gst_rate_bps !== null) ? String(editingProduct.gst_rate_bps) : '')}
                          onChange={(e) => {
                            const bps = e.target.value === '' ? null : Number(e.target.value);
                            setEditingProduct({ ...editingProduct, gstRateBps: bps, gst_rate_bps: bps });
                          }}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5] bg-white font-medium"
                        >
                          <option value="">Unconfirmed Statutory Rate</option>
                          <option value="0">0% (Nil)</option>
                          <option value="500">5% (500 bps)</option>
                          <option value="1200">12% (1200 bps)</option>
                          <option value="1800">18% (1800 bps)</option>
                          <option value="2800">28% (2800 bps)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Short Description</label>
                        <textarea
                          rows={2}
                          value={editingProduct.shortDescription || editingProduct.short_description || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, shortDescription: e.target.value, short_description: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5]"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="product_is_active"
                          checked={Boolean(editingProduct.isActive ?? (editingProduct.is_active !== undefined ? Boolean(editingProduct.is_active) : true))}
                          onChange={(e) => setEditingProduct({ ...editingProduct, isActive: e.target.checked, is_active: e.target.checked })}
                          className="rounded text-[#0755A5] focus:ring-[#0755A5]"
                        />
                        <label htmlFor="product_is_active" className="text-xs font-semibold text-slate-700">
                          Active in Catalogue
                        </label>
                      </div>

                      <div className="pt-2 flex justify-end gap-2 border-t">
                        <button
                          type="button"
                          onClick={() => setEditingProduct(null)}
                          className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSavingProduct}
                          onClick={async () => {
                            if (!editingProduct) return;
                            setIsSavingProduct(true);
                            setProductSaveError(null);
                            const res = await ApiService.updateProduct(editingProduct.id, editingProduct);
                            if (res.success) {
                              setEditingProduct(null);
                              await loadProducts();
                              onDataChange?.();
                            } else {
                              setProductSaveError(res.error || 'Failed to update product in database.');
                            }
                            setIsSavingProduct(false);
                          }}
                          className="px-4 py-2 text-xs bg-[#0755A5] text-white font-semibold rounded-lg hover:bg-[#102F59] disabled:opacity-50"
                        >
                          {isSavingProduct ? 'Saving to D1...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: REFERENCES */}
            {activeTab === 'references' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div>
                  <h3 className="font-heading text-lg font-bold text-slate-900">
                    Manage Customer References
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add or toggle enterprise and institution references displayed on the website.
                  </p>
                </div>

                {/* Add Reference Form */}
                <form onSubmit={handleAddReference} className="p-4 rounded-xl bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Full Entity Name *"
                    value={newRefName}
                    onChange={(e) => setNewRefName(e.target.value)}
                    className="px-3 py-2 text-xs border rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Abbreviation (e.g. BHEL) *"
                    value={newRefShort}
                    onChange={(e) => setNewRefShort(e.target.value)}
                    className="px-3 py-2 text-xs border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Sector / Industry Domain"
                    value={newRefSector}
                    onChange={(e) => setNewRefSector(e.target.value)}
                    className="px-3 py-2 text-xs border rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#102F59] hover:bg-[#0755A5] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Reference</span>
                  </button>
                </form>

                {/* Reference Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {references.map((ref) => (
                    <div
                      key={ref.id}
                      className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {ref.logo && (
                          <div className="w-12 h-10 p-1 bg-white border border-slate-200 rounded flex items-center justify-center shrink-0 shadow-xs">
                            <img src={ref.logo} alt={ref.shortName} className="max-h-full max-w-full object-contain" />
                          </div>
                        )}
                        <div>
                          <span className="font-mono text-sm font-bold text-[#0755A5]">{ref.shortName}</span>
                          <h4 className="font-heading text-xs font-bold text-slate-900 mt-0.5">{ref.name}</h4>
                          <span className="text-[11px] text-slate-500 block">{ref.sector}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleReference(ref.id)}
                        className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${
                          ref.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {ref.isActive ? 'Active' : 'Hidden'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: CONTACT & BUSINESS */}
            {activeTab === 'contact' && (
              <div className="flex-1 p-6 overflow-y-auto max-w-2xl">
                <div className="mb-6">
                  <h3 className="font-heading text-lg font-bold text-slate-900">
                    Business Profile & Contact Settings
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verified registered business details in Bhosari, Pune.
                  </p>
                </div>

                <form onSubmit={handleSaveContact} className="space-y-4 bg-white p-6 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Company Name</label>
                    <input
                      type="text"
                      value={contactInfo.companyName}
                      disabled
                      className="w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 text-slate-700"
                    />
                    <span className="text-[11px] text-slate-400">Fixed to verified name: BABA ENTERPRISES</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={contactInfo.gstin}
                      disabled
                      className="w-full px-3 py-2 text-xs border rounded-lg font-mono bg-slate-50 text-slate-700"
                    />
                    <span className="text-[11px] text-slate-400">GSTIN: 27AGCPB8322L1ZG (Maharashtra, Code: 27)</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={contactInfo.addressLine1}
                      onChange={(e) => setContactInfo({ ...contactInfo, addressLine1: e.target.value })}
                      className="w-full px-3 py-2 text-xs border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Address Line 2 (City / Pincode)</label>
                    <input
                      type="text"
                      value={contactInfo.addressLine2}
                      onChange={(e) => setContactInfo({ ...contactInfo, addressLine2: e.target.value })}
                      className="w-full px-3 py-2 text-xs border rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Primary Phone</label>
                      <input
                        type="tel"
                        value={contactInfo.phones[0]}
                        onChange={(e) => {
                          const updated = [...contactInfo.phones];
                          updated[0] = e.target.value;
                          setContactInfo({ ...contactInfo, phones: updated });
                        }}
                        className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Secondary Phone</label>
                      <input
                        type="tel"
                        value={contactInfo.phones[1] || ''}
                        onChange={(e) => {
                          const updated = [...contactInfo.phones];
                          updated[1] = e.target.value;
                          setContactInfo({ ...contactInfo, phones: updated });
                        }}
                        className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Operating Hours</label>
                    <input
                      type="text"
                      value={contactInfo.operatingHours}
                      onChange={(e) => setContactInfo({ ...contactInfo, operatingHours: e.target.value })}
                      className="w-full px-3 py-2 text-xs border rounded-lg"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    {contactSaved ? (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Settings Saved Successfully</span>
                      </span>
                    ) : <span />}

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#102F59] hover:bg-[#0755A5] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Information</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Quotation Creation / Edit Modal */}
        {isQuotationModalOpen && (
          <QuotationCreateModal
            isOpen={isQuotationModalOpen}
            onClose={() => {
              setIsQuotationModalOpen(false);
              setEditingQuotation(null);
            }}
            onSuccess={() => {
              loadAllData();
              setIsQuotationModalOpen(false);
              setEditingQuotation(null);
            }}
            availableProducts={products}
            initialData={editingQuotation}
          />
        )}

        {/* Invoice Creation / Edit Modal */}
        {isInvoiceModalOpen && (
          <InvoiceCreateModal
            isOpen={isInvoiceModalOpen}
            onClose={() => {
              setIsInvoiceModalOpen(false);
              setEditingInvoice(null);
            }}
            onSuccess={() => {
              loadAllData();
              setIsInvoiceModalOpen(false);
              setEditingInvoice(null);
            }}
            availableProducts={products}
            initialData={editingInvoice}
          />
        )}

        {/* Quotation Status Lifecycle Modal */}
        {statusManagingQuotation && (
          <QuotationStatusModal
            isOpen={!!statusManagingQuotation}
            onClose={() => setStatusManagingQuotation(null)}
            onSuccess={() => {
              loadAllData();
              setStatusManagingQuotation(null);
            }}
            quotation={statusManagingQuotation}
          />
        )}
      </div>
    </div>
  );
};
