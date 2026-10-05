import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getNextInvoiceNumber,
  getSettings,
  updateSettings,
  uploadLogo,
  deleteLogo,
  resetSequenceCounter
} from '../services/api';
import { fmtMoney, fmtDateSingle, todayISO } from '../utils/format';

const MIN_ROWS = 8;

export default function Invoices() {
  const location = useLocation();
  const sheetRef = useRef(null);

  // Active Sidebar Tab: 'editor' | 'defaults' | 'database'
  const [activeTab, setActiveTab] = useState('editor');

  // Studio Settings
  const [settings, setSettings] = useState({
    companyName: 'Luminav Films',
    companyAddress: 'Godrej Garden City\nAhmedabad\n382470\ninfo@luminavfilms.com',
    companyPhone: '',
    companyEmail: '',
    currency: '₹',
    logoUrl: '',
    terms:
      'All deliverables are provided as per the agreed project scope.\n' +
      'Any additional revisions or services beyond the agreed scope may be charged separately.\n' +
      'This invoice confirms that full payment has been received and the project has been successfully completed.'
  });

  // Current Invoice State
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [billName, setBillName] = useState('');
  const [billCompany, setBillCompany] = useState('');
  const [billPhone, setBillPhone] = useState('');
  const [billEmail, setBillEmail] = useState('');
  const [projectScope, setProjectScope] = useState('');
  const [items, setItems] = useState([
    { key: '1', description: 'Content Shoot (Photo + Video)', qty: 1, price: 15000 }
  ]);
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);

  // Database Tab state
  const [savedInvoices, setSavedInvoices] = useState([]);
  const [dbSearch, setDbSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Load Settings & Invoices on Mount
  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s) {
          setSettings((prev) => ({
            ...prev,
            companyName: s.companyName || prev.companyName,
            companyAddress: s.companyAddress || prev.companyAddress,
            companyPhone: s.companyPhone || prev.companyPhone,
            companyEmail: s.companyEmail || prev.companyEmail,
            currency: s.currency || prev.currency,
            logoUrl: s.logoUrl || prev.logoUrl,
            terms: s.terms || prev.terms
          }));
        }
      })
      .catch((e) => console.warn('Could not load settings:', e.message));

    loadInvoiceDatabase();
  }, []);

  // Fetch next sequential number or prefill from Dashboard navigation
  useEffect(() => {
    const fromProject = location.state?.fromProject;
    if (fromProject) {
      setBillName(fromProject.clientName || fromProject.title);
      setProjectScope(fromProject.projectScope || fromProject.title);
      setInvoiceDate(fromProject.date || todayISO());
      if (fromProject.payment) {
        setItems([
          {
            key: 'proj_item_1',
            description: fromProject.projectScope || fromProject.title,
            qty: 1,
            price: fromProject.payment
          }
        ]);
      }
      if (fromProject.paid) {
        setAdvance(fromProject.paid);
      }
    }

    getNextInvoiceNumber(todayISO())
      .then((res) => {
        if (res?.invoiceNumber) setInvoiceId(res.invoiceNumber);
      })
      .catch(() => {});
  }, [location.state]);

  const loadInvoiceDatabase = async () => {
    try {
      const list = await getInvoices();
      setSavedInvoices(list);
    } catch (e) {
      console.warn('Could not load invoices list:', e.message);
    }
  };

  // Calculation helpers
  const subtotal = items.reduce(
    (acc, it) => acc + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0),
    0
  );
  const numDiscount = parseFloat(discount) || 0;
  const numAdvance = parseFloat(advance) || 0;
  const total = Math.max(0, subtotal - numDiscount - numAdvance);

  // Line Item Handlers
  const handleAddItem = () => {
    setItems([
      ...items,
      { key: `item_${Date.now()}`, description: '', qty: 1, price: 0 }
    ]);
  };

  const handleUpdateItem = (index, field, value) => {
    const next = [...items];
    next[index][field] = value;
    setItems(next);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // New Invoice Reset
  const handleNewInvoice = async () => {
    try {
      const res = await getNextInvoiceNumber(todayISO());
      setInvoiceId(res.invoiceNumber);
    } catch (e) {}
    setInvoiceDate(todayISO());
    setBillName('');
    setBillCompany('');
    setBillPhone('');
    setBillEmail('');
    setProjectScope('');
    setItems([{ key: `item_${Date.now()}`, description: '', qty: 1, price: 0 }]);
    setDiscount(0);
    setAdvance(0);
    setActiveTab('editor');
    showToast('Started new invoice draft');
  };

  // Save to MySQL
  const handleSaveInvoice = async () => {
    if (!billName.trim() && !billCompany.trim()) {
      alert('Please enter client or company name');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id: invoiceId,
        date: invoiceDate,
        billName,
        billCompany,
        billPhone,
        billEmail,
        projectScope,
        items,
        discount: numDiscount,
        advance: numAdvance,
        terms: settings.terms,
        status: 'sent'
      };

      const existing = savedInvoices.find((i) => i.invoiceNumber === invoiceId);
      if (existing) {
        await updateInvoice(invoiceId, payload);
        showToast(`Invoice #${invoiceId} updated in MySQL`);
      } else {
        const created = await createInvoice(payload);
        if (created?.invoiceNumber) setInvoiceId(created.invoiceNumber);
        showToast(`Invoice #${invoiceId} saved permanently in MySQL`);
      }

      await loadInvoiceDatabase();
    } catch (err) {
      alert(err.message || 'Error saving invoice');
    } finally {
      setIsSaving(false);
    }
  };

  // Load from DB
  const handleLoadInvoice = (inv) => {
    setInvoiceId(inv.invoiceNumber);
    setInvoiceDate(inv.date);
    setBillName(inv.billName || '');
    setBillCompany(inv.billCompany || '');
    setBillPhone(inv.billPhone || '');
    setBillEmail(inv.billEmail || '');
    setProjectScope(inv.projectScope || '');
    setItems(
      Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items.map((it) => ({
            key: it.key || `it_${it.id}`,
            description: it.description,
            qty: it.qty,
            price: it.price
          }))
        : [{ key: 'item_1', description: '', qty: 1, price: 0 }]
    );
    setDiscount(inv.discount || 0);
    setAdvance(inv.advance || 0);
    setActiveTab('editor');
    showToast(`Loaded Invoice #${inv.invoiceNumber}`);
  };

  // Delete from DB
  const handleDeleteInvoice = async (invId) => {
    if (!window.confirm(`Delete Invoice #${invId}?`)) return;
    try {
      await deleteInvoice(invId);
      await loadInvoiceDatabase();
      showToast(`Deleted Invoice #${invId}`);
    } catch (err) {
      alert(err.message || 'Error deleting invoice');
    }
  };

  // Clean Native Print
  const handlePrint = () => {
    const originalTitle = document.title;
    const clientSafe = (billCompany || billName || 'Invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
    document.title = `INVOICE-${invoiceId}-${clientSafe}`;
    window.print();
    document.title = originalTitle;
  };

  // PDF Export via html2pdf.js
  const handleExportPdf = () => {
    if (!sheetRef.current) return;
    if (typeof window.html2pdf !== 'function') {
      alert('html2pdf library is initializing, please try again in a moment');
      return;
    }

    const clientSafe = (billCompany || billName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
    const opt = {
      margin: 0,
      filename: `INVOICE-${invoiceId}-${clientSafe}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(sheetRef.current).save();
    showToast('Downloading high-resolution PDF...');
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await updateSettings(settings);
      showToast('Studio settings saved successfully');
    } catch (err) {
      alert(err.message || 'Error saving settings');
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const res = await uploadLogo(formData);
      setSettings((prev) => ({ ...prev, logoUrl: res.logoUrl }));
      showToast('Logo uploaded successfully');
    } catch (err) {
      alert(err.message || 'Failed to upload logo');
    }
  };

  const handleResetSequence = async () => {
    if (!window.confirm('Reset monthly sequence counter to 0?')) return;
    try {
      await resetSequenceCounter();
      showToast('Monthly counter reset');
    } catch (err) {
      alert(err.message || 'Failed to reset sequence');
    }
  };

  // Filtered DB invoices
  const filteredDbInvoices = savedInvoices.filter((inv) => {
    if (!dbSearch.trim()) return true;
    const q = dbSearch.trim().toLowerCase();
    return (
      (inv.invoiceNumber || '').toLowerCase().includes(q) ||
      (inv.billName || '').toLowerCase().includes(q) ||
      (inv.billCompany || '').toLowerCase().includes(q) ||
      (inv.projectScope || '').toLowerCase().includes(q)
    );
  });

  // Empty rows for sheet minimum height
  const paddedRowCount = Math.max(0, MIN_ROWS - items.length);
  const emptyRows = Array.from({ length: paddedRowCount }, (_, i) => i);

  return (
    <div className="app-shell">
      <Navbar />

      <main className="main-content">
        {toastMsg && (
          <div className="toast success" style={{ position: 'fixed', top: '80px', right: '40px', zIndex: 9999 }}>
            ✓ {toastMsg}
          </div>
        )}

        <div className="invoice-split-layout">
          {/* =========================================================================
              LEFT STAGE: A4 PRINTABLE LIVE PREVIEW
              ========================================================================= */}
          <section className="invoice-stage">
            {/* Top Action Toolbar */}
            <div className="invoice-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge-chip info" style={{ fontSize: '13px', fontWeight: '700' }}>
                  #{invoiceId || 'NEW'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Date: {fmtDateSingle(invoiceDate)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleNewInvoice} title="Start clean invoice draft">
                  + New
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handlePrint} title="Clean native browser print">
                  🖨️ Print
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleExportPdf} title="Export clean A4 PDF">
                  📥 Download PDF
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleSaveInvoice} disabled={isSaving}>
                  {isSaving ? 'Saving...' : '💾 Save to DB'}
                </button>
              </div>
            </div>

            {/* A4 Sheet Paper */}
            <div ref={sheetRef} className="invoice-sheet" id="invoiceSheet">
              <div>
                {/* Header */}
                <div className="sheet-header">
                  <div>
                    <h1 className="sheet-title">INVOICE</h1>
                    <div className="sheet-meta-num">INVOICE #{invoiceId}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                      Date: {fmtDateSingle(invoiceDate)}
                    </div>
                  </div>

                  <div className="sheet-company-block">
                    {settings.logoUrl && (
                      <img
                        src={settings.logoUrl}
                        alt="Studio Logo"
                        style={{ maxHeight: '48px', maxWidth: '160px', objectFit: 'contain', marginBottom: '8px' }}
                      />
                    )}
                    <div className="sheet-company-name">{settings.companyName}</div>
                    <div style={{ whiteSpace: 'pre-line' }}>{settings.companyAddress}</div>
                    {settings.companyPhone && <div>Phone: {settings.companyPhone}</div>}
                    {settings.companyEmail && <div>Email: {settings.companyEmail}</div>}
                  </div>
                </div>

                {/* Parties (Bill To & Project Scope) */}
                <div className="sheet-parties">
                  <div>
                    <div className="party-box-title">Billed To</div>
                    <div className="party-name">{billName || billCompany || 'Recipient Name'}</div>
                    <div className="party-detail">
                      {billCompany && billCompany !== billName && <div>{billCompany}</div>}
                      {billPhone && <div>Phone: {billPhone}</div>}
                      {billEmail && <div>Email: {billEmail}</div>}
                    </div>
                  </div>

                  <div>
                    <div className="party-box-title">Project Scope</div>
                    <div className="party-detail" style={{ fontWeight: '500', color: '#1a1a1a' }}>
                      {projectScope || 'Commercial Video & Photography Production'}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="sheet-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Description</th>
                      <th className="qty-col">Qty</th>
                      <th className="price-col">Rate ({settings.currency})</th>
                      <th className="amt-col">Amount ({settings.currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const itAmt = (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0);
                      return (
                        <tr key={it.key || idx}>
                          <td style={{ color: '#888', fontSize: '11px' }}>{idx + 1}</td>
                          <td>
                            <strong style={{ color: '#111' }}>{it.description || 'Service Deliverable'}</strong>
                          </td>
                          <td className="qty-col">{it.qty}</td>
                          <td className="price-col">{fmtMoney(it.price)}</td>
                          <td className="amt-col" style={{ fontWeight: '600' }}>{fmtMoney(itAmt)}</td>
                        </tr>
                      );
                    })}

                    {/* Minimum 8 rows padding for exact A4 physical height */}
                    {emptyRows.map((_, i) => (
                      <tr key={`empty_${i}`}>
                        <td style={{ color: 'transparent' }}>.</td>
                        <td>&nbsp;</td>
                        <td className="qty-col">&nbsp;</td>
                        <td className="price-col">&nbsp;</td>
                        <td className="amt-col">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Calculations Summary */}
                <div className="sheet-calc-wrapper">
                  <table className="sheet-calc-table">
                    <tbody>
                      <tr>
                        <td style={{ color: '#555' }}>Subtotal</td>
                        <td>{fmtMoney(subtotal)}</td>
                      </tr>
                      {numDiscount > 0 && (
                        <tr>
                          <td style={{ color: '#555' }}>Discount</td>
                          <td style={{ color: '#b91c1c' }}>-{fmtMoney(numDiscount)}</td>
                        </tr>
                      )}
                      {numAdvance > 0 && (
                        <tr>
                          <td style={{ color: '#555' }}>Advance Received</td>
                          <td style={{ color: '#15803d' }}>-{fmtMoney(numAdvance)}</td>
                        </tr>
                      )}
                      <tr className="total-row">
                        <td>Total Due</td>
                        <td>{fmtMoney(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Terms & Conditions Footer */}
              {settings.terms && (
                <div className="sheet-terms-block">
                  <div style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: '10.5px', marginBottom: '4px', color: '#444' }}>
                    Terms &amp; Conditions
                  </div>
                  <div>{settings.terms}</div>
                </div>
              )}
            </div>
          </section>

          {/* =========================================================================
              RIGHT PANE: CONTROLS SIDEBAR (EDITOR / DEFAULTS / DATABASE)
              ========================================================================= */}
          <aside className="invoice-sidebar">
            {/* Tab Buttons */}
            <div className="sidebar-tab-buttons">
              <button
                type="button"
                className={`sidebar-tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
                onClick={() => setActiveTab('editor')}
              >
                ✏️ Editor
              </button>
              <button
                type="button"
                className={`sidebar-tab-btn ${activeTab === 'defaults' ? 'active' : ''}`}
                onClick={() => setActiveTab('defaults')}
              >
                ⚙️ Defaults
              </button>
              <button
                type="button"
                className={`sidebar-tab-btn ${activeTab === 'database' ? 'active' : ''}`}
                onClick={() => setActiveTab('database')}
              >
                🗄️ Saved ({savedInvoices.length})
              </button>
            </div>

            {/* TAB 1: INVOICE EDITOR */}
            {activeTab === 'editor' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Client / Recipient Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Kirtan Solanki"
                    value={billName}
                    onChange={(e) => setBillName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Client Company / Brand</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Brown Ion"
                    value={billCompany}
                    onChange={(e) => setBillCompany(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+91..."
                      value={billPhone}
                      onChange={(e) => setBillPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="client@brand.com"
                      value={billEmail}
                      onChange={(e) => setBillEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Project Scope Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="e.g. Content Shoot (Photo + Video)&#10;Scope: Raw Data Delivery"
                    value={projectScope}
                    onChange={(e) => setProjectScope(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Invoice Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>

                {/* Line Items Builder */}
                <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="form-label" style={{ margin: 0 }}>Line Items</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddItem}>
                      + Add Item
                    </button>
                  </div>

                  {items.map((it, idx) => (
                    <div key={it.key || idx} className="item-row-builder">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Description"
                        value={it.description}
                        onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                      />
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="form-control"
                        placeholder="Qty"
                        value={it.qty}
                        onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                      />
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="Price"
                        value={it.price}
                        onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-icon-del"
                        onClick={() => handleRemoveItem(idx)}
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                {/* Adjustments */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Discount ({settings.currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Advance Paid ({settings.currency})</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={advance}
                      onChange={(e) => setAdvance(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '10px' }}
                  onClick={handleSaveInvoice}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving to Database...' : '💾 Save Invoice in MySQL'}
                </button>
              </div>
            )}

            {/* TAB 2: STUDIO DEFAULTS */}
            {activeTab === 'defaults' && (
              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label className="form-label">Studio / Business Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.companyName}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Studio Address</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={settings.companyAddress}
                    onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Studio Contact Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.companyPhone}
                    onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Studio Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={settings.companyEmail}
                    onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Default Terms &amp; Conditions</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={settings.terms}
                    onChange={(e) => setSettings({ ...settings, terms: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Upload Studio Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-control"
                    onChange={handleLogoUpload}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Save Defaults
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleResetSequence} title="Reset sequence counter">
                    Reset #
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: SAVED INVOICES DATABASE */}
            {activeTab === 'database' && (
              <div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="🔍 Search invoices..."
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                  style={{ marginBottom: '14px' }}
                />

                {filteredDbInvoices.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No invoices found.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                    {filteredDbInvoices.map((inv) => (
                      <div
                        key={inv.invoiceNumber}
                        style={{
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-primary)' }}>
                            #{inv.invoiceNumber} &bull; {inv.billName || inv.billCompany || 'Client'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {fmtDateSingle(inv.date)} &bull; {fmtMoney(inv.total)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleLoadInvoice(inv)}
                            title="Load into sheet"
                          >
                            👁️
                          </button>
                          <button
                            type="button"
                            className="btn-icon-del"
                            onClick={() => handleDeleteInvoice(inv.invoiceNumber)}
                            title="Delete"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
