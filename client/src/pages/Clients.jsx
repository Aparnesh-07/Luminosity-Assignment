import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { getClients, createClient, updateClient, deleteClient } from '../services/api';
import { fmtMoney, fmtDateSingle } from '../utils/format';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getClients({ search });
      setClients(list);
    } catch (e) {
      console.warn('Failed to load clients:', e.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({ name: '', company: '', phone: '', email: '', address: '', notes: '' });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingClient(c);
    setFormData({
      name: c.name || '',
      company: c.company || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Client name is required');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      if (editingClient) {
        await updateClient(editingClient.id, formData);
      } else {
        await createClient(formData);
      }
      setIsModalOpen(false);
      await loadClients();
    } catch (err) {
      setErrorMsg(err.message || 'Error saving client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete client "${c.name}"?`)) return;
    try {
      await deleteClient(c.id);
      await loadClients();
    } catch (err) {
      alert(err.message || 'Failed to delete client');
    }
  };

  return (
    <div className="app-shell">
      <Navbar />

      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}>
              👥 Client Directory
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Manage brand partnerships, producer contacts, and billing details
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="form-control"
              style={{ width: '240px' }}
              placeholder="🔍 Search clients or brands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="btn btn-primary" onClick={handleOpenAdd}>
              + Add Client
            </button>
          </div>
        </div>

        {/* Clients Table Card */}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client / Contact</th>
                <th>Brand / Company</th>
                <th>Phone</th>
                <th>Email</th>
                <th style={{ textAlign: 'center' }}>Shoots</th>
                <th style={{ textAlign: 'right' }}>Total Billed</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading clients...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No client records found. Click <strong>+ Add Client</strong> to create your first client.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{c.name}</strong>
                    </td>
                    <td>{c.company || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{c.phone || '—'}</td>
                    <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge-chip info">{c.project_count || 0}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                      {fmtMoney(c.total_revenue || 0)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleOpenEdit(c)}
                          title="Edit Client"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn-icon-del"
                          onClick={() => handleDelete(c)}
                          title="Delete Client"
                        >
                          &times;
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-title">{editingClient ? '✏️ Edit Client' : '👥 Add New Client'}</div>
              <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Client Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Kirtan Solanki"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Brand / Organization</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Brown Ion"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+91..."
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="client@domain.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Address</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Billing street address, city, pin..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Internal Notes</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Preferences, payment terms, or client history..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingClient ? 'Update Client' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
