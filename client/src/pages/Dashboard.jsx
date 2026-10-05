import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  recordPayment,
  deletePayment,
  quickSettleProject,
  getOverviewAnalytics,
  exportBackup,
  importBackup
} from '../services/api';
import { fmtMoney, fmtDateSingle, fmtDateRange, todayISO } from '../utils/format';

const STATUS_CONFIG = {
  upcoming: { label: 'Upcoming', color: 'var(--status-upcoming)', key: 'upcoming' },
  ongoing: { label: 'Ongoing', color: 'var(--status-ongoing)', key: 'ongoing' },
  pending: { label: 'Payment Pending', color: 'var(--status-pending)', key: 'pending' },
  completed: { label: 'Completed', color: 'var(--status-completed)', key: 'completed' }
};

const EXPENSE_PRESETS = [
  'Gear Rental',
  'Crew Fees',
  'Location',
  'Travel',
  'Post-Production',
  'Props & Art',
  'Catering / Food'
];

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Views & Filters
  const [currentView, setCurrentView] = useState('table'); // 'table' | 'grid' | 'stats'
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rangePreset, setRangePreset] = useState('all');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('asc');

  // Modals & UI States
  const [isDropletOpen, setIsDropletOpen] = useState(false);
  const [isDropletClosing, setIsDropletClosing] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const [isPaymentsHubOpen, setIsPaymentsHubOpen] = useState(false);
  const [paymentsHubFilter, setPaymentsHubFilter] = useState('pending');
  const [quickPayInputs, setQuickPayInputs] = useState({});

  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const [statusPopupId, setStatusPopupId] = useState(null);
  const [collapsedExpenses, setCollapsedExpenses] = useState({});
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Add / Edit Project Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formDeliverables, setFormDeliverables] = useState('');
  const [formStatus, setFormStatus] = useState('upcoming');
  const [formExpenses, setFormExpenses] = useState([]);

  const showToast = (message, type = '') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 2800);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [projList, stats] = await Promise.all([
        getProjects({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          sort: sortCol,
          order: sortDir
        }),
        getOverviewAnalytics({
          startDate: startDate || undefined,
          endDate: endDate || undefined
        })
      ]);
      setProjects(projList);
      setAnalytics(stats);
    } catch (err) {
      console.error('Failed to load tracker data:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, startDate, endDate, sortCol, sortDir]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keyboard Shortcuts (1, 2, 3, N, /, ?, Esc) from tracker.html
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }
      if (e.key === '1') setCurrentView('table');
      if (e.key === '2') setCurrentView('grid');
      if (e.key === '3') setCurrentView('stats');
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openDropletModal();
      }
      if (e.key === '/') {
        e.preventDefault();
        const sInput = document.getElementById('searchInput');
        if (sInput) sInput.focus();
      }
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        closeAllModals();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeAllModals = () => {
    if (isDropletOpen) closeDropletModal();
    setIsPaymentsHubOpen(false);
    setIsDataModalOpen(false);
    setIsShortcutsOpen(false);
    setIsResetConfirmOpen(false);
    setStatusPopupId(null);
  };

  // Water Droplet Morphing Animation on Open / Close
  const openDropletModal = (project = null, e = null) => {
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const ring = document.createElement('div');
      ring.className = 'droplet-splash-ring';
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 750);
    }

    if (project) {
      setEditingProject(project);
      setFormTitle(project.title || '');
      setFormStartDate(project.startDate || '');
      setFormEndDate(project.endDate || '');
      setFormBudget(project.budget || project.payment || '');
      setFormDeliverables(project.deliverables || '');
      setFormStatus(project.status || 'upcoming');
      setFormExpenses(
        Array.isArray(project.expenseItems)
          ? project.expenseItems.map((it) => ({ title: it.title || it.category || '', amount: it.amount || '' }))
          : []
      );
    } else {
      setEditingProject(null);
      setFormTitle('');
      setFormStartDate(todayISO());
      setFormEndDate(todayISO());
      setFormBudget('');
      setFormDeliverables('');
      setFormStatus('upcoming');
      setFormExpenses([]);
    }

    document.body.classList.add('modal-open');
    setIsDropletOpen(true);
  };

  const closeDropletModal = () => {
    setIsDropletClosing(true);
    setTimeout(() => {
      setIsDropletOpen(false);
      setIsDropletClosing(false);
      document.body.classList.remove('modal-open');
    }, 320);
  };

  // Droplet Form Calculation
  const totalExpenses = formExpenses.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
  const numBudget = parseFloat(formBudget) || 0;
  const netProfit = numBudget - totalExpenses;
  const profitMargin = numBudget > 0 ? Math.round((netProfit / numBudget) * 100) : 0;

  const handleSaveProjectForm = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('Project title is required', 'error');
      return;
    }

    try {
      const payload = {
        title: formTitle.trim(),
        startDate: formStartDate || null,
        endDate: formEndDate || formStartDate || null,
        budget: numBudget,
        payment: numBudget,
        deliverables: formDeliverables.trim(),
        status: formStatus,
        expenseItems: formExpenses
          .filter((it) => it.title.trim() || parseFloat(it.amount) > 0)
          .map((it) => ({
            title: it.title.trim() || 'General Expense',
            amount: parseFloat(it.amount) || 0
          }))
      };

      if (editingProject) {
        await updateProject(editingProject.id, payload);
        showToast('Shoot updated successfully!', 'success');
      } else {
        await createProject(payload);
        showToast('New shoot recorded!', 'success');
      }

      closeDropletModal();
      await loadData();
    } catch (err) {
      showToast(err.message || 'Error saving project', 'error');
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Delete this project permanently from database?')) return;
    try {
      await deleteProject(id);
      showToast('Project removed', 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Error deleting project', 'error');
    }
  };

  const handleQuickStatusChange = async (projectId, newStatus) => {
    try {
      await updateProject(projectId, { status: newStatus });
      setStatusPopupId(null);
      await loadData();
      showToast(`Status updated to ${STATUS_CONFIG[newStatus]?.label}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Slide Curtain Transition to Invoice Studio
  const handleSlideToInvoice = (e, project = null) => {
    if (e) e.preventDefault();
    const curtain = document.getElementById('slideCurtain');
    if (curtain) curtain.classList.add('active');

    setTimeout(() => {
      navigate('/invoices', {
        state: project
          ? {
              fromProject: {
                projectId: project.id,
                title: project.title,
                clientName: project.clientName || project.title,
                projectScope: project.deliverables ? `${project.title}\nScope: ${project.deliverables}` : project.title,
                date: project.startDate || todayISO(),
                payment: project.budget || 0,
                paid: project.totalPaid || 0
              }
            }
          : undefined
      });
    }, 380);
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!projects.length) {
      showToast('No projects to export', 'error');
      return;
    }
    const headers = [
      'ID',
      'Client / Project',
      'Start Date',
      'End Date',
      'Status',
      'Quotation',
      'Paid Inflow',
      'Remaining Due',
      'Total Expenses',
      'Net Profit',
      'Deliverables'
    ];
    const rows = projects.map((p, idx) => [
      `PRJ-${String(idx + 1).padStart(3, '0')}`,
      `"${(p.title || '').replace(/"/g, '""')}"`,
      p.startDate || 'N/A',
      p.endDate || 'N/A',
      STATUS_CONFIG[p.status]?.label || p.status,
      p.budget || 0,
      p.totalPaid || 0,
      p.outstanding || 0,
      p.totalExpenses || 0,
      p.profit || 0,
      `"${(p.deliverables || '').replace(/"/g, '""')}"`
    ]);

    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luminosity-projects-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded', 'success');
  };

  // JSON Full Backup
  const handleExportBackup = async () => {
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studio-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Studio backup downloaded', 'success');
    } catch (err) {
      showToast(err.message || 'Export failed', 'error');
    }
  };

  const handleRestoreFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const payload = JSON.parse(ev.target.result);
        const mode = window.confirm('Merge with existing database? Click OK to merge, Cancel to abort.') ? 'merge' : null;
        if (!mode) return;
        const res = await importBackup(payload, mode);
        showToast(`Imported ${res.importedProjectsCount} projects!`, 'success');
        setIsDataModalOpen(false);
        await loadData();
      } catch (err) {
        showToast('Invalid backup file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  // Payments Hub inline log
  const handleQuickPayLog = async (projectId) => {
    const inputs = quickPayInputs[projectId] || {};
    const amt = parseFloat(inputs.amount);
    if (!amt || amt <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    try {
      await recordPayment(projectId, {
        amount: amt,
        date: inputs.date || todayISO(),
        method: inputs.method || 'UPI',
        note: inputs.note || ''
      });
      setQuickPayInputs((prev) => ({ ...prev, [projectId]: undefined }));
      showToast('Payment logged!', 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Error recording payment', 'error');
    }
  };

  const handleQuickSettle = async (projectId) => {
    try {
      await quickSettleProject(projectId);
      showToast('Project fully settled!', 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Error settling project', 'error');
    }
  };

  const handleDeleteInstallment = async (payId) => {
    if (!window.confirm('Delete payment installment?')) return;
    try {
      await deletePayment(payId);
      showToast('Installment removed', 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Error deleting payment', 'error');
    }
  };

  // Sort helper
  const handleSortClick = (col) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(['payment', 'paid', 'profit', 'expenses'].includes(col) ? 'desc' : 'asc');
    }
  };

  // Pending money total for header badge
  const pendingTotal = analytics?.pendingMoney || 0;

  return (
    <div className="tracker-page-root">
      {/* HEADER (Exact DOM from tracker.html) */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">
              <img src="/assets/images/logo-dark.png" alt="Luminosity Logo" className="brand-logo-img" />
            </div>
            <div>
              <div className="brand-title">LUMINOSITY</div>
              <div className="brand-subtitle">Project &amp; Financial Ledger</div>
            </div>
          </div>

          <div className="header-actions">
            <button className="btn btn-sm" id="dataBtn" title="Backup, Export CSV &amp; Restore Data" onClick={() => setIsDataModalOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Data &amp; CSV
            </button>

            <button
              className="btn btn-sm"
              id="paymentsOverviewBtn"
              title="Check all remaining payments and balances"
              onClick={() => setIsPaymentsHubOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Remaining Payments
              <span className={`badge-chip ${pendingTotal > 0 ? 'danger' : 'success'}`} id="headerPendingBadge">
                {fmtMoney(pendingTotal)}
              </span>
            </button>

            <button className="btn btn-sm btn-ghost" id="shortcutsBtn" title="Keyboard Shortcuts (?)" onClick={() => setIsShortcutsOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>

            <button
              className="btn btn-sm btn-ghost"
              title="Log Out of Luminosity"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log Out
            </button>

            <button
              className="btn-skull"
              id="resetBtn"
              title="Danger: Reset all data"
              onClick={() => setIsResetConfirmOpen(true)}
            >
              💀
            </button>
          </div>
        </div>
      </header>

      {/* RIGHT FRAME HOVER STRIP (SLIDE TO INVOICE GENERATOR) */}
      <a
        href="/invoices"
        className="right-edge-strip"
        id="rightInvoiceStrip"
        onClick={(e) => handleSlideToInvoice(e)}
        title="Click to Slide into Invoice Generator"
      >
        <div className="strip-tab">
          <div className="strip-dot"></div>
          <div className="strip-label">
            <span>INVOICE STUDIO</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
        <div className="strip-drawer-body">
          <div className="strip-header">
            <div className="strip-mark">
              <img src="/assets/images/logo-dark.png" alt="Luminosity Logo" className="brand-logo-img" />
            </div>
            <div className="strip-title">Invoice Generator</div>
          </div>
          <div className="strip-desc">Client billing, quotations, &amp; GST invoices.</div>
          <div className="strip-action-chip">
            <span>Slide to Invoices</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </a>

      {/* Slide Curtain Layer */}
      <div className="slide-curtain" id="slideCurtain"></div>

      {/* CONTROLS BAR */}
      <section className="controls-bar">
        <div className="controls-card">
          <div className="segmented-group">
            <button
              className={`segment-btn ${currentView === 'table' ? 'active' : ''}`}
              data-view="table"
              onClick={() => setCurrentView('table')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Table
            </button>
            <button
              className={`segment-btn ${currentView === 'grid' ? 'active' : ''}`}
              data-view="grid"
              onClick={() => setCurrentView('grid')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Grid
            </button>
            <button
              className={`segment-btn ${currentView === 'stats' ? 'active' : ''}`}
              data-view="stats"
              onClick={() => setCurrentView('stats')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 20V10" />
                <path d="M12 20V4" />
                <path d="M6 20v-6" />
              </svg>
              Analytics
            </button>
          </div>

          <div className="segmented-group" id="statusFilterGroup">
            {['all', 'upcoming', 'ongoing', 'pending', 'completed'].map((st) => (
              <button
                key={st}
                className={`segment-btn ${statusFilter === st ? 'active' : ''}`}
                data-filter={st}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'all' ? 'All' : STATUS_CONFIG[st]?.label}
              </button>
            ))}
          </div>

          <div className="date-filter-group">
            <span>Dates:</span>
            <input
              type="date"
              className="date-filter-input"
              id="filterStart"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Filter From Date"
            />
            <span>→</span>
            <input
              type="date"
              className="date-filter-input"
              id="filterEnd"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Filter To Date"
            />
            <button
              className="btn btn-sm btn-ghost"
              id="clearDatesBtn"
              title="Reset Dates"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              Reset
            </button>
          </div>

          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              id="searchInput"
              placeholder="Search projects, clients, notes… (Press /)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                id="searchClearBtn"
                style={{ display: 'block' }}
                onClick={() => setSearchQuery('')}
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </section>

      {/* MAIN VIEWS */}
      <main className="main-content">
        {/* TABLE VIEW */}
        <div id="tableView" className={`view-panel ${currentView === 'table' ? 'active' : ''}`}>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }} className="sortable" onClick={() => handleSortClick('status')}>
                    Status
                  </th>
                  <th style={{ width: '60px' }} className="sortable" onClick={() => handleSortClick('id')}>
                    ID
                  </th>
                  <th className="sortable" onClick={() => handleSortClick('title')}>
                    Client / Project
                  </th>
                  <th className="sortable" onClick={() => handleSortClick('date')}>
                    Dates
                  </th>
                  <th>Deliverables</th>
                  <th style={{ width: '110px' }} className="sortable" onClick={() => handleSortClick('payment')}>
                    Quotation
                  </th>
                  <th style={{ width: '170px' }} className="sortable" onClick={() => handleSortClick('paid')}>
                    Payment Progress
                  </th>
                  <th style={{ width: '105px' }} className="sortable" onClick={() => handleSortClick('expenses')}>
                    Expenses
                  </th>
                  <th style={{ width: '105px' }} className="sortable" onClick={() => handleSortClick('profit')}>
                    Net Profit
                  </th>
                  <th style={{ width: '170px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody id="tableBody">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No projects found. Click <strong>+ Record New Shoot</strong> at the bottom to create one.
                    </td>
                  </tr>
                ) : (
                  projects.map((p, idx) => {
                    const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.upcoming;
                    const budget = parseFloat(p.budget || p.payment) || 0;
                    const paid = parseFloat(p.totalPaid || p.paid) || 0;
                    const expenses = parseFloat(p.totalExpenses || p.expenses) || 0;
                    const profit = parseFloat(p.profit) || budget - expenses;
                    const pct = budget > 0 ? Math.min(100, Math.round((paid / budget) * 100)) : 0;
                    const isSettled = budget > 0 && paid >= budget;
                    const idTag = `PRJ-${String(idx + 1).padStart(3, '0')}`;

                    return (
                      <tr key={p.id}>
                        {/* Status Square & Popup */}
                        <td style={{ textAlign: 'center' }}>
                          <div className="status-picker-wrapper">
                            <button
                              type="button"
                              className="status-square-trigger"
                              style={{ '--sq-color': st.color }}
                              title={`Status: ${st.label} (Click to change)`}
                              onClick={() => setStatusPopupId(statusPopupId === p.id ? null : p.id)}
                            />
                            <div className={`status-navbar-popup ${statusPopupId === p.id ? 'open' : ''}`}>
                              {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                                <button
                                  key={k}
                                  type="button"
                                  className={`status-nav-square ${p.status === k ? 'active' : ''}`}
                                  style={{ '--nav-color': cfg.color }}
                                  title={cfg.label}
                                  onClick={() => handleQuickStatusChange(p.id, k)}
                                />
                              ))}
                            </div>
                          </div>
                        </td>

                        <td className="table-mono" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {idTag}
                        </td>

                        <td>
                          <div className="table-title">{p.title}</div>
                        </td>

                        <td>
                          <div className={`table-dates ${!p.startDate ? 'no-date' : ''}`}>
                            {fmtDateRange(p.startDate, p.endDate)}
                          </div>
                        </td>

                        <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.deliverables || '—'}
                        </td>

                        <td className="table-mono" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {fmtMoney(budget)}
                        </td>

                        {/* Interactive Payment Progress Bar */}
                        <td>
                          <div
                            className="pay-progress-mini"
                            title="Click to view Payment Ledger"
                            onClick={() => setIsPaymentsHubOpen(true)}
                          >
                            <div className="pay-progress-track">
                              <div
                                className="pay-progress-fill"
                                style={{
                                  width: `${pct}%`,
                                  background: isSettled ? 'var(--status-completed)' : 'var(--accent)'
                                }}
                              />
                            </div>
                            <div className="pay-progress-label">
                              <span style={{ color: isSettled ? 'var(--status-completed)' : 'var(--accent)' }}>
                                {fmtMoney(paid)}
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                            </div>
                          </div>
                        </td>

                        <td className="table-mono" style={{ color: 'var(--text-muted)' }}>
                          {fmtMoney(expenses)}
                        </td>

                        <td className="table-mono" style={{ fontWeight: '700', color: profit >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                          {fmtMoney(profit)}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              title="Payment Ledger"
                              onClick={() => setIsPaymentsHubOpen(true)}
                            >
                              💳
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              title="Open in Invoice Generator"
                              onClick={(e) => handleSlideToInvoice(e, p)}
                            >
                              📄
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              title="Edit Project"
                              onClick={() => openDropletModal(p)}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              style={{ color: 'var(--text-muted)' }}
                              title="Delete Project"
                              onClick={() => handleDeleteProject(p.id)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GRID VIEW */}
        <div id="gridView" className={`view-panel ${currentView === 'grid' ? 'active' : ''}`}>
          <div className="projects-grid" id="projectsGrid">
            {projects.map((p, idx) => {
              const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.upcoming;
              const budget = parseFloat(p.budget || p.payment) || 0;
              const paid = parseFloat(p.totalPaid || p.paid) || 0;
              const expenses = parseFloat(p.totalExpenses || p.expenses) || 0;
              const profit = parseFloat(p.profit) || budget - expenses;
              const pct = budget > 0 ? Math.min(100, Math.round((paid / budget) * 100)) : 0;
              const isSettled = budget > 0 && paid >= budget;
              const isCollapsed = collapsedExpenses[p.id] !== false; // collapsed by default

              return (
                <div
                  key={p.id}
                  className="project-card"
                  style={{ '--card-status-color': st.color }}
                >
                  <div className="project-card-top">
                    <div>
                      <div className="project-id">PRJ-{String(idx + 1).padStart(3, '0')}</div>
                      <div className="project-title">{p.title}</div>
                    </div>
                    {/* Status Picker in Card */}
                    <div className="status-picker-wrapper">
                      <button
                        type="button"
                        className="status-square-trigger"
                        style={{ '--sq-color': st.color }}
                        onClick={() => setStatusPopupId(statusPopupId === p.id ? null : p.id)}
                      />
                      <div className={`status-navbar-popup ${statusPopupId === p.id ? 'open' : ''}`}>
                        {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                          <button
                            key={k}
                            type="button"
                            className={`status-nav-square ${p.status === k ? 'active' : ''}`}
                            style={{ '--nav-color': cfg.color }}
                            title={cfg.label}
                            onClick={() => handleQuickStatusChange(p.id, k)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`project-dates ${!p.startDate ? 'no-date' : ''}`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>{fmtDateRange(p.startDate, p.endDate)}</span>
                  </div>

                  {p.deliverables && (
                    <div className="project-deliverables" title={p.deliverables}>
                      {p.deliverables}
                    </div>
                  )}

                  {/* Itemized Expenses Breakdown Card */}
                  <div className="expense-breakdown-card">
                    <div
                      className={`expense-breakdown-title ${isCollapsed ? 'collapsed' : ''}`}
                      onClick={() =>
                        setCollapsedExpenses((prev) => ({
                          ...prev,
                          [p.id]: !prev[p.id]
                        }))
                      }
                    >
                      <span>Itemized Expenses ({p.expenseItems?.length || 0})</span>
                      <span>
                        {fmtMoney(expenses)}{' '}
                        <span className="expense-chevron">▾</span>
                      </span>
                    </div>

                    {!isCollapsed && p.expenseItems && (
                      <div className="expense-items-list">
                        {p.expenseItems.map((e, ei) => (
                          <div key={ei} className="expense-item-row">
                            <span>{e.title}</span>
                            <span className="expense-item-amt">{fmtMoney(e.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment Progress bar inside card */}
                  <div
                    className="pay-progress-mini"
                    style={{ padding: '0 2px' }}
                    onClick={() => setIsPaymentsHubOpen(true)}
                  >
                    <div className="pay-progress-track">
                      <div
                        className="pay-progress-fill"
                        style={{
                          width: `${pct}%`,
                          background: isSettled ? 'var(--status-completed)' : 'var(--accent)'
                        }}
                      />
                    </div>
                    <div className="pay-progress-label">
                      <span>Paid: {fmtMoney(paid)}</span>
                      <span>{pct}%</span>
                    </div>
                  </div>

                  {/* Financial Grid */}
                  <div className="project-finances">
                    <div>
                      <div className="fin-label">Quoted</div>
                      <div className="fin-value">{fmtMoney(budget)}</div>
                    </div>
                    <div>
                      <div className="fin-label">Due</div>
                      <div className="fin-value" style={{ color: budget > paid ? 'var(--status-pending)' : 'var(--status-completed)' }}>
                        {budget > paid ? fmtMoney(budget - paid) : 'Settled ✓'}
                      </div>
                    </div>
                    <div>
                      <div className="fin-label">Net Profit</div>
                      <div className={`fin-value ${profit >= 0 ? 'profit-pos' : 'profit-neg'}`}>
                        {fmtMoney(profit)}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="project-card-bottom">
                    <div className="card-actions">
                      <button type="button" className="btn btn-xs" onClick={() => setIsPaymentsHubOpen(true)}>
                        💳 Payments
                      </button>
                      <button type="button" className="btn btn-xs" onClick={(e) => handleSlideToInvoice(e, p)}>
                        📄 Invoice
                      </button>
                      <button type="button" className="btn btn-xs btn-ghost" onClick={() => openDropletModal(p)}>
                        ✏️ Edit
                      </button>
                      <button type="button" className="btn btn-xs btn-ghost" onClick={() => handleDeleteProject(p.id)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STATS VIEW (Exact HTML & KPI Structure from tracker.html) */}
        <div id="statsView" className={`view-panel ${currentView === 'stats' ? 'active' : ''}`}>
          {analytics && (
            <div className="stats-container">
              <div className="stats-header-card">
                <div>
                  <div className="brand-title" style={{ fontSize: '17px' }}>Performance Analytics</div>
                  <div className="stats-period-title" id="statsPeriodLabel">
                    Timeframe: <span>{rangePreset === 'all' ? 'All Time' : rangePreset === 'this-month' ? 'This Month' : 'This Year'}</span>
                  </div>
                </div>
                <div className="segmented-group">
                  <button
                    className={`segment-btn ${rangePreset === 'all' ? 'active' : ''}`}
                    onClick={() => {
                      setRangePreset('all');
                      setStartDate('');
                      setEndDate('');
                    }}
                  >
                    All Time
                  </button>
                  <button
                    className={`segment-btn ${rangePreset === 'this-month' ? 'active' : ''}`}
                    onClick={() => {
                      setRangePreset('this-month');
                      const now = new Date();
                      const y = now.getFullYear();
                      const m = String(now.getMonth() + 1).padStart(2, '0');
                      const last = new Date(y, now.getMonth() + 1, 0).getDate();
                      setStartDate(`${y}-${m}-01`);
                      setEndDate(`${y}-${m}-${last}`);
                    }}
                  >
                    This Month
                  </button>
                  <button
                    className={`segment-btn ${rangePreset === 'this-year' ? 'active' : ''}`}
                    onClick={() => {
                      setRangePreset('this-year');
                      const y = new Date().getFullYear();
                      setStartDate(`${y}-01-01`);
                      setEndDate(`${y}-12-31`);
                    }}
                  >
                    This Year
                  </button>
                </div>
              </div>

              <div className="kpi-grid">
                <div className="kpi-card highlight">
                  <div className="kpi-label">Net Profit (Quoted)</div>
                  <div className="kpi-value accent" id="kpiNetProfit">{fmtMoney(analytics.netProfit)}</div>
                  <div className="kpi-sub" id="kpiMargin">Margin: {analytics.profitMargin}%</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Gross Revenue</div>
                  <div className="kpi-value" id="kpiRevenue">{fmtMoney(analytics.totalRevenue)}</div>
                  <div className="kpi-sub" id="kpiAvgRevenue">Avg: {fmtMoney(analytics.avgRevenue)}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Total Expenses</div>
                  <div className="kpi-value" id="kpiExpenses">{fmtMoney(analytics.totalExpenses)}</div>
                  <div className="kpi-sub" id="kpiExpenseRatio">Ratio: {analytics.expenseRatio}%</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Projects</div>
                  <div className="kpi-value" id="kpiTotalProjects">{analytics.totalProjects}</div>
                  <div className="kpi-sub" id="kpiCompletedProjects">{analytics.statusCounts?.completed || 0} Completed</div>
                </div>
              </div>

              <div className="breakdown-section">
                <div className="breakdown-card">
                  <div className="breakdown-title">
                    <span className="brand-mark" style={{ width: '16px', height: '16px', fontSize: '9px', borderRadius: '4px', display: 'inline-flex' }}>
                      ₹
                    </span>{' '}
                    Status Distribution
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
                    {Object.entries(analytics.statusPercentages || {}).map(([stKey, stData]) => {
                      const cfg = STATUS_CONFIG[stKey] || { label: stKey, color: 'var(--accent)' };
                      return (
                        <div key={stKey} className="progress-item">
                          <div className="progress-labels">
                            <span style={{ color: cfg.color }}>{cfg.label}</span>
                            <span className="table-mono">{stData.count}</span>
                          </div>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{ background: cfg.color, width: `${stData.pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="breakdown-card">
                  <div className="breakdown-title">
                    <span className="brand-mark" style={{ width: '16px', height: '16px', fontSize: '9px', borderRadius: '4px', display: 'inline-flex' }}>
                      ₹
                    </span>{' '}
                    Financial &amp; Cashflow Summary
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Cash Collected</span>
                      <span className="table-mono" style={{ color: 'var(--status-completed)', fontWeight: '600' }}>
                        {fmtMoney(analytics.totalPaid)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Pending Receivables</span>
                      <span className="table-mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>
                        {fmtMoney(analytics.pendingMoney)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Avg Expense / Project</span>
                      <span className="table-mono" style={{ color: 'var(--text-secondary)' }}>
                        {fmtMoney(analytics.avgExpense)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* =========================================================================
           BOTTOM CENTER LIQUID WATER DROPLET BUTTON (NEW PROJECT)
           ========================================================================= */}
      <div className="fab-dock" id="fabDock">
        <button
          type="button"
          className="fab-water-btn"
          id="fabWaterBtn"
          title="Click to Record Shoot (Keyboard shortcut: N)"
          onClick={(e) => openDropletModal(null, e)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Record New Shoot</span>
        </button>
      </div>

      {/* =========================================================================
           DROPLET MORPHING EXPANDING BUBBLE DIALOG (NEW / EDIT PROJECT)
           ========================================================================= */}
      <div className={`droplet-morph-overlay ${isDropletOpen ? 'open' : ''} ${isDropletClosing ? 'closing' : ''}`} onClick={(e) => e.target === e.currentTarget && closeDropletModal()}>
        <div className="droplet-morph-dialog" id="dropletDialog">
          <div className="droplet-water-sheen"></div>
          <div className="modal-head">
            <div className="modal-title" id="dropletModalTitle">
              {editingProject ? 'Edit Project / Shoot' : 'New Project / Shoot'}
            </div>
            <button type="button" className="modal-close" onClick={closeDropletModal}>
              &times;
            </button>
          </div>

          <form id="projectForm" onSubmit={handleSaveProjectForm}>
            <div className="form-group">
              <label className="form-label" htmlFor="fTitle">
                Client / Project Title *
              </label>
              <input
                type="text"
                id="fTitle"
                className="form-control"
                placeholder="e.g. Brown Ion - Restaurant Content Shoot"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shoot Dates</label>
              <div className="date-range-grid">
                <div className="date-field-sub">
                  <span>Start Date</span>
                  <input
                    type="date"
                    id="fStartDate"
                    className="form-control"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div className="date-field-sub">
                  <span>End / Delivery Date</span>
                  <input
                    type="date"
                    id="fEndDate"
                    className="form-control"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fPayment">
                Agreed Quotation Fee (₹)
              </label>
              <input
                type="number"
                step="0.01"
                id="fPayment"
                className="form-control"
                placeholder="₹ 50,000"
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fDeliverables">
                Scope &amp; Deliverables
              </label>
              <textarea
                id="fDeliverables"
                className="form-control"
                placeholder="e.g. 2 Commercial Reels, 40 High-Res Photos, Raw Data delivery"
                value={formDeliverables}
                onChange={(e) => setFormDeliverables(e.target.value)}
              />
            </div>

            {/* Itemized Expenses Builder with Quick Category Chips */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Itemized Production Expenses</label>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => setFormExpenses([...formExpenses, { title: '', amount: '' }])}
                >
                  + Add Expense Row
                </button>
              </div>

              {/* Presets Chips */}
              <div className="expense-presets-bar">
                {EXPENSE_PRESETS.map((p) => (
                  <span
                    key={p}
                    className="preset-chip"
                    onClick={() => setFormExpenses([...formExpenses, { title: p, amount: '' }])}
                  >
                    + {p}
                  </span>
                ))}
              </div>

              <div className="expense-items-builder" id="expenseItemsContainer">
                {formExpenses.map((exp, expIdx) => (
                  <div key={expIdx} className="expense-builder-row">
                    <input
                      type="text"
                      className="form-control exp-input-title"
                      placeholder="Expense Item / Crew"
                      value={exp.title}
                      onChange={(e) => {
                        const copy = [...formExpenses];
                        copy[expIdx].title = e.target.value;
                        setFormExpenses(copy);
                      }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="form-control exp-input-amt"
                      placeholder="₹ Amount"
                      value={exp.amount}
                      onChange={(e) => {
                        const copy = [...formExpenses];
                        copy[expIdx].amount = e.target.value;
                        setFormExpenses(copy);
                      }}
                    />
                    <button
                      type="button"
                      className="btn-icon-del"
                      title="Remove Item"
                      onClick={() => setFormExpenses(formExpenses.filter((_, i) => i !== expIdx))}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Profit Preview */}
            <div className="profit-display">
              <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Net Profit Preview (Quoted &minus; Expenses):</span>
              <span className="profit-val" id="modalProfitPreview" style={{ color: netProfit >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                {fmtMoney(netProfit)} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({profitMargin}%)</span>
              </span>
            </div>

            {/* Status Selector */}
            <div className="form-group">
              <label className="form-label">Project Status</label>
              <div className="status-selector">
                {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                  <button
                    key={k}
                    type="button"
                    className={`status-opt ${formStatus === k ? 'active' : ''}`}
                    data-status={k}
                    onClick={() => setFormStatus(k)}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeDropletModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" id="btnSaveProject">
                {editingProject ? 'Save Changes' : 'Record Project'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* =========================================================================
           PAYMENTS HUB (OUTSTANDING PAYMENTS & RECEIVABLES WINDOW)
           ========================================================================= */}
      <div className={`payments-modal-overlay ${isPaymentsHubOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setIsPaymentsHubOpen(false)}>
        <div className="payments-modal-window">
          <div className="payments-window-header">
            <div>
              <div className="payments-window-title">
                <span className="brand-mark" style={{ width: '22px', height: '22px', fontSize: '11px', borderRadius: '5px', display: 'inline-flex' }}>₹</span>
                Remaining Payments &amp; Receivables
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Track milestones, installments, advance deposits, and settle dues.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="segmented-group">
                <button
                  className={`segment-btn ${paymentsHubFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setPaymentsHubFilter('pending')}
                >
                  Due Receivables
                </button>
                <button
                  className={`segment-btn ${paymentsHubFilter === 'settled' ? 'active' : ''}`}
                  onClick={() => setPaymentsHubFilter('settled')}
                >
                  Settled
                </button>
                <button
                  className={`segment-btn ${paymentsHubFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setPaymentsHubFilter('all')}
                >
                  All Shoots
                </button>
              </div>

              <button type="button" className="modal-close" onClick={() => setIsPaymentsHubOpen(false)}>
                &times;
              </button>
            </div>
          </div>

          <div className="payments-window-body">
            {/* KPI Bar */}
            <div className="payments-kpi-bar">
              <div className="pay-kpi-box">
                <div className="pay-kpi-label">Total Invoiced Quoted</div>
                <div className="pay-kpi-val">{fmtMoney(analytics?.totalRevenue || 0)}</div>
              </div>
              <div className="pay-kpi-box">
                <div className="pay-kpi-label">Received Cash Inflow</div>
                <div className="pay-kpi-val" style={{ color: 'var(--status-completed)' }}>
                  {fmtMoney(analytics?.totalPaid || 0)}
                </div>
              </div>
              <div className="pay-kpi-box">
                <div className="pay-kpi-label">Outstanding Receivables Due</div>
                <div className="pay-kpi-val" style={{ color: 'var(--accent)' }}>
                  {fmtMoney(analytics?.pendingMoney || 0)}
                </div>
              </div>
            </div>

            {/* List of Project Payment Cards */}
            {projects
              .filter((p) => {
                const budget = parseFloat(p.budget || p.payment) || 0;
                const paid = parseFloat(p.totalPaid || p.paid) || 0;
                if (paymentsHubFilter === 'pending') return budget > paid;
                if (paymentsHubFilter === 'settled') return budget > 0 && paid >= budget;
                return true;
              })
              .map((p) => {
                const budget = parseFloat(p.budget || p.payment) || 0;
                const paid = parseFloat(p.totalPaid || p.paid) || 0;
                const remaining = Math.max(0, budget - paid);
                const isSettled = budget > 0 && paid >= budget;
                const currentInputs = quickPayInputs[p.id] || { amount: remaining > 0 ? remaining : '', date: todayISO(), method: 'UPI', note: '' };

                return (
                  <div key={p.id} className={`pay-project-card ${isSettled ? 'settled' : 'pending'}`}>
                    <div className="pay-project-head">
                      <div>
                        <div className="pay-project-title">{p.title}</div>
                        <div className="pay-project-meta">
                          {fmtDateRange(p.startDate, p.endDate)} &bull; Scope: {p.deliverables || '—'}
                        </div>
                      </div>

                      <div className="pay-project-figures">
                        <div className="pay-figure-item">
                          <span className="pay-figure-label">Total Fee</span>
                          <span className="pay-figure-val">{fmtMoney(budget)}</span>
                        </div>
                        <div className="pay-figure-item">
                          <span className="pay-figure-label">Collected</span>
                          <span className="pay-figure-val" style={{ color: 'var(--status-completed)' }}>{fmtMoney(paid)}</span>
                        </div>
                        <div className="pay-figure-item">
                          <span className="pay-figure-label">Due</span>
                          <span className="pay-figure-val" style={{ color: remaining > 0 ? 'var(--status-pending)' : 'var(--status-completed)' }}>
                            {remaining > 0 ? fmtMoney(remaining) : 'Settled ✓'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Records Sub-List */}
                    {p.paymentRecords && p.paymentRecords.length > 0 && (
                      <div className="pay-history-container">
                        <div className="pay-history-title">
                          <span>Installment Records ({p.paymentRecords.length})</span>
                          <span>Sum: {fmtMoney(paid)}</span>
                        </div>
                        {p.paymentRecords.map((r) => (
                          <div key={r.id} className="pay-record-row">
                            <span className="pr-date">{fmtDateSingle(r.date)}</span>
                            <span className="pr-method">{r.method || 'UPI'}</span>
                            <span className="pr-note" title={r.note}>{r.note || '—'}</span>
                            <span className="pr-amt">+{fmtMoney(r.amount)}</span>
                            <button
                              type="button"
                              className="btn-icon-del"
                              style={{ width: '24px', height: '24px', fontSize: '13px' }}
                              onClick={() => handleDeleteInstallment(r.id)}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Quick Payment Logging Form */}
                    <div className="quick-pay-form">
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="₹ Amount"
                        value={currentInputs.amount}
                        onChange={(e) =>
                          setQuickPayInputs((prev) => ({
                            ...prev,
                            [p.id]: { ...currentInputs, amount: e.target.value }
                          }))
                        }
                      />
                      <input
                        type="date"
                        className="form-control"
                        value={currentInputs.date}
                        onChange={(e) =>
                          setQuickPayInputs((prev) => ({
                            ...prev,
                            [p.id]: { ...currentInputs, date: e.target.value }
                          }))
                        }
                      />
                      <select
                        className="form-control"
                        value={currentInputs.method}
                        onChange={(e) =>
                          setQuickPayInputs((prev) => ({
                            ...prev,
                            [p.id]: { ...currentInputs, method: e.target.value }
                          }))
                        }
                      >
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="NEFT / RTGS">NEFT / RTGS</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Card">Card</option>
                        <option value="Other">Other</option>
                      </select>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Milestone note (e.g. Advance #1)"
                        value={currentInputs.note}
                        onChange={(e) =>
                          setQuickPayInputs((prev) => ({
                            ...prev,
                            [p.id]: { ...currentInputs, note: e.target.value }
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleQuickPayLog(p.id)}
                      >
                        + Log
                      </button>
                      {remaining > 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          style={{ color: 'var(--accent)', borderColor: 'var(--border-accent)' }}
                          onClick={() => handleQuickSettle(p.id)}
                          title="Settle full balance in 1 click"
                        >
                          ⚡ Settle Full
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={(e) => handleSlideToInvoice(e, p)}
                        title="Generate Official Invoice"
                      >
                        📄 Official Invoice ↗
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* =========================================================================
           DATA & BACKUPS MODAL
           ========================================================================= */}
      {isDataModalOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsDataModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <div className="modal-title">📦 Data, Backups &amp; CSV</div>
              <button type="button" className="modal-close" onClick={() => setIsDataModalOpen(false)}>
                &times;
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                All business records are backed up securely in your centralized MySQL database. You can also export or import standardized JSON snapshots or CSV spreadsheets.
              </p>

              <button type="button" className="btn btn-primary" onClick={handleExportBackup}>
                📥 Download Full Studio Backup (JSON)
              </button>

              <button type="button" className="btn btn-ghost" onClick={handleExportCsv}>
                📊 Export Financial Ledger (CSV)
              </button>

              <label className="btn btn-ghost" style={{ cursor: 'pointer', textAlign: 'center' }}>
                📤 Restore Studio Database File (JSON)
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={handleRestoreFile}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
           KEYBOARD SHORTCUTS GUIDE MODAL
           ========================================================================= */}
      {isShortcutsOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsShortcutsOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <div className="modal-head">
              <div className="modal-title">⌨️ Keyboard Shortcuts</div>
              <button type="button" className="modal-close" onClick={() => setIsShortcutsOpen(false)}>
                &times;
              </button>
            </div>
            <div className="shortcuts-grid">
              <div className="shortcut-row">
                <span>Switch to Table View</span>
                <span className="kbd-key">1</span>
              </div>
              <div className="shortcut-row">
                <span>Switch to Grid View</span>
                <span className="kbd-key">2</span>
              </div>
              <div className="shortcut-row">
                <span>Switch to Analytics</span>
                <span className="kbd-key">3</span>
              </div>
              <div className="shortcut-row">
                <span>New Project (Water FAB)</span>
                <span className="kbd-key">N</span>
              </div>
              <div className="shortcut-row">
                <span>Focus Search Bar</span>
                <span className="kbd-key">/</span>
              </div>
              <div className="shortcut-row">
                <span>Close All Modals</span>
                <span className="kbd-key">Esc</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
           SKULL DANGER RESET MODAL
           ========================================================================= */}
      {isResetConfirmOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsResetConfirmOpen(false)}>
          <div className="modal-container confirm-box">
            <div className="modal-head">
              <div className="modal-title" style={{ color: 'var(--danger)' }}>⚠️ Reset Database Records</div>
              <button type="button" className="modal-close" onClick={() => setIsResetConfirmOpen(false)}>
                &times;
              </button>
            </div>
            <div className="confirm-msg">
              Are you sure you want to reset studio project data? This operation deletes local cached project states and restores default fixtures.
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setIsResetConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  setIsResetConfirmOpen(false);
                  showToast('Database reset action acknowledged', 'error');
                }}
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION CONTAINER */}
      <div className="toast-container" id="toastContainer">
        {toast.show && (
          <div className={`toast show ${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
