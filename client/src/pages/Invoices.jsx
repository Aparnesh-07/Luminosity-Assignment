import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  resetSequenceCounter,
  exportBackup,
  importBackup
} from '../services/api';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MIN_ROWS = 8;

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseISO(iso) {
  if (!iso) return new Date();
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function newItem() {
  return { key: Math.random().toString(36).slice(2, 9), description: '', qty: 1, price: 0 };
}

export default function Invoices() {
  const navigate = useNavigate();
  const location = useLocation();
  const sheetRef = useRef(null);

  // Active Sidebar Tab: 'invoice' | 'settings' | 'database'
  const [activeTab, setActiveTab] = useState('invoice');

  // Studio Settings
  const [settings, setSettings] = useState({
    currency: '₹',
    companyName: 'Luminav Films',
    companyAddress: 'Bhopal, Madhya Pradesh\nIndia',
    companyPhone: '+91 834711XXXX',
    companyEmail: 'contact@luminavfilms.com',
    logoUrl: '',
    logoDataUrl: '',
    terms:
      'All deliverables are provided as per the agreed project scope.\n' +
      'Any additional revisions or services beyond the agreed scope may be charged separately.\n' +
      'This invoice confirms that full payment has been received and the project has been successfully completed.'
  });

  // Current Invoice State
  const [invoice, setInvoice] = useState({
    id: '',
    date: todayISO(),
    billName: '',
    billCompany: '',
    billPhone: '',
    billEmail: '',
    project: '',
    items: [newItem()],
    discount: '',
    advance: ''
  });

  // Database Tab state
  const [savedInvoices, setSavedInvoices] = useState([]);
  const [dbSearch, setDbSearch] = useState('');
  const [dbSort, setDbSort] = useState({ key: 'dateIso', dir: 'desc' });
  const [saveStatus, setSaveStatus] = useState('');
  const [settingsStatus, setSettingsStatus] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Set page body style on mount
  useEffect(() => {
    document.body.className = 'invoices-page';
    document.body.style.background = 'var(--app-bg, #eceae3)';
    document.body.style.color = 'var(--ink, #221f1c)';
    return () => {
      document.body.className = '';
      document.body.style.background = '';
      document.body.style.color = '';
    };
  }, []);

  // Format currency helper using current settings
  const formatCurrency = (n) => {
    n = Number(n) || 0;
    const opts = (n % 1 !== 0) ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
    return (settings.currency || '₹') + ' ' + n.toLocaleString(undefined, opts);
  };

  // Generate fallback / fresh ID
  const fetchNextId = async (dateStr) => {
    try {
      const res = await getNextInvoiceNumber(dateStr || invoice.date);
      if (res?.invoiceNumber) {
        return res.invoiceNumber;
      }
    } catch (e) {
      // Fallback local ID generator
      const d = parseISO(dateStr || invoice.date);
      const mon = MONTHS[d.getMonth()] || 'INV';
      const rand1 = String(Math.floor(Math.random() * 90) + 10);
      const rand2 = String(Math.floor(Math.random() * 90) + 10);
      return `${mon}${rand1}${rand2}`;
    }
  };

  // Load Settings and Invoices on Mount
  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s) {
          setSettings((prev) => ({
            ...prev,
            currency: s.currency || prev.currency,
            companyName: s.companyName || prev.companyName,
            companyAddress: s.companyAddress || prev.companyAddress,
            companyPhone: s.companyPhone || prev.companyPhone,
            companyEmail: s.companyEmail || prev.companyEmail,
            logoUrl: s.logoUrl || prev.logoUrl,
            terms: s.terms || prev.terms
          }));
        }
      })
      .catch((e) => console.warn('Could not load settings:', e.message));

    loadInvoiceDatabase();
  }, []);

  // Check incoming project from Dashboard navigation
  useEffect(() => {
    const handleIncoming = async () => {
      let incomingProject = location.state?.fromProject;
      if (!incomingProject) {
        try {
          const raw = localStorage.getItem('invoiceApp:incoming_project') || sessionStorage.getItem('invoiceApp:incoming_project');
          if (raw) {
            incomingProject = JSON.parse(raw);
            localStorage.removeItem('invoiceApp:incoming_project');
            sessionStorage.removeItem('invoiceApp:incoming_project');
          }
        } catch (e) {}
      }

      const nextId = await fetchNextId(incomingProject?.date || todayISO());

      if (incomingProject) {
        setInvoice({
          id: nextId,
          date: incomingProject.date || todayISO(),
          billName: incomingProject.clientName || incomingProject.title || '',
          billCompany: incomingProject.company || incomingProject.clientCompany || '',
          billPhone: incomingProject.phone || '',
          billEmail: incomingProject.email || '',
          project: incomingProject.projectScope || incomingProject.deliverables || incomingProject.title || '',
          items: [
            {
              key: Math.random().toString(36).slice(2, 9),
              description: incomingProject.deliverables
                ? `${incomingProject.title} — ${incomingProject.deliverables}`
                : (incomingProject.title || 'Studio & Production Services'),
              qty: 1,
              price: Number(incomingProject.payment) || 0
            }
          ],
          advance: incomingProject.paid ? String(incomingProject.paid) : '',
          discount: ''
        });
      } else {
        setInvoice((prev) => ({
          ...prev,
          id: prev.id || nextId
        }));
      }
    };

    handleIncoming();
  }, [location.state]);

  const loadInvoiceDatabase = async () => {
    try {
      const list = await getInvoices();
      setSavedInvoices(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('Could not load invoices list from MySQL:', e.message);
    }
  };

  // Calculations
  const subtotal = invoice.items.reduce(
    (acc, it) => acc + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0),
    0
  );
  const discountVal = parseFloat(invoice.discount) || 0;
  const advanceVal = parseFloat(invoice.advance) || 0;
  const total = Math.max(0, subtotal - discountVal - advanceVal);

  // Line item handlers
  const handleItemChange = (idx, field, value) => {
    const updated = [...invoice.items];
    updated[idx][field] = value;
    setInvoice((prev) => ({ ...prev, items: updated }));
  };

  const handleAddItem = () => {
    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, newItem()]
    }));
  };

  const handleRemoveItem = (idx) => {
    if (invoice.items.length <= 1) return;
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  // Regeneration of invoice ID
  const handleRegenId = async () => {
    const newId = await fetchNextId(invoice.date);
    setInvoice((prev) => ({ ...prev, id: newId }));
  };

  // Start new clean invoice
  const startNewInvoice = async () => {
    const nextId = await fetchNextId(todayISO());
    setInvoice({
      id: nextId,
      date: todayISO(),
      billName: '',
      billCompany: '',
      billPhone: '',
      billEmail: '',
      project: '',
      items: [newItem()],
      discount: '',
      advance: ''
    });
    setActiveTab('invoice');
  };

  // Save current invoice to MySQL
  const handleSaveInvoice = async () => {
    if (!invoice.id) {
      const genId = await fetchNextId(invoice.date);
      invoice.id = genId;
    }
    try {
      setSaveStatus('Saving to MySQL…');
      const payload = {
        invoiceNumber: invoice.id,
        date: invoice.date,
        billName: invoice.billName || '',
        billCompany: invoice.billCompany || '',
        billPhone: invoice.billPhone || '',
        billEmail: invoice.billEmail || '',
        projectScope: invoice.project || '',
        items: invoice.items.map((it) => ({
          description: it.description || '',
          qty: parseFloat(it.qty) || 1,
          price: parseFloat(it.price) || 0
        })),
        discount: discountVal,
        advance: advanceVal,
        subtotal: subtotal,
        total: total,
        terms: settings.terms || '',
        status: 'sent'
      };

      const existing = savedInvoices.find((i) => i.invoiceNumber === invoice.id);
      if (existing) {
        await updateInvoice(invoice.id, payload);
      } else {
        await createInvoice(payload);
      }
      await loadInvoiceDatabase();
      setSaveStatus('Saved to MySQL ✓');
      setTimeout(() => setSaveStatus(''), 2200);
    } catch (err) {
      alert(err.message || 'Error saving invoice to database');
      setSaveStatus('');
    }
  };

  // Load from DB
  const loadInvoiceRecord = (inv) => {
    const itms =
      Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items.map((it) => ({
            key: it.key || Math.random().toString(36).slice(2, 9),
            description: it.description || '',
            qty: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : 1),
            price: it.unitPrice !== undefined ? it.unitPrice : (it.price !== undefined ? it.price : 0)
          }))
        : [newItem()];

    setInvoice({
      id: inv.invoiceNumber || inv.id || '',
      date: inv.date || inv.invoiceDate || todayISO(),
      billName: inv.billName || '',
      billCompany: inv.billCompany || '',
      billPhone: inv.billPhone || '',
      billEmail: inv.billEmail || '',
      project: inv.projectScope || inv.project || '',
      items: itms,
      discount: inv.discount ? String(inv.discount) : '',
      advance: inv.advance ? String(inv.advance) : ''
    });
    setActiveTab('invoice');
  };

  // Duplicate from DB
  const duplicateInvoiceRecord = async (inv) => {
    const nextId = await fetchNextId(todayISO());
    const itms =
      Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items.map((it) => ({
            key: Math.random().toString(36).slice(2, 9),
            description: it.description || '',
            qty: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : 1),
            price: it.unitPrice !== undefined ? it.unitPrice : (it.price !== undefined ? it.price : 0)
          }))
        : [newItem()];

    setInvoice({
      id: nextId,
      date: todayISO(),
      billName: inv.billName || '',
      billCompany: inv.billCompany || '',
      billPhone: inv.billPhone || '',
      billEmail: inv.billEmail || '',
      project: inv.projectScope || inv.project || '',
      items: itms,
      discount: inv.discount ? String(inv.discount) : '',
      advance: inv.advance ? String(inv.advance) : ''
    });
    setActiveTab('invoice');
  };

  // Delete invoice from MySQL
  const handleDeleteInvoice = async (invId) => {
    if (!window.confirm(`Delete invoice #${invId}? This cannot be undone.`)) return;
    try {
      await deleteInvoice(invId);
      await loadInvoiceDatabase();
    } catch (err) {
      alert(err.message || 'Error deleting invoice');
    }
  };

  // Print invoice cleanly
  const handlePrint = async () => {
    await handleSaveInvoice();
    const origTitle = document.title;
    const safeName = (invoice.billName || 'Invoice').replace(/[^\w\- ]+/g, '').trim() || 'Invoice';
    document.title = `${invoice.id || 'INVOICE'} - ${safeName}`;
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1500);
  };

  // Export PDF with html2pdf
  const handleExportPdf = async (targetInv = invoice) => {
    setIsExportingPdf(true);
    await handleSaveInvoice();

    const el = document.getElementById('sheet');
    const trackerStrip = document.getElementById('leftTrackerStrip');
    const slideCurtain = document.getElementById('slideCurtainLeft');
    const prevTrackerDisplay = trackerStrip ? trackerStrip.style.display : '';
    const prevCurtainDisplay = slideCurtain ? slideCurtain.style.display : '';

    if (trackerStrip) trackerStrip.style.display = 'none';
    if (slideCurtain) slideCurtain.style.display = 'none';

    const safeName = (targetInv.billName || 'invoice').replace(/[^\w\- ]+/g, '').trim() || 'invoice';
    const filename = `${targetInv.id || 'INVOICE'} - ${safeName}.pdf`;

    try {
      if (typeof window.html2pdf !== 'undefined' && el) {
        await window
          .html2pdf()
          .set({
            margin: [0, 0, 0, 0],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              logging: false,
              ignoreElements: (element) => {
                return (
                  element.id === 'leftTrackerStrip' ||
                  element.id === 'slideCurtainLeft' ||
                  element.classList?.contains('left-edge-strip') ||
                  element.classList?.contains('stage-toolbar') ||
                  element.classList?.contains('sidebar')
                );
              }
            },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
          })
          .from(el)
          .save();
      } else {
        handlePrint();
      }
    } catch (err) {
      console.warn('html2pdf generation error, falling back to clean print:', err);
      handlePrint();
    } finally {
      if (trackerStrip) trackerStrip.style.display = prevTrackerDisplay;
      if (slideCurtain) slideCurtain.style.display = prevCurtainDisplay;
      setIsExportingPdf(false);
    }
  };

  // Save Settings Defaults to MySQL
  const handleSaveSettings = async () => {
    try {
      setSettingsStatus('Saving…');
      await updateSettings({
        currency: settings.currency,
        companyName: settings.companyName,
        companyAddress: settings.companyAddress,
        companyPhone: settings.companyPhone,
        companyEmail: settings.companyEmail,
        terms: settings.terms
      });
      setSettingsStatus('All defaults saved to MySQL ✓');
      setTimeout(() => setSettingsStatus(''), 2500);
    } catch (err) {
      alert(err.message || 'Error saving settings');
      setSettingsStatus('');
    }
  };

  // Logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await uploadLogo(formData);
      setSettings((prev) => ({
        ...prev,
        logoUrl: res.logoUrl || res.data?.logoUrl || ''
      }));
      setSettingsStatus('Logo saved to server ✓');
      setTimeout(() => setSettingsStatus(''), 2200);
    } catch (err) {
      alert(err.message || 'Failed to upload logo');
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await deleteLogo();
      setSettings((prev) => ({ ...prev, logoUrl: '', logoDataUrl: '' }));
      setSettingsStatus('Logo removed ✓');
      setTimeout(() => setSettingsStatus(''), 2200);
    } catch (err) {
      setSettings((prev) => ({ ...prev, logoUrl: '', logoDataUrl: '' }));
    }
  };

  // Reset Sequence Counter
  const handleResetSequence = async () => {
    if (!window.confirm('This will reset the generated invoice counter for the current month. Continue?')) return;
    try {
      await resetSequenceCounter();
      alert('Monthly counter reset to 0 in MySQL ✓');
    } catch (err) {
      alert(err.message || 'Error resetting sequence');
    }
  };

  // Reset All
  const handleResetAll = async () => {
    if (!window.confirm('Reset local invoice draft and reload?')) return;
    localStorage.removeItem('invoice:draft');
    window.location.reload();
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!savedInvoices.length) {
      alert('No invoices in database to export.');
      return;
    }
    const headers = ['Invoice #', 'Date', 'Client Name', 'Company', 'Phone', 'Email', 'Project', 'Total', 'Status'];
    const rows = savedInvoices.map((inv) => [
      `"${inv.invoiceNumber || inv.id || ''}"`,
      `"${inv.date || inv.invoiceDate || ''}"`,
      `"${(inv.billName || '').replace(/"/g, '""')}"`,
      `"${(inv.billCompany || '').replace(/"/g, '""')}"`,
      `"${inv.billPhone || ''}"`,
      `"${inv.billEmail || ''}"`,
      `"${(inv.projectScope || inv.project || '').replace(/"/g, '""')}"`,
      inv.total || 0,
      `"${inv.status || 'sent'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `luminosity-invoices-${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Export JSON Backup
  const handleExportBackup = async () => {
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studio-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Error creating database backup');
    }
  };

  // Import JSON Backup
  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!window.confirm('Import this backup into MySQL? This will update your projects, invoices, and settings.')) return;
      await importBackup(parsed, 'merge');
      alert('Backup imported successfully into MySQL!');
      window.location.reload();
    } catch (err) {
      alert('Failed to parse or import backup file: ' + err.message);
    }
    e.target.value = '';
  };

  // Slide transition to tracker
  const handleSlideToTracker = (e) => {
    if (e) e.preventDefault();
    const curtain = document.getElementById('slideCurtainLeft');
    if (curtain) curtain.classList.add('active');
    document.body.style.transform = 'translateX(100vw)';
    document.body.style.opacity = '0.1';
    document.body.style.filter = 'blur(6px)';
    document.body.style.transition = 'transform 0.42s cubic-bezier(0.76, 0, 0.24, 1), opacity 0.42s';
    setTimeout(() => {
      document.body.style.transform = '';
      document.body.style.opacity = '';
      document.body.style.filter = '';
      document.body.style.transition = '';
      navigate('/tracker');
    }, 380);
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Database filtering & sorting
  const filteredDbInvoices = savedInvoices.filter((inv) => {
    if (!dbSearch.trim()) return true;
    const q = dbSearch.trim().toLowerCase();
    return (
      (inv.invoiceNumber || inv.id || '').toLowerCase().includes(q) ||
      (inv.billName || '').toLowerCase().includes(q) ||
      (inv.projectScope || inv.project || '').toLowerCase().includes(q)
    );
  });

  const sortedDbInvoices = [...filteredDbInvoices].sort((a, b) => {
    const dir = dbSort.dir === 'asc' ? 1 : -1;
    let av = a[dbSort.key];
    let bv = b[dbSort.key];
    if (dbSort.key === 'id') {
      av = a.invoiceNumber || a.id || '';
      bv = b.invoiceNumber || b.id || '';
    } else if (dbSort.key === 'dateIso') {
      av = a.date || a.invoiceDate || '';
      bv = b.date || b.invoiceDate || '';
    } else if (dbSort.key === 'project') {
      av = a.projectScope || a.project || '';
      bv = b.projectScope || b.project || '';
    } else if (dbSort.key === 'total') {
      av = Number(a.total) || 0;
      bv = Number(b.total) || 0;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  const handleSort = (key) => {
    setDbSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'asc' };
    });
  };

  const getSortClass = (key) => {
    if (dbSort.key !== key) return '';
    return dbSort.dir === 'asc' ? 'sort-active-asc' : 'sort-active-desc';
  };

  const totalDbBilled = savedInvoices.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const rowsToRender = Math.max(invoice.items.length, MIN_ROWS);
  const termsLines = (settings.terms || '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <>
      {/* =========================================================================
           LEFT FRAME HOVER STRIP (SLIDE TO PROJECT TRACKER)
           ========================================================================= */}
      <a
        href="/tracker"
        className="left-edge-strip"
        id="leftTrackerStrip"
        onClick={handleSlideToTracker}
        title="Click to Slide into Project Tracker"
      >
        <div className="left-strip-drawer-body">
          <div className="left-strip-header">
            <div className="left-strip-mark">
              <img src="/assets/images/logo-dark.png" alt="Luminosity Logo" className="brand-logo-img" />
            </div>
            <div className="left-strip-title">Project Tracker</div>
          </div>
          <div className="left-strip-desc">Shoots, edit projects, &amp; financial ledger.</div>
          <div className="left-strip-action-chip">
            <span>Slide to Tracker</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
        <div className="left-strip-tab">
          <div className="left-strip-dot"></div>
          <div className="left-strip-label">
            <span>PROJECT TRACKER</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
        </div>
      </a>

      {/* Slide Curtain Layer */}
      <div className="slide-curtain-left" id="slideCurtainLeft"></div>

      <div className="shell">
        {/* ================= STAGE (INVOICE PREVIEW / SHEET ON LEFT) ================= */}
        <main className="stage">
          {/* Invoice editing + preview */}
          <div id="stageInvoiceView" style={{ display: activeTab === 'database' ? 'none' : 'block' }}>
            <div className="stage-toolbar">
              <div className="invoice-id-chip">
                #<span id="chipId">{invoice.id || '—'}</span>
              </div>
              <div className="toolbar-actions">
                <button className="btn btn-light" id="btnNewInvoiceTop" onClick={startNewInvoice}>
                  New invoice
                </button>
                <button className="link-btn" id="btnPrint" onClick={handlePrint}>
                  Print instead
                </button>
                <button
                  className="btn btn-dark"
                  id="btnExportPdf"
                  onClick={() => handleExportPdf(invoice)}
                  disabled={isExportingPdf}
                >
                  {isExportingPdf ? 'Generating…' : 'Export PDF'}
                </button>
              </div>
            </div>

            <div className="sheet-wrap">
              <div className="sheet" id="sheet" ref={sheetRef}>
                <div className="bar"></div>
                <div className="sheet-body">
                  <div className="sheet-header">
                    <div>
                      <h1 className="invoice-title">INVOICE</h1>
                      <div className="company-block" id="companyBlock">
                        {settings.companyName || settings.companyAddress || settings.companyPhone || settings.companyEmail ? (
                          <>
                            <div className="company-name">{settings.companyName}</div>
                            <div style={{ whiteSpace: 'pre-line' }}>{settings.companyAddress}</div>
                            <div>{settings.companyPhone}</div>
                            {settings.companyEmail && (
                              <div>
                                <a href={`mailto:${settings.companyEmail}`}>{settings.companyEmail}</a>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="empty-hint">Add your company details in Defaults</span>
                        )}
                      </div>
                    </div>
                    <div className="header-right">
                      <div className="logo-box" id="logoBox">
                        {settings.logoUrl || settings.logoDataUrl ? (
                          <img src={settings.logoUrl || settings.logoDataUrl} alt="logo" />
                        ) : (
                          <img src="/assets/images/logo-dark.png" alt="Luminav Logo" className="brand-logo-img" />
                        )}
                      </div>
                      <div className="meta-box">
                        <div className="meta-field" id="metaDate">
                          {formatDisplayDate(invoice.date)}
                        </div>
                        <div className="meta-field" id="metaId">
                          #{invoice.id || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="parties">
                    <div className="party-col" id="billBlock">
                      <div className="party-label">Bill to</div>
                      {invoice.billName ? (
                        <div className="line1">{invoice.billName}</div>
                      ) : (
                        <span className="empty-hint">Add client details</span>
                      )}
                      {invoice.billCompany && <div>{invoice.billCompany}</div>}
                      {invoice.billPhone && <div>{invoice.billPhone}</div>}
                      {invoice.billEmail && (
                        <div>
                          <a href={`mailto:${invoice.billEmail}`}>{invoice.billEmail}</a>
                        </div>
                      )}
                    </div>
                    <div className="party-col">
                      <div className="party-label">Project details</div>
                      <div className="project-text" id="projectBlock" style={{ whiteSpace: 'pre-line' }}>
                        {invoice.project || <span className="empty-hint">Add project details</span>}
                      </div>
                    </div>
                  </div>

                  <table className="items-table">
                    <thead>
                      <tr>
                        <th className="idx-col">#</th>
                        <th>Description</th>
                        <th className="num-col">Quantity</th>
                        <th className="num-col">Price</th>
                        <th className="num-col">Amount</th>
                      </tr>
                    </thead>
                    <tbody id="itemsBody">
                      {Array.from({ length: rowsToRender }).map((_, i) => {
                        const item = invoice.items[i];
                        if (item) {
                          const itemAmt = (Number(item.qty) || 0) * (Number(item.price) || 0);
                          return (
                            <tr key={item.key || i}>
                              <td className="idx-col">{i + 1}</td>
                              <td>{item.description}</td>
                              <td className="num-col">{item.qty !== '' ? item.qty : ''}</td>
                              <td className="num-col">{item.price !== '' ? formatCurrency(item.price) : ''}</td>
                              <td className="num-col">{formatCurrency(itemAmt)}</td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={`blank_${i}`} className="blank-row">
                            <td className="idx-col">{i + 1}</td>
                            <td>&nbsp;</td>
                            <td className="num-col"></td>
                            <td className="num-col"></td>
                            <td className="num-col"></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div id="subtotalsBlock">
                    {discountVal > 0 || advanceVal > 0 ? (
                      <>
                        <div
                          className="totals-row"
                          style={{ marginTop: '18px', paddingTop: '10px', borderTop: '2px solid #1c1c1c' }}
                        >
                          <span className="t-label">Subtotal</span>
                          <span className="t-amount">{formatCurrency(subtotal)}</span>
                        </div>
                        {discountVal > 0 && (
                          <div className="subtotal-row">
                            <span className="t-label">Discount</span>
                            <span className="t-amount">- {formatCurrency(discountVal)}</span>
                          </div>
                        )}
                        {advanceVal > 0 && (
                          <div className="subtotal-row">
                            <span className="t-label">Advance Paid</span>
                            <span className="t-amount">- {formatCurrency(advanceVal)}</span>
                          </div>
                        )}
                        <div
                          className="totals-row"
                          style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #1c1c1c' }}
                        >
                          <span className="t-label">Total Due</span>
                          <span className="t-amount">{formatCurrency(total)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="totals-row">
                        <span className="t-label">Total</span>
                        <span className="t-amount">{formatCurrency(subtotal)}</span>
                      </div>
                    )}
                  </div>

                  <div className="notes-block" id="notesBlock">
                    {termsLines.length > 0 && (
                      <>
                        {termsLines.slice(0, -1).map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                        <div className="closing-line">{termsLines[termsLines.length - 1]}</div>
                      </>
                    )}
                  </div>
                </div>
                <div className="bar"></div>
              </div>
            </div>
          </div>

          {/* Database (search / sort) view */}
          <div id="stageDatabaseView" style={{ display: activeTab === 'database' ? 'block' : 'none' }}>
            <div className="db-toolbar">
              <input
                type="search"
                id="dbSearch"
                placeholder="Search by client, invoice #, or project…"
                value={dbSearch}
                onChange={(e) => setDbSearch(e.target.value)}
              />
              <div className="db-summary" id="dbSummary">
                {savedInvoices.length} invoice{savedInvoices.length === 1 ? '' : 's'} · {formatCurrency(totalDbBilled)} total
              </div>
            </div>
            <div className="db-table-wrap">
              <table className="db-table" id="dbTable">
                <thead>
                  <tr>
                    <th data-sort="id" onClick={() => handleSort('id')} className={getSortClass('id')}>
                      Invoice #
                    </th>
                    <th data-sort="dateIso" onClick={() => handleSort('dateIso')} className={getSortClass('dateIso')}>
                      Date
                    </th>
                    <th data-sort="billName" onClick={() => handleSort('billName')} className={getSortClass('billName')}>
                      Client
                    </th>
                    <th data-sort="project" onClick={() => handleSort('project')} className={getSortClass('project')}>
                      Project
                    </th>
                    <th data-sort="total" onClick={() => handleSort('total')} className={`num-col ${getSortClass('total')}`}>
                      Total
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="dbTableBody">
                  {sortedDbInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="db-empty">
                        {savedInvoices.length ? 'No invoices match your search.' : 'No invoices saved yet.'}
                      </td>
                    </tr>
                  ) : (
                    sortedDbInvoices.map((inv) => (
                      <tr key={inv.invoiceNumber || inv.id}>
                        <td className="db-id">#{inv.invoiceNumber || inv.id}</td>
                        <td>{formatDisplayDate(inv.date || inv.invoiceDate)}</td>
                        <td>{inv.billName || '(no client name)'}</td>
                        <td className="db-project">{inv.projectScope || inv.project || '—'}</td>
                        <td className="num-col">{formatCurrency(inv.total)}</td>
                        <td className="db-actions">
                          <button className="db-link" onClick={() => loadInvoiceRecord(inv)}>
                            Load
                          </button>
                          <button className="db-link" onClick={() => duplicateInvoiceRecord(inv)}>
                            Duplicate
                          </button>
                          <button className="db-link" onClick={() => handleExportPdf(inv)}>
                            Export PDF
                          </button>
                          <button
                            className="db-link db-link-danger"
                            onClick={() => handleDeleteInvoice(inv.invoiceNumber || inv.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* ================= SIDEBAR (DATA INPUT CONTROLS ON RIGHT) ================= */}
        <aside className="sidebar">
          <div className="brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="brand-mark">
                <img src="/assets/images/logo-dark.png" alt="Luminosity Logo" className="brand-logo-img" />
              </div>
              <div>
                <div className="brand-name">LUMINOSITY</div>
                <div className="brand-sub">Invoice Generator</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <button
                onClick={handleLogout}
                className="btn btn-ghost"
                style={{
                  fontSize: '11px',
                  padding: '4px 9px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: 'var(--sidebar-text-dim)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                title="Log Out of Luminosity"
              >
                Log Out ⎋
              </button>
            </div>
          </div>

          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === 'invoice' ? 'active' : ''}`}
              onClick={() => setActiveTab('invoice')}
            >
              New invoice
            </button>
            <button
              className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Defaults
            </button>
            <button
              className={`tab-btn ${activeTab === 'database' ? 'active' : ''}`}
              onClick={() => setActiveTab('database')}
            >
              Database
            </button>
          </div>

          <div className="tab-panels">
            {/* ---- INVOICE PANEL ---- */}
            <section id="panel-invoice" className={`panel ${activeTab === 'invoice' ? 'active' : ''}`}>
              <div className="section-title">Bill to</div>
              <div className="field-group">
                <label className="field-label">Client name</label>
                <input
                  type="text"
                  id="billName"
                  placeholder="Yash Shah"
                  value={invoice.billName}
                  onChange={(e) => setInvoice((prev) => ({ ...prev, billName: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Client company</label>
                <input
                  type="text"
                  id="billCompany"
                  placeholder="Luminav Films"
                  value={invoice.billCompany}
                  onChange={(e) => setInvoice((prev) => ({ ...prev, billCompany: e.target.value }))}
                />
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Phone</label>
                  <input
                    type="tel"
                    id="billPhone"
                    placeholder="834711XXXX"
                    value={invoice.billPhone}
                    onChange={(e) => setInvoice((prev) => ({ ...prev, billPhone: e.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Email</label>
                  <input
                    type="email"
                    id="billEmail"
                    placeholder="client@email.com"
                    value={invoice.billEmail}
                    onChange={(e) => setInvoice((prev) => ({ ...prev, billEmail: e.target.value }))}
                  />
                </div>
              </div>

              <div className="section-title">Project details</div>
              <div className="field-group">
                <textarea
                  id="projectDetails"
                  placeholder='Shoot Services for "Antardwand" Short Film Shoot'
                  value={invoice.project}
                  onChange={(e) => setInvoice((prev) => ({ ...prev, project: e.target.value }))}
                ></textarea>
              </div>

              <div className="section-title">Invoice details</div>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Date</label>
                  <input
                    type="date"
                    id="invoiceDate"
                    value={invoice.date}
                    onChange={(e) => setInvoice((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Invoice #</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      id="invoiceIdInput"
                      style={{ textTransform: 'uppercase' }}
                      value={invoice.id}
                      onChange={(e) => setInvoice((prev) => ({ ...prev, id: e.target.value.replace(/^#/, '').toUpperCase() }))}
                    />
                    <button
                      className="btn btn-ghost"
                      id="btnRegenId"
                      title="Generate a new invoice number"
                      style={{ padding: '9px 10px' }}
                      onClick={handleRegenId}
                    >
                      ⟳
                    </button>
                  </div>
                </div>
              </div>

              <div className="section-title">Line items</div>
              <div id="itemsContainer">
                {invoice.items.map((item, idx) => {
                  const lineAmt = (Number(item.qty) || 0) * (Number(item.price) || 0);
                  return (
                    <div className="item-row" key={item.key || idx}>
                      {invoice.items.length > 1 && (
                        <button
                          className="remove-item"
                          onClick={() => handleRemoveItem(idx)}
                          title="Remove item"
                        >
                          &times;
                        </button>
                      )}
                      <div className="field-group">
                        <label className="field-label">Description</label>
                        <input
                          type="text"
                          className="item-desc"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="e.g. DOP services - shoot day"
                        />
                      </div>
                      <div className="field-row">
                        <div className="field-group">
                          <label className="field-label">Quantity</label>
                          <input
                            type="number"
                            className="item-qty"
                            value={item.qty}
                            min="0"
                            step="1"
                            onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                          />
                        </div>
                        <div className="field-group">
                          <label className="field-label">Price</label>
                          <input
                            type="number"
                            className="item-price"
                            value={item.price}
                            min="0"
                            step="0.01"
                            onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="item-amount-line">
                        <span>Amount</span>
                        <b className="item-line-amount">{formatCurrency(lineAmt)}</b>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-ghost btn-block" id="btnAddItem" onClick={handleAddItem}>
                + Add item
              </button>

              <div className="section-title">Adjustments</div>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Discount</label>
                  <input
                    type="number"
                    id="invoiceDiscount"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={invoice.discount}
                    onChange={(e) => setInvoice((prev) => ({ ...prev, discount: e.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Advance paid</label>
                  <input
                    type="number"
                    id="invoiceAdvance"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={invoice.advance}
                    onChange={(e) => setInvoice((prev) => ({ ...prev, advance: e.target.value }))}
                  />
                </div>
              </div>

              {saveStatus && (
                <div style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '8px', textAlign: 'center' }}>
                  {saveStatus}
                </div>
              )}

              <div className="action-stack">
                <button className="btn btn-primary btn-block" id="btnSaveInvoice" onClick={handleSaveInvoice}>
                  Save invoice to database
                </button>
                <button className="btn btn-ghost btn-block" id="btnResetForm" onClick={startNewInvoice}>
                  Clear / New draft
                </button>
              </div>
            </section>

            {/* ---- SETTINGS PANEL ---- */}
            <section id="panel-settings" className={`panel ${activeTab === 'settings' ? 'active' : ''}`}>
              <div className="section-title">Company &amp; Brand</div>
              <div className="field-group">
                <label className="field-label">Business / Studio name</label>
                <input
                  type="text"
                  id="setCompanyName"
                  placeholder="Luminav Films"
                  value={settings.companyName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, companyName: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Address / Details (multi-line)</label>
                <textarea
                  id="setCompanyAddress"
                  placeholder="Bhopal, Madhya Pradesh&#10;India"
                  value={settings.companyAddress}
                  onChange={(e) => setSettings((prev) => ({ ...prev, companyAddress: e.target.value }))}
                ></textarea>
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Phone</label>
                  <input
                    type="tel"
                    id="setCompanyPhone"
                    placeholder="+91 834711XXXX"
                    value={settings.companyPhone}
                    onChange={(e) => setSettings((prev) => ({ ...prev, companyPhone: e.target.value }))}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Email</label>
                  <input
                    type="email"
                    id="setCompanyEmail"
                    placeholder="contact@luminavfilms.com"
                    value={settings.companyEmail}
                    onChange={(e) => setSettings((prev) => ({ ...prev, companyEmail: e.target.value }))}
                  />
                </div>
              </div>

              <div className="section-title">Logo &amp; Brand Mark</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div
                  className="logo-box"
                  id="settingsLogoPreview"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    background: '#252220',
                    border: '1px solid #4a453d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#d9a463',
                    fontWeight: '700',
                    overflow: 'hidden'
                  }}
                >
                  {settings.logoUrl || settings.logoDataUrl ? (
                    <img
                      src={settings.logoUrl || settings.logoDataUrl}
                      alt="logo"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span className="mono">L</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label
                    className="btn btn-ghost"
                    style={{
                      fontSize: '11.5px',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '6px',
                      display: 'inline-block',
                      textAlign: 'center'
                    }}
                  >
                    Upload Logo
                    <input type="file" id="logoFileInput" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                  </label>
                  <button
                    className="btn btn-ghost"
                    id="btnRemoveLogo"
                    style={{ fontSize: '11.5px', padding: '3px 8px', color: '#c0554a' }}
                    onClick={handleRemoveLogo}
                  >
                    Remove logo
                  </button>
                </div>
              </div>

              <div className="section-title">Invoice defaults</div>
              <div className="field-group">
                <label className="field-label">Currency symbol</label>
                <input
                  type="text"
                  id="setCurrency"
                  placeholder="₹"
                  value={settings.currency}
                  onChange={(e) => setSettings((prev) => ({ ...prev, currency: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Default terms / notes</label>
                <textarea
                  id="setTerms"
                  placeholder="All deliverables are provided as per the agreed project scope…"
                  value={settings.terms}
                  onChange={(e) => setSettings((prev) => ({ ...prev, terms: e.target.value }))}
                ></textarea>
              </div>

              {settingsStatus && (
                <div className="status-msg" id="settingsSaveStatus" style={{ fontSize: '11.5px', color: 'var(--accent)', marginBottom: '10px' }}>
                  {settingsStatus}
                </div>
              )}

              <div className="action-stack">
                <button className="btn btn-primary btn-block" id="btnSaveSettings" onClick={handleSaveSettings}>
                  Save defaults
                </button>
                <button className="btn btn-ghost btn-block" id="btnResetSeq" onClick={handleResetSequence}>
                  Reset invoice counter
                </button>
                <button className="btn btn-ghost btn-block" id="btnResetAll" style={{ color: '#c0554a' }} onClick={handleResetAll}>
                  Reset all settings &amp; storage
                </button>
              </div>
            </section>

            {/* ---- DATABASE PANEL ---- */}
            <section id="panel-database" className={`panel ${activeTab === 'database' ? 'active' : ''}`}>
              <div className="section-title">Saved invoices &amp; summary</div>
              <div style={{ background: '#252220', border: '1px solid #4a453d', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                <div id="sidebarDbCount" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--sidebar-text)' }}>
                  {savedInvoices.length} invoice{savedInvoices.length === 1 ? '' : 's'}
                </div>
                <div id="sidebarDbTotal" style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '2px' }}>
                  {formatCurrency(totalDbBilled)} total billed
                </div>
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--sidebar-text-dim)', margin: '0 0 16px', lineHeight: 1.5 }}>
                All saved invoices and project records are permanently stored in your studio MySQL database. You can export a CSV spreadsheet or full studio JSON backup below.
              </p>

              <div className="action-stack">
                <button className="btn btn-primary btn-block" id="btnExportCsv" onClick={handleExportCsv}>
                  Export all to CSV
                </button>
                <button className="btn btn-ghost btn-block" id="btnExportBackup" onClick={handleExportBackup}>
                  Export database backup
                </button>
                <label className="btn btn-ghost btn-block" style={{ cursor: 'pointer', textAlign: 'center' }}>
                  Import backup (JSON)
                  <input type="file" id="backupFileInput" accept="application/json" style={{ display: 'none' }} onChange={handleImportBackup} />
                </label>
              </div>
            </section>
          </div>

          <div
            className="persist-note"
            id="persistNote"
            style={{
              marginTop: 'auto',
              padding: '14px 22px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: '10.5px',
              color: 'var(--sidebar-text-dim)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span
              className="persist-dot"
              style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7fbf7f', display: 'inline-block' }}
            ></span>
            <span>MySQL Database Online</span>
          </div>
        </aside>
      </div>
    </>
  );
}
