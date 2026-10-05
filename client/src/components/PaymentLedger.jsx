import React, { useState } from 'react';
import { fmtMoney, fmtDateSingle, todayISO } from '../utils/format';
import { recordPayment, deletePayment, quickSettleProject } from '../services/api';

const PAYMENT_METHODS = ['UPI', 'Cash', 'Bank Transfer', 'NEFT / RTGS', 'Cheque', 'Card', 'Other'];

export default function PaymentLedger({ isOpen, onClose, project, onRefresh }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('UPI');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !project) return null;

  const budget = parseFloat(project.budget || project.payment) || 0;
  const paid = parseFloat(project.totalPaid || project.paid) || 0;
  const remaining = Math.max(0, budget - paid);
  const isSettled = budget > 0 && paid >= budget;
  const paymentRecords = Array.isArray(project.paymentRecords) ? project.paymentRecords : [];

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!numAmt || numAmt <= 0) {
      setErrorMsg('Enter a valid payment amount');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await recordPayment(project.id, {
        amount: numAmt,
        date: date || todayISO(),
        method,
        note: note.trim()
      });
      setAmount('');
      setNote('');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to log payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSettle = async () => {
    if (remaining <= 0) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await quickSettleProject(project.id);
      if (onRefresh) await onRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to settle balance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePay = async (payId) => {
    if (!window.confirm('Delete this payment installment?')) return;
    try {
      await deletePayment(payId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to delete payment');
    }
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">💳 Payment Ledger</div>
            <div style={{ fontSize: '13px', color: 'var(--accent)', marginTop: '2px' }}>{project.title}</div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {errorMsg && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          {/* Balance Summary Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '14px', background: 'var(--bg-surface-elevated)', borderRadius: '10px', marginBottom: '20px', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>TOTAL QUOTE</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{fmtMoney(budget)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>RECEIVED</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--status-completed)' }}>{fmtMoney(paid)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>REMAINING DUE</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: remaining > 0 ? 'var(--status-pending)' : 'var(--status-completed)' }}>
                {remaining > 0 ? fmtMoney(remaining) : 'Settled ✓'}
              </div>
            </div>
          </div>

          {/* Payment History List */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span className="form-label" style={{ margin: 0 }}>Installment History ({paymentRecords.length})</span>
              {remaining > 0 && (
                <button type="button" className="btn btn-sm btn-ghost" style={{ color: 'var(--accent)', borderColor: 'var(--border-accent)' }} onClick={handleQuickSettle} disabled={submitting}>
                  ⚡ Settle Full Balance ({fmtMoney(remaining)})
                </button>
              )}
            </div>

            {paymentRecords.length === 0 ? (
              <div style={{ padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No payments recorded yet for this shoot.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {paymentRecords.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-surface-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{fmtDateSingle(r.date)}</span>
                      <span className="badge-chip info" style={{ fontSize: '10.5px' }}>{r.method || 'UPI'}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{r.note || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--status-completed)', fontFamily: 'var(--font-mono)' }}>+{fmtMoney(r.amount)}</span>
                      <button type="button" className="btn-icon-del" onClick={() => handleDeletePay(r.id)} title="Delete Payment">
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Record Payment Form */}
          <form onSubmit={handleAddPayment} style={{ padding: '16px', background: 'rgba(217, 164, 99, 0.04)', borderRadius: '10px', border: '1px solid rgba(217, 164, 99, 0.2)' }}>
            <div className="form-label" style={{ marginBottom: '10px', color: 'var(--accent)' }}>+ Record Payment Installment</div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 140px 1fr', gap: '8px', marginBottom: '10px' }}>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="₹ Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <input
                type="date"
                className="form-control"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Reference / Note (e.g. Advance #1, Final UPI 98200...)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={submitting}>
                {submitting ? 'Recording...' : '+ Add Payment'}
              </button>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
