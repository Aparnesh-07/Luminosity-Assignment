import React, { useState } from 'react';
import { fmtMoney, fmtDateRange, todayISO } from '../utils/format';
import { recordPayment, quickSettleProject } from '../services/api';

const PAYMENT_METHODS = ['UPI', 'Cash', 'Bank Transfer', 'NEFT / RTGS', 'Cheque', 'Card', 'Other'];

export default function PaymentsOverviewModal({ isOpen, onClose, projects = [], onRefresh, onOpenInvoice }) {
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [payInputs, setPayInputs] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  if (!isOpen) return null;

  const pendingProjects = projects.filter((p) => {
    const budget = parseFloat(p.budget || p.payment) || 0;
    const paid = parseFloat(p.totalPaid || p.paid) || 0;
    return budget > paid;
  });

  const settledProjects = projects.filter((p) => {
    const budget = parseFloat(p.budget || p.payment) || 0;
    const paid = parseFloat(p.totalPaid || p.paid) || 0;
    return budget > 0 && paid >= budget;
  });

  const totalPendingSum = pendingProjects.reduce(
    (acc, p) => acc + Math.max(0, (parseFloat(p.budget || p.payment) || 0) - (parseFloat(p.totalPaid || p.paid) || 0)),
    0
  );

  const totalCollectedSum = projects.reduce(
    (acc, p) => acc + (parseFloat(p.totalPaid || p.paid) || 0),
    0
  );

  let displayList = [];
  if (filter === 'pending') displayList = pendingProjects;
  else if (filter === 'settled') displayList = settledProjects;
  else displayList = projects.filter((p) => (parseFloat(p.budget || p.payment) || 0) > 0);

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    displayList = displayList.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.deliverables || '').toLowerCase().includes(q)
    );
  }

  const handleInputChange = (projectId, field, value) => {
    setPayInputs((prev) => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || { date: todayISO(), method: 'UPI', amount: '', note: '' }),
        [field]: value
      }
    }));
  };

  const handleRecord = async (projectId) => {
    const input = payInputs[projectId] || {};
    const amt = parseFloat(input.amount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setActionLoading(true);
    try {
      await recordPayment(projectId, {
        amount: amt,
        date: input.date || todayISO(),
        method: input.method || 'UPI',
        note: input.note || ''
      });
      setPayInputs((prev) => ({ ...prev, [projectId]: undefined }));
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert(err.message || 'Error recording payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSettle = async (projectId) => {
    setActionLoading(true);
    try {
      await quickSettleProject(projectId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      alert(err.message || 'Error settling project');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '850px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">💰 Global Payments &amp; Receivables Hub</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Pending Dues: <strong style={{ color: 'var(--accent)' }}>{fmtMoney(totalPendingSum)}</strong> across {pendingProjects.length} shoots
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Controls Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
            <div className="segmented-group">
              <button
                type="button"
                className={`segment-btn ${filter === 'pending' ? 'active' : ''}`}
                onClick={() => setFilter('pending')}
              >
                Due Receivables ({pendingProjects.length})
              </button>
              <button
                type="button"
                className={`segment-btn ${filter === 'settled' ? 'active' : ''}`}
                onClick={() => setFilter('settled')}
              >
                Settled ({settledProjects.length})
              </button>
              <button
                type="button"
                className={`segment-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Projects ({projects.length})
              </button>
            </div>

            <input
              type="text"
              className="form-control"
              style={{ width: '220px' }}
              placeholder="🔍 Search shoots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Cards List */}
          {displayList.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '16px' }}>
                {filter === 'pending' ? 'All Payments Fully Settled!' : 'No Matching Shoots Found'}
              </div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                {filter === 'pending' ? 'Zero uncollected receivables across your production slate.' : 'Try changing your search query or filter.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {displayList.map((p) => {
                const budget = parseFloat(p.budget || p.payment) || 0;
                const paid = parseFloat(p.totalPaid || p.paid) || 0;
                const remaining = Math.max(0, budget - paid);
                const isSettled = budget > 0 && paid >= budget;
                const currentInputs = payInputs[p.id] || { date: todayISO(), method: 'UPI', amount: remaining > 0 ? remaining : '', note: '' };

                return (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: `1px solid ${isSettled ? 'rgba(104, 187, 118, 0.3)' : 'var(--border-subtle)'}`,
                      borderRadius: '10px',
                      padding: '16px 18px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>{p.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Dates: {fmtDateRange(p.startDate, p.endDate)} &bull; Scope: {p.deliverables || 'Standard'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        <div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>FEE</div>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{fmtMoney(budget)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>PAID</div>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--status-completed)' }}>{fmtMoney(paid)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>DUE</div>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: remaining > 0 ? 'var(--status-pending)' : 'var(--status-completed)' }}>
                            {remaining > 0 ? fmtMoney(remaining) : 'Settled ✓'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Record Installment Bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: '110px 130px 100px 1fr auto auto', gap: '8px', alignItems: 'center', marginTop: '12px' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="₹ Amount"
                        value={currentInputs.amount}
                        onChange={(e) => handleInputChange(p.id, 'amount', e.target.value)}
                      />
                      <input
                        type="date"
                        className="form-control"
                        value={currentInputs.date}
                        onChange={(e) => handleInputChange(p.id, 'date', e.target.value)}
                      />
                      <select
                        className="form-select"
                        value={currentInputs.method}
                        onChange={(e) => handleInputChange(p.id, 'method', e.target.value)}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Note / Ref"
                        value={currentInputs.note}
                        onChange={(e) => handleInputChange(p.id, 'note', e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRecord(p.id)}
                        disabled={actionLoading}
                      >
                        + Log
                      </button>
                      {remaining > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--accent)', borderColor: 'var(--border-accent)' }}
                          onClick={() => handleSettle(p.id)}
                          disabled={actionLoading}
                          title="Settle full balance in 1 click"
                        >
                          ⚡ Settle
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
