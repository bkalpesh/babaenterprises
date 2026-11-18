import React, { useCallback, useEffect, useMemo, useState } from 'react';

type Account = {
  id: string; account_code: string; name: string; parent_account_id: string | null;
  account_type: string; normal_balance: string; is_group: number; is_control_account: number; is_active: number;
};
type Period = { id: string; name: string; start_date: string; end_date: string; status: string; opening_balance_status: string };
type Voucher = { id: string; voucher_number: string; voucher_type: string; voucher_date: string; status: string; narration: string | null };
type TBRow = { id: string; account_code: string; name: string; account_type: string; debit_paise: number; credit_paise: number };
type Party = { id: string; legal_name: string; trade_name: string | null };
type DraftLine = { account_id: string; customer_id: string; supplier_id: string; debit: string; credit: string; description: string };

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0755A5]';
const buttonClass = 'rounded-lg bg-[#102F59] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0755A5] disabled:cursor-not-allowed disabled:opacity-50';
const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format((Number(paise) || 0) / 100);

type AccountingApiResult<T> = { success: boolean; error?: string } & T;

async function accountingFetch<T>(path: string, init?: RequestInit): Promise<AccountingApiResult<T>> {
  const token = sessionStorage.getItem('baba_admin_token');
  const response = await fetch('/api/accounting/' + path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = await response.json().catch(() => ({})) as AccountingApiResult<T>;
  if (!response.ok || !data.success) throw new Error(data.error || 'Accounting request failed.');
  return data;
}

export const AccountingManagement: React.FC = () => {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState('FY2026-27');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [trialBalance, setTrialBalance] = useState<TBRow[]>([]);
  const [tab, setTab] = useState<'overview' | 'accounts' | 'vouchers'>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [voucherDate, setVoucherDate] = useState('2026-04-01');
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { account_id: '', customer_id: '', supplier_id: '', debit: '', credit: '', description: '' },
    { account_id: '', customer_id: '', supplier_id: '', debit: '', credit: '', description: '' },
  ]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [p, a, v, tb, parties] = await Promise.all([
        accountingFetch<{ periods: Period[] }>('periods'),
        accountingFetch<{ accounts: Account[] }>('accounts'),
        accountingFetch<{ vouchers: Voucher[] }>('vouchers?financial_year=' + encodeURIComponent(periodId)),
        accountingFetch<{ accounts: TBRow[] }>('trial-balance?financial_year=' + encodeURIComponent(periodId)),
        accountingFetch<{ customers: Party[]; suppliers: Party[] }>('parties'),
      ]);
      setPeriods(p.periods || []);
      setAccounts(a.accounts || []);
      setCustomers(parties.customers || []);
      setSuppliers(parties.suppliers || []);
      setVouchers(v.vouchers || []);
      setTrialBalance(tb.accounts || []);
    } catch (e: any) { setError(e.message || 'Unable to load accounting data.'); }
    finally { setLoading(false); }
  }, [periodId]);

  useEffect(() => { load(); }, [load]);

  const leafAccounts = useMemo(() => accounts.filter(a => a.is_active === 1 && a.is_group === 0), [accounts]);
  const totalDebit = trialBalance.reduce((sum, row) => sum + Number(row.debit_paise || 0), 0);
  const totalCredit = trialBalance.reduce((sum, row) => sum + Number(row.credit_paise || 0), 0);
  const postedCount = vouchers.filter(v => v.status === 'Posted').length;

  const createBankLedger = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newBankName.trim();
    if (name.length < 3) { setError('Enter a bank name and account type or nickname.'); return; }
    setSavingBank(true); setError(''); setNotice('');
    try {
      const result = await accountingFetch<{ account: Account }>('bank-accounts', {
        method: 'POST', body: JSON.stringify({ name }),
      });
      setNewBankName('');
      setNotice('Bank ledger created: ' + result.account.account_code + ' — ' + result.account.name);
      await load();
    } catch (e: any) { setError(e.message || 'Unable to create bank ledger.'); }
    finally { setSavingBank(false); }
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines(current => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  };

  const addLine = () => setLines(current => current.length >= 20 ? current : [...current, { account_id: '', customer_id: '', supplier_id: '', debit: '', credit: '', description: '' }]);
  const removeLine = (index: number) => setLines(current => current.length <= 2 ? current : current.filter((_, i) => i !== index));

  const createDraft = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const payloadLines = lines.map(line => ({
        account_id: line.account_id,
        customer_id: line.customer_id || null,
        supplier_id: line.supplier_id || null,
        debit_paise: Math.round((Number(line.debit) || 0) * 100),
        credit_paise: Math.round((Number(line.credit) || 0) * 100),
        description: line.description,
      }));
      const result = await accountingFetch<{ voucher: Voucher }>('vouchers', {
        method: 'POST',
        body: JSON.stringify({
          voucher_type: 'JOURNAL', voucher_date: voucherDate, financial_year: periodId,
          narration, lines: payloadLines,
        }),
      });
      setNotice('Draft voucher created: ' + result.voucher.voucher_number);
      setNarration('');
      setLines([{ account_id: '', customer_id: '', supplier_id: '', debit: '', credit: '', description: '' }, { account_id: '', customer_id: '', supplier_id: '', debit: '', credit: '', description: '' }]);
      await load();
      setTab('vouchers');
    } catch (e: any) { setError(e.message || 'Unable to create voucher.'); }
    finally { setSaving(false); }
  };

  const postVoucher = async (id: string) => {
    if (!window.confirm('Post this voucher? Posted vouchers are immutable; corrections require a reversal.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await accountingFetch<{ voucher: Voucher }>('vouchers/' + encodeURIComponent(id) + '/post', { method: 'POST' });
      setNotice('Voucher posted successfully: ' + result.voucher.voucher_number);
      await load();
    } catch (e: any) { setError(e.message || 'Unable to post voucher.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Accounting & Ledger</h2>
          <p className="mt-1 text-xs text-slate-500">Double-entry books · INR · Financial year starting 1 April 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <select className={inputClass + ' min-w-40'} value={periodId} onChange={e => setPeriodId(e.target.value)}>
            {periods.length ? periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="FY2026-27">FY 2026-27</option>}
          </select>
          <button type="button" onClick={load} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700" title="Refresh"><span aria-hidden="true">↻</span></button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</div>}

      <div className="flex gap-2 border-b border-slate-200">
        {(['overview', 'accounts', 'vouchers'] as const).map(item => (
          <button key={item} type="button" onClick={() => setTab(item)} className={'border-b-2 px-3 py-2 text-xs font-semibold capitalize ' + (tab === item ? 'border-[#0755A5] text-[#0755A5]' : 'border-transparent text-slate-500')}>{item === 'overview' ? 'Trial Balance' : item === 'accounts' ? 'Chart of Accounts' : 'Vouchers'}</button>
        ))}
      </div>

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">Loading accounting records…</div> : (
        <>
          {tab === 'overview' && <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[11px] text-slate-500">Ledger accounts</p><p className="mt-1 text-2xl font-bold text-slate-900">{leafAccounts.length}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[11px] text-slate-500">Posted vouchers</p><p className="mt-1 text-2xl font-bold text-slate-900">{postedCount}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[11px] text-slate-500">Trial Balance</p><p className="mt-1 text-lg font-bold text-slate-900">{money(totalDebit)}</p><p className="text-[11px] text-slate-500">Debit total · Credit {money(totalCredit)}</p></div>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-bold text-slate-900">Trial Balance — {periodId}</h3><p className="text-[11px] text-slate-500">Posted vouchers only. Opening balances are not yet entered.</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs">
                <thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">Ledger Account</th><th className="px-4 py-2 text-right">Debit</th><th className="px-4 py-2 text-right">Credit</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{trialBalance.map(row => <tr key={row.id}><td className="px-4 py-2 font-mono">{row.account_code}</td><td className="px-4 py-2">{row.name}</td><td className="px-4 py-2 text-right tabular-nums">{Number(row.debit_paise) ? money(row.debit_paise) : '—'}</td><td className="px-4 py-2 text-right tabular-nums">{Number(row.credit_paise) ? money(row.credit_paise) : '—'}</td></tr>)}</tbody>
                <tfoot className="bg-slate-50 font-bold"><tr><td colSpan={2} className="px-4 py-3">Total</td><td className="px-4 py-3 text-right">{money(totalDebit)}</td><td className="px-4 py-3 text-right">{money(totalCredit)}</td></tr></tfoot>
              </table></div>
              {totalDebit !== totalCredit && <p className="border-t border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Trial Balance is not balanced. Do not rely on financial statements until opening balances and postings are reconciled.</p>}
            </div>
          </>}

          {tab === 'accounts' && <>
            <form onSubmit={createBankLedger} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div><h3 className="text-sm font-bold text-slate-900">Add Bank Ledger</h3><p className="text-[11px] text-slate-500">Create a separate ledger for each bank account. Use a clear name such as “HDFC Bank — Current Account”. Do not enter account numbers here.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className={inputClass} value={newBankName} onChange={e => setNewBankName(e.target.value)} placeholder="Bank name and account type / nickname" maxLength={120} required />
                <button className={buttonClass} disabled={savingBank}>{savingBank ? 'Creating…' : 'Add Bank Ledger'}</button>
              </div>
            </form>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-bold text-slate-900">Chart of Accounts</h3><p className="text-[11px] text-slate-500">System-seeded accounts and separately maintained bank ledgers. Group accounts cannot receive postings.</p></div>
            <div className="divide-y divide-slate-100">{accounts.map(account => <div key={account.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><div><p className="text-xs font-semibold text-slate-800">{account.account_code} · {account.name}</p><p className="text-[10px] text-slate-500">{account.account_type}{account.is_group ? ' · Group' : ''}{account.is_control_account ? ' · Party control' : ''}</p></div><span className={'text-[10px] ' + (account.is_active ? 'text-emerald-700' : 'text-slate-400')}>{account.is_active ? 'Active' : 'Inactive'}</span></div>)}</div>
          </div>}

          {tab === 'vouchers' && <>
            <form onSubmit={createDraft} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div><h3 className="text-sm font-bold text-slate-900">Create Draft Voucher</h3><p className="text-[11px] text-slate-500">General journal entry only. Enter amounts in rupees; debits and credits must balance exactly.</p></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="text-[11px] font-semibold text-slate-600">Voucher type<div className={inputClass + ' mt-1 bg-slate-50'}>Journal</div></div>
                <label className="text-[11px] font-semibold text-slate-600">Date<input className={inputClass + ' mt-1'} type="date" min={periods.find(p => p.id === periodId)?.start_date} max={periods.find(p => p.id === periodId)?.end_date} value={voucherDate} onChange={e => setVoucherDate(e.target.value)} required /></label>
                <label className="text-[11px] font-semibold text-slate-600">Narration<input className={inputClass + ' mt-1'} value={narration} onChange={e => setNarration(e.target.value)} placeholder="Purpose / reference" /></label>
              </div>
              <div className="space-y-2">{lines.map((line, index) => <div key={index} className="grid grid-cols-1 items-end gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[minmax(180px,2fr)_1fr_1fr_auto]">
                <label className="text-[10px] font-semibold text-slate-600">Ledger account<select className={inputClass + ' mt-1'} value={line.account_id} onChange={e => updateLine(index, { account_id: e.target.value, customer_id: '', supplier_id: '' })} required><option value="">Select account</option>{leafAccounts.map(a => <option key={a.id} value={a.id}>{a.account_code} — {a.name}</option>)}</select></label>
                {accounts.find(a => a.id === line.account_id)?.account_code === '1130' && <label className="text-[10px] font-semibold text-slate-600">Customer<select className={inputClass + ' mt-1'} value={line.customer_id} onChange={e => updateLine(index, { customer_id: e.target.value, supplier_id: '' })} required><option value="">Select customer</option>{customers.map(p => <option key={p.id} value={p.id}>{p.trade_name || p.legal_name}</option>)}</select></label>}
                {accounts.find(a => a.id === line.account_id)?.account_code === '2110' && <label className="text-[10px] font-semibold text-slate-600">Supplier<select className={inputClass + ' mt-1'} value={line.supplier_id} onChange={e => updateLine(index, { supplier_id: e.target.value, customer_id: '' })} required><option value="">Select supplier</option>{suppliers.map(p => <option key={p.id} value={p.id}>{p.trade_name || p.legal_name}</option>)}</select></label>}
                <label className="text-[10px] font-semibold text-slate-600">Debit ₹<input className={inputClass + ' mt-1'} type="number" min="0" step="0.01" value={line.debit} onChange={e => updateLine(index, { debit: e.target.value, credit: e.target.value ? '' : line.credit })} /></label>
                <label className="text-[10px] font-semibold text-slate-600">Credit ₹<input className={inputClass + ' mt-1'} type="number" min="0" step="0.01" value={line.credit} onChange={e => updateLine(index, { credit: e.target.value, debit: e.target.value ? '' : line.debit })} /></label>
                <button type="button" onClick={() => removeLine(index)} disabled={lines.length <= 2} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 disabled:opacity-30" aria-label="Remove line">Remove</button>
              </div>)}</div>
              <div className="flex flex-wrap justify-between gap-2"><button type="button" onClick={addLine} disabled={lines.length >= 20} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">+ Add line</button><button className={buttonClass} disabled={saving}>{saving ? 'Saving…' : 'Save Draft Voucher'}</button></div>
            </form>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-bold text-slate-900">Voucher Register</h3></div>
              <div className="divide-y divide-slate-100">{vouchers.length === 0 ? <p className="p-5 text-xs text-slate-500">No vouchers recorded for this financial year.</p> : vouchers.map(v => <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-xs font-semibold text-slate-800">{v.voucher_number}</p><p className="text-[11px] text-slate-500">{v.voucher_type} · {v.voucher_date}{v.narration ? ' · ' + v.narration : ''}</p></div><div className="flex items-center gap-2"><span className={'rounded-full px-2 py-1 text-[10px] font-semibold ' + (v.status === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{v.status}</span>{v.status === 'Draft' && <button type="button" onClick={() => postVoucher(v.id)} disabled={saving} className="rounded-lg border border-[#0755A5] px-3 py-1.5 text-[11px] font-semibold text-[#0755A5]">Post</button>}</div></div>)}</div>
            </div>
          </>}
        </>
      )}
    </div>
  );
};
