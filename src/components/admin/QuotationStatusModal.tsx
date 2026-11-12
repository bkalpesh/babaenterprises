import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, Clock, Send, AlertCircle, ShieldAlert } from 'lucide-react';
import { ApiService, StagingQuotation } from '../../services/apiService';

interface QuotationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quotation: StagingQuotation;
}

export const QuotationStatusModal: React.FC<QuotationStatusModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  quotation,
}) => {
  const [targetStatus, setTargetStatus] = useState<'Accepted' | 'Rejected' | 'Expired' | 'Send'>('Accepted');
  const [approvalEvidence, setApprovalEvidence] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [expiryReason, setExpiryReason] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(quotation.buyer_email || '');
  const [recipientName, setRecipientName] = useState(quotation.buyer_name || '');
  const [customMessage, setCustomMessage] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (targetStatus === 'Send') {
        if (!recipientEmail || !recipientEmail.includes('@')) {
          setError('Valid recipient email address is required.');
          setIsSubmitting(false);
          return;
        }

        const res = await ApiService.sendQuotation(quotation.id, {
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          custom_message: customMessage,
        });

        if (res && res.success === false) {
          setError(res.error || 'Failed to dispatch quotation.');
          setIsSubmitting(false);
          return;
        }

        onSuccess();
        onClose();
        return;
      }

      // Status Transition (Accepted, Rejected, Expired)
      const payload: any = { status: targetStatus };

      if (targetStatus === 'Accepted') {
        if (!approvalEvidence || approvalEvidence.trim().length < 10) {
          setError('Transition to Accepted requires client approval evidence (minimum 10 characters, e.g. PO number or confirmation email date).');
          setIsSubmitting(false);
          return;
        }
        payload.approval_evidence = approvalEvidence.trim();
      } else if (targetStatus === 'Rejected') {
        if (!rejectionReason || rejectionReason.trim().length < 5) {
          setError('Transition to Rejected requires a documented rejection reason (minimum 5 characters).');
          setIsSubmitting(false);
          return;
        }
        payload.rejection_reason = rejectionReason.trim();
      } else if (targetStatus === 'Expired') {
        const today = new Date().toISOString().split('T')[0];
        const isPastValidity = quotation.valid_until && quotation.valid_until < today;
        if (!isPastValidity && (!expiryReason || expiryReason.trim().length < 10)) {
          setError(`Quotation validity period (${quotation.valid_until}) has not expired yet. Premature expiration requires documented administrator justification (minimum 10 characters).`);
          setIsSubmitting(false);
          return;
        }
        payload.expiry_reason = expiryReason.trim() || 'VALIDITY_EXPIRED';
      }

      const res = await ApiService.updateQuotationStatus(quotation.id, payload);
      if (res && res.success === false) {
        setError(res.error || 'Failed to update quotation status.');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to execute status change.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0755A5] rounded-lg">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Quotation Status Lifecycle Management</h3>
              <p className="text-xs text-slate-400">
                {quotation.quotation_number} · Current Status: <strong className="text-white">{quotation.status}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quotation Information Summary */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Buyer Entity:</span>
              <span className="font-bold text-slate-900">{quotation.buyer_name} ({quotation.buyer_company || 'N/A'})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Quotation Total:</span>
              <span className="font-mono font-bold text-slate-900">₹{(quotation.total_amount_paise / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Valid Until:</span>
              <span className="font-mono text-slate-700">{quotation.valid_until || 'N/A'}</span>
            </div>
          </div>

          {/* Target Status Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Select Action / Target Status</label>
            <div className="grid grid-cols-2 gap-2">
              {quotation.status === 'Draft' && (
                <button
                  type="button"
                  onClick={() => setTargetStatus('Send')}
                  className={`p-2.5 rounded-lg border text-left text-xs font-bold transition flex items-center gap-2 ${
                    targetStatus === 'Send'
                      ? 'border-[#0755A5] bg-blue-50 text-[#0755A5]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Send className="w-4 h-4 text-[#0755A5]" />
                  <span>Dispatch Quote (Sent)</span>
                </button>
              )}

              {quotation.status === 'Sent' && (
                <>
                  <button
                    type="button"
                    onClick={() => setTargetStatus('Accepted')}
                    className={`p-2.5 rounded-lg border text-left text-xs font-bold transition flex items-center gap-2 ${
                      targetStatus === 'Accepted'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Client Accepted</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('Rejected')}
                    className={`p-2.5 rounded-lg border text-left text-xs font-bold transition flex items-center gap-2 ${
                      targetStatus === 'Rejected'
                        ? 'border-red-600 bg-red-50 text-red-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span>Client Rejected</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('Expired')}
                    className={`p-2.5 rounded-lg border text-left text-xs font-bold transition flex items-center gap-2 ${
                      targetStatus === 'Expired'
                        ? 'border-amber-600 bg-amber-50 text-amber-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Mark Expired</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Conditional Input Fields */}
          {targetStatus === 'Send' && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recipient Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="purchasing@clientcompany.com"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Contact Name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Mr. Purchase Manager"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5]"
                />
              </div>
            </div>
          )}

          {targetStatus === 'Accepted' && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700">
                Client Approval Evidence <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={approvalEvidence}
                onChange={(e) => setApprovalEvidence(e.target.value)}
                placeholder="e.g. Client Purchase Order PO-2026/8841 received via email on 12/11/2026."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5]"
              />
              <p className="text-[11px] text-slate-500">
                Minimum 10 characters required. Documents PO reference, approval email date, or letter reference for audit log.
              </p>
            </div>
          )}

          {targetStatus === 'Rejected' && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700">
                Documented Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Client selected competitor due to delivery lead time requirement."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5]"
              />
              <p className="text-[11px] text-slate-500">
                Minimum 5 characters required for audit permanence.
              </p>
            </div>
          )}

          {targetStatus === 'Expired' && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700">
                Expiry Justification / Reason
              </label>
              <textarea
                rows={3}
                value={expiryReason}
                onChange={(e) => setExpiryReason(e.target.value)}
                placeholder="e.g. Quotation validity period expired without buyer response."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#0755A5]"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0755A5] hover:bg-[#064485] rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Updating Status...' : 'Apply Status Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
