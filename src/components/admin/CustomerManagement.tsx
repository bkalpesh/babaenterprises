import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Building2,
  CheckCircle2,
  XCircle,
  Edit2,
  Power,
  Trash2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  User,
} from 'lucide-react';
import { Customer } from '../../types';
import { ApiService } from '../../services/apiService';
import { CustomerModal } from './CustomerModal';

export const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'registered' | 'unregistered'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getCustomers();
      setCustomers(data);
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Failed to load customers' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleCreateCustomer = () => {
    setCustomerToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditCustomer = (cust: Customer) => {
    setCustomerToEdit(cust);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (cust: Customer) => {
    try {
      const res = await ApiService.toggleCustomerActive(cust.id);
      if (res.success && res.customer) {
        const updated = res.customer;
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setNotification({
          type: 'success',
          message: `Customer ${cust.legalName || cust.legal_name} is now ${updated.isActive ? 'Active' : 'Inactive'}.`,
        });
      } else {
        throw new Error(res.error || 'Failed to toggle status');
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Failed to update customer status.' });
    }
  };

  const handleDelete = async (cust: Customer) => {
    const custName = cust.legalName || cust.legal_name || 'Customer';
    const confirmMsg = `Are you sure you want to delete or deactivate "${custName}"? If any quotations or invoices exist, the customer will be deactivated to preserve historical audit trail.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await ApiService.deleteCustomer(cust.id);
      if (res.deactivated) {
        setNotification({
          type: 'success',
          message: `${custName} has existing financial documents. Record was safely deactivated instead of deleted.`,
        });
      } else {
        setNotification({
          type: 'success',
          message: `${custName} was successfully removed.`,
        });
      }
      loadCustomers();
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Failed to delete customer.' });
    }
  };

  // Filter customers
  const filteredCustomers = customers.filter((cust) => {
    const legal = cust.legalName || cust.legal_name || '';
    const trade = cust.tradeName || cust.trade_name || '';
    const gstin = cust.gstin || '';
    const city = cust.city || '';
    const contact = cust.contactPerson || cust.contact_person || '';
    const searchMatch =
      !searchTerm ||
      legal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.toLowerCase().includes(searchTerm.toLowerCase());

    if (!searchMatch) return false;

    const isActive = cust.isActive ?? cust.is_active ?? true;
    const regType = cust.gstRegistrationType || cust.gst_registration_type || 'Regular';

    if (statusFilter === 'active') return isActive;
    if (statusFilter === 'inactive') return !isActive;
    if (statusFilter === 'registered') return (regType === 'Registered' || regType === 'Regular') && !!cust.gstin;
    if (statusFilter === 'unregistered') return regType === 'Unregistered' || !cust.gstin;

    return true;
  });

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {/* Notifications */}
      {notification && (
        <div
          className={`flex flex-col gap-3 rounded-xl border p-3 transition-all sm:flex-row sm:items-center sm:justify-between sm:p-4 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-semibold px-2 py-1 rounded hover:bg-black/5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Controls Header */}
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0755A5]" />
            Customer Master Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage corporate buyers, statutory GSTINs, and billing state codes for quotations and tax invoices
          </p>
        </div>

        <button
          onClick={handleCreateCustomer}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0755A5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#064485] sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add New Customer
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by legal name, trade name, GSTIN, city, contact person..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0755A5]/20 focus:border-[#0755A5]"
          />
        </div>

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
          {(
            [
              { id: 'all', label: 'All Buyers' },
              { id: 'active', label: 'Active Only' },
              { id: 'registered', label: 'Registered GSTIN' },
              { id: 'unregistered', label: 'Unregistered' },
              { id: 'inactive', label: 'Inactive' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition ${
                statusFilter === f.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading Customer Master directory...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No customers found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or filters.'
                : 'Click "Add New Customer" above to create your first buyer profile.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-3 md:hidden">
            {filteredCustomers.map((cust) => (
              <article key={cust.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-bold text-slate-900">{cust.legal_name}</h3>
                    {cust.trade_name && <p className="mt-0.5 break-words text-xs text-slate-500">{cust.trade_name}</p>}
                  </div>
                  <button onClick={() => handleToggleActive(cust)} className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${cust.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{cust.is_active ? 'Active' : 'Inactive'}</button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div><span className="text-slate-500">GSTIN: </span><span className="break-all font-mono font-semibold text-slate-800">{cust.gstin || 'Unregistered / B2C'}</span></div>
                  <div><span className="text-slate-500">Location: </span><span className="text-slate-800">{cust.city || '—'}, {cust.state || 'Maharashtra'} {cust.pincode ? `• ${cust.pincode}` : ''}</span></div>
                  {cust.billing_address && <div className="break-words text-slate-600">{cust.billing_address}</div>}
                  <div><span className="text-slate-500">Contact: </span><span className="text-slate-800">{cust.contact_person || '—'}</span></div>
                  {cust.mobile && <div><span className="text-slate-500">Phone: </span><a className="font-medium text-[#0755A5]" href={`tel:${cust.mobile}`}>{cust.mobile}</a></div>}
                  {cust.email && <div className="break-all"><span className="text-slate-500">Email: </span><a className="font-medium text-[#0755A5]" href={`mailto:${cust.email}`}>{cust.email}</a></div>}
                </div>
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                  <button onClick={() => handleEditCustomer(cust)} className="min-h-10 flex-1 rounded-lg bg-blue-50 px-3 text-xs font-semibold text-[#0755A5]">Edit customer</button>
                  <button onClick={() => handleDelete(cust)} className="min-h-10 rounded-lg bg-red-50 px-3 text-xs font-semibold text-red-700">Deactivate</button>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Entity / Company</th>
                  <th className="py-3 px-4">GSTIN & Type</th>
                  <th className="py-3 px-4">State & Location</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{cust.legal_name}</div>
                      {cust.trade_name && (
                        <div className="text-[11px] text-slate-500 font-medium">{cust.trade_name}</div>
                      )}
                      {cust.billing_address && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                          {cust.billing_address}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {cust.gstin ? (
                        <div>
                          <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {cust.gstin}
                          </span>
                          <div className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Registered Taxpayer
                          </div>
                        </div>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded">
                          Unregistered / B2C
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">
                        {cust.state || 'Maharashtra'}
                        <span className="ml-1 text-[11px] font-mono text-slate-500">
                          ({cust.state_code || '27'})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {cust.city || '—'} {cust.pincode ? `• ${cust.pincode}` : ''}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{cust.contact_person || '—'}</div>
                      {cust.mobile && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {cust.mobile}
                        </div>
                      )}
                      {cust.email && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {cust.email}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(cust)}
                        title="Click to toggle active status"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                          cust.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            cust.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {cust.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEditCustomer(cust)}
                          className="p-1.5 text-slate-500 hover:text-[#0755A5] hover:bg-slate-100 rounded-lg transition"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cust)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Deactivate / Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {filteredCustomers.length} of {customers.length} total customer profiles
          </span>
          <span className="text-[11px] text-slate-400">
            State codes strictly determine intra-state (CGST+SGST) vs inter-state (IGST) tax billing
          </span>
        </div>
      </div>

      {/* Customer Modal */}
      {isModalOpen && (
        <CustomerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          customerToEdit={customerToEdit}
          onSuccess={(saved) => {
            loadCustomers();
            setNotification({
              type: 'success',
              message: `Customer ${saved.legal_name} saved successfully.`,
            });
          }}
        />
      )}
    </div>
  );
};
