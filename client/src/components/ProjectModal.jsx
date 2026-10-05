import React, { useState, useEffect } from 'react';
import { fmtMoney, todayISO } from '../utils/format';

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming', color: 'var(--status-upcoming)' },
  { value: 'ongoing', label: 'Ongoing', color: 'var(--status-ongoing)' },
  { value: 'pending', label: 'Payment Pending', color: 'var(--status-pending)' },
  { value: 'completed', label: 'Completed', color: 'var(--status-completed)' }
];

export default function ProjectModal({ isOpen, onClose, onSave, project = null }) {
  const [title, setTitle] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState('upcoming');
  const [priority, setPriority] = useState('medium');
  const [expenseItems, setExpenseItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (project) {
      setTitle(project.title || '');
      setDeliverables(project.deliverables || project.description || '');
      setStartDate(project.startDate || '');
      setEndDate(project.endDate || '');
      setBudget(project.budget || project.payment || '');
      setStatus(project.status || 'upcoming');
      setPriority(project.priority || 'medium');
      setExpenseItems(
        Array.isArray(project.expenseItems) && project.expenseItems.length > 0
          ? project.expenseItems.map((e) => ({
              id: e.id,
              title: e.title || e.category || '',
              amount: e.amount || ''
            }))
          : []
      );
    } else {
      setTitle('');
      setDeliverables('');
      setStartDate(todayISO());
      setEndDate(todayISO());
      setBudget('');
      setStatus('upcoming');
      setPriority('medium');
      setExpenseItems([]);
    }
    setErrorMsg('');
  }, [project, isOpen]);

  if (!isOpen) return null;

  const totalExpenses = expenseItems.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
  const numBudget = parseFloat(budget) || 0;
  const netProfit = numBudget - totalExpenses;
  const marginPct = numBudget > 0 ? Math.round((netProfit / numBudget) * 100) : 0;

  const handleAddExpenseItem = () => {
    setExpenseItems([...expenseItems, { id: Date.now(), title: '', amount: '' }]);
  };

  const handleUpdateExpenseItem = (index, field, value) => {
    const next = [...expenseItems];
    next[index][field] = value;
    setExpenseItems(next);
  };

  const handleRemoveExpenseItem = (index) => {
    setExpenseItems(expenseItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Project title or client is required');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        title: title.trim(),
        deliverables: deliverables.trim(),
        description: deliverables.trim(),
        startDate: startDate || null,
        endDate: endDate || startDate || null,
        budget: numBudget,
        payment: numBudget,
        status,
        priority,
        expenseItems: expenseItems
          .filter((it) => it.title.trim() || parseFloat(it.amount) > 0)
          .map((it) => ({
            title: it.title.trim() || 'General Expense',
            amount: parseFloat(it.amount) || 0
          }))
      };

      await onSave(payload, project?.id);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title">{project ? '✏️ Edit Shoot Details' : '🎬 New Shoot / Production Log'}</div>
          <button type="button" className="btn-icon" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                {errorMsg}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Client &amp; Shoot Title *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Mark Tailor Catalogue Shoot - Videos"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End / Delivery Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Agreed Quotation Fee (₹)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="₹ 50,000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Scope &amp; Deliverables</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="e.g. 2 Commercial Reels, 40 High-Res Photos, Color Grading"
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
              />
            </div>

            {/* Itemized Expenses Builder */}
            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="form-label" style={{ margin: 0 }}>Itemized Production Expenses</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddExpenseItem}>
                  + Add Expense
                </button>
              </div>

              {expenseItems.length === 0 ? (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                  No itemized expenses logged yet. Click "+ Add Expense" to record gear rentals, crew, or travel.
                </div>
              ) : (
                expenseItems.map((item, idx) => (
                  <div key={item.id || idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 32px', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Gear Rental, Crew Fees"
                      value={item.title}
                      onChange={(e) => handleUpdateExpenseItem(idx, 'title', e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="₹ Amount"
                      value={item.amount}
                      onChange={(e) => handleUpdateExpenseItem(idx, 'amount', e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-icon-del"
                      onClick={() => handleRemoveExpenseItem(idx)}
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>
                ))
              )}

              {/* Profit Preview */}
              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontFamily: 'var(--font-mono)' }}>
                <span>Expenses: <strong>{fmtMoney(totalExpenses)}</strong></span>
                <span style={{ color: netProfit >= 0 ? 'var(--status-completed)' : 'var(--danger)' }}>
                  Net Profit: <strong>{fmtMoney(netProfit)}</strong> ({marginPct}%)
                </span>
              </div>
            </div>

            {/* Status Picker */}
            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="form-label">Project Status</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {STATUS_OPTIONS.map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    className={`btn ${status === st.value ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                    style={{
                      borderColor: status === st.value ? undefined : st.color,
                      color: status === st.value ? '#12100e' : st.color
                    }}
                    onClick={() => setStatus(st.value)}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : project ? 'Update Shoot' : 'Create Shoot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
