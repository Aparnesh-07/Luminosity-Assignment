import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProjectModal from '../components/ProjectModal';
import PaymentLedger from '../components/PaymentLedger';
import PaymentsOverviewModal from '../components/PaymentsOverviewModal';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getOverviewAnalytics
} from '../services/api';
import { fmtMoney, fmtDateSingle, fmtDateRange, todayISO } from '../utils/format';

const STATUS_CONFIG = {
  upcoming: { label: 'Upcoming', color: 'var(--status-upcoming)' },
  ongoing: { label: 'Ongoing', color: 'var(--status-ongoing)' },
  pending: { label: 'Payment Pending', color: 'var(--status-pending)' },
  completed: { label: 'Completed', color: 'var(--status-completed)' }
};

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [currentView, setCurrentView] = useState('table'); // 'table' | 'grid' | 'stats'
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('asc');

  // Modals state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [activePaymentProject, setActivePaymentProject] = useState(null);
  const [isPaymentsOverviewOpen, setIsPaymentsOverviewOpen] = useState(false);
  const [statusPickerId, setStatusPickerId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const navigate = useNavigate();

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
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, startDate, endDate, sortCol, sortDir]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === '1') setCurrentView('table');
      if (e.key === '2') setCurrentView('grid');
      if (e.key === '3') setCurrentView('stats');
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingProject(null);
        setIsProjectModalOpen(true);
      }
      if (e.key === 'Escape') {
        setStatusPickerId(null);
        setDeleteConfirmId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Droplet splash on FAB
  const triggerDropletAnimation = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const ring = document.createElement('div');
    ring.className = 'droplet-splash-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 750);
  };

  const handleOpenNew = (e) => {
    if (e) triggerDropletAnimation(e);
    setEditingProject(null);
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = async (payload, existingId) => {
    if (existingId) {
      await updateProject(existingId, payload);
    } else {
      await createProject(payload);
    }
    await loadData();
  };

  const handleUpdateStatus = async (projectId, newStatus) => {
    try {
      await updateProject(projectId, { status: newStatus });
      setStatusPickerId(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await deleteProject(projectId);
      setDeleteConfirmId(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    }
  };

  const handleJumpToInvoice = (project) => {
    // Navigate to /invoices and pass project data in state
    navigate('/invoices', {
      state: {
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
    });
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(['budget', 'paid', 'profit'].includes(col) ? 'desc' : 'asc');
    }
  };

  // CSV Spreadsheet Export
  const handleExportCsv = () => {
    if (!projects.length) {
      alert('No project data to export');
      return;
    }
    const headers = [
      'Project ID',
      'Client / Title',
      'Start Date',
      'End Date',
      'Status',
      'Quotation (INR)',
      'Paid Inflow (INR)',
      'Remaining Due (INR)',
      'Total Expenses (INR)',
      'Net Profit (INR)',
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

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luminosity-financial-report-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <Navbar onOpenNewProject={handleOpenNew} />

      <main className="main-content">
        {/* KPI Header Grid */}
        {analytics && (
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-title">Gross Revenue</div>
              <div className="kpi-val">{fmtMoney(analytics.totalRevenue)}</div>
              <div className="kpi-sub">Avg: {fmtMoney(analytics.avgRevenue)} / shoot</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Net Studio Profit</div>
              <div className="kpi-val" style={{ color: analytics.netProfit >= 0 ? 'var(--status-completed)' : 'var(--danger)' }}>
                {fmtMoney(analytics.netProfit)}
              </div>
              <div className="kpi-sub">Margin: {analytics.profitMargin}%</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Cash Collected</div>
              <div className="kpi-val" style={{ color: 'var(--status-completed)' }}>{fmtMoney(analytics.totalPaid)}</div>
              <div className="kpi-sub">Pending: {fmtMoney(analytics.pendingMoney)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Total Shoots</div>
              <div className="kpi-val">{analytics.totalProjects}</div>
              <div className="kpi-sub">{analytics.statusCounts?.completed || 0} Completed</div>
            </div>
          </div>
        )}

        {/* Action Controls & Filtering Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* View Switcher */}
            <div className="segmented-group">
              <button
                type="button"
                className={`segment-btn ${currentView === 'table' ? 'active' : ''}`}
                onClick={() => setCurrentView('table')}
                title="Keyboard shortcut: 1"
              >
                📋 Table
              </button>
              <button
                type="button"
                className={`segment-btn ${currentView === 'grid' ? 'active' : ''}`}
                onClick={() => setCurrentView('grid')}
                title="Keyboard shortcut: 2"
              >
                🎴 Cards
              </button>
              <button
                type="button"
                className={`segment-btn ${currentView === 'stats' ? 'active' : ''}`}
                onClick={() => setCurrentView('stats')}
                title="Keyboard shortcut: 3"
              >
                📊 Analytics
              </button>
            </div>

            {/* Status Segments */}
            <div className="segmented-group">
              {['all', 'upcoming', 'ongoing', 'pending', 'completed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`segment-btn ${statusFilter === st ? 'active' : ''}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'all' ? 'All' : STATUS_CONFIG[st]?.label}
                </button>
              ))}
            </div>

            {/* Date Preset Buttons */}
            <div className="segmented-group">
              <button
                type="button"
                className={`segment-btn ${!startDate && !endDate ? 'active' : ''}`}
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              >
                All Time
              </button>
              <button
                type="button"
                className="segment-btn"
                onClick={() => {
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
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              className="form-control"
              style={{ width: '220px' }}
              placeholder="🔍 Search shoots / scope..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsPaymentsOverviewOpen(true)}
              title="Global Receivables and Dues Window"
            >
              💳 Dues Hub
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleExportCsv}
              title="Export CSV spreadsheet for Excel"
            >
              📥 CSV
            </button>
          </div>
        </div>

        {/* VIEW 1: TABLE VIEW */}
        {currentView === 'table' && (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('title')}>Shoot / Client</th>
                  <th className="sortable" onClick={() => handleSort('date')}>Dates</th>
                  <th className="sortable" onClick={() => handleSort('status')}>Status</th>
                  <th className="sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('budget')}>Quotation</th>
                  <th className="sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('paid')}>Received</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th style={{ textAlign: 'right' }}>Expenses</th>
                  <th className="sortable" style={{ textAlign: 'right' }} onClick={() => handleSort('profit')}>Net Profit</th>
                  <th style={{ textAlign: 'center', width: '170px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Loading shoots from MySQL database...
                    </td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No projects matching your filters. Click <strong>+ New Shoot</strong> to log a project.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => {
                    const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.upcoming;
                    const isDue = (p.outstanding || 0) > 0;

                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{p.title}</div>
                          {p.deliverables && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {p.deliverables}
                            </div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {fmtDateRange(p.startDate, p.endDate)}
                        </td>
                        <td>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className="badge-chip"
                              style={{ color: st.color, borderColor: st.color, cursor: 'pointer' }}
                              onClick={() => setStatusPickerId(statusPickerId === p.id ? null : p.id)}
                            >
                              <span className="status-indicator-dot" style={{ background: st.color }}></span>
                              <span>{st.label} ▾</span>
                            </button>

                            {statusPickerId === p.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  marginTop: '4px',
                                  background: 'var(--bg-surface-elevated)',
                                  border: '1px solid var(--border-highlight)',
                                  borderRadius: '8px',
                                  padding: '4px',
                                  zIndex: 100,
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  minWidth: '150px'
                                }}
                              >
                                {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                                  <button
                                    key={k}
                                    type="button"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      textAlign: 'left',
                                      padding: '6px 10px',
                                      borderRadius: '4px',
                                      color: cfg.color,
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => handleUpdateStatus(p.id, k)}
                                  >
                                    &bull; {cfg.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmtMoney(p.budget)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--status-completed)', fontWeight: '600' }}>
                          {fmtMoney(p.totalPaid)}
                        </td>
                        <td style={{ textAlign: 'right', color: isDue ? 'var(--status-pending)' : 'var(--status-completed)', fontWeight: '700' }}>
                          {isDue ? fmtMoney(p.outstanding) : 'Settled ✓'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{fmtMoney(p.totalExpenses)}</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: p.profit >= 0 ? 'var(--status-completed)' : 'var(--danger)' }}>
                          {fmtMoney(p.profit)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Payment Ledger & Dues"
                              onClick={() => setActivePaymentProject(p)}
                            >
                              💳
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Generate Official Invoice"
                              onClick={() => handleJumpToInvoice(p)}
                            >
                              📄
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Edit Details"
                              onClick={() => {
                                setEditingProject(p);
                                setIsProjectModalOpen(true);
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="btn-icon-del"
                              title="Delete Shoot"
                              onClick={() => setDeleteConfirmId(p.id)}
                            >
                              &times;
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
        )}

        {/* VIEW 2: GRID CARDS VIEW */}
        {currentView === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
            {projects.map((p) => {
              const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.upcoming;
              const budget = p.budget || 0;
              const paid = p.totalPaid || 0;
              const paidPct = budget > 0 ? Math.min(100, Math.round((paid / budget) * 100)) : 0;

              return (
                <div key={p.id} className="kpi-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <span className="badge-chip" style={{ color: st.color, borderColor: st.color }}>
                        &bull; {st.label}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {fmtDateRange(p.startDate, p.endDate)}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                      {p.title}
                    </h3>
                    {p.deliverables && (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.4' }}>
                        {p.deliverables}
                      </div>
                    )}

                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '14px' }}>
                      <div style={{ width: `${paidPct}%`, height: '100%', background: paid >= budget ? 'var(--status-completed)' : 'var(--accent)', transition: 'width 0.3s ease' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center', padding: '10px', background: 'var(--bg-surface-elevated)', borderRadius: '8px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>FEE</div>
                        <div style={{ fontWeight: '600', fontSize: '13.5px' }}>{fmtMoney(budget)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PAID</div>
                        <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--status-completed)' }}>{fmtMoney(paid)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PROFIT</div>
                        <div style={{ fontWeight: '700', fontSize: '13.5px', color: p.profit >= 0 ? 'var(--status-completed)' : 'var(--danger)' }}>
                          {fmtMoney(p.profit)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActivePaymentProject(p)}>
                      💳 Payments
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleJumpToInvoice(p)}>
                      📄 Invoice
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditingProject(p);
                        setIsProjectModalOpen(true);
                      }}
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 3: STATS VIEW */}
        {currentView === 'stats' && analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="kpi-card">
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>📊 Status Breakdown</h3>
              {Object.entries(analytics.statusPercentages || {}).map(([key, item]) => {
                const cfg = STATUS_CONFIG[key] || { label: key, color: 'var(--accent)' };
                return (
                  <div key={key} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span style={{ color: cfg.color, fontWeight: '600' }}>&bull; {cfg.label}</span>
                      <span>{item.count} shoots ({item.pct}%)</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', background: cfg.color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="kpi-card">
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>💵 Financial Efficiency Metrics</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Billed Value:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmtMoney(analytics.totalRevenue)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Expenses Incurred:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{fmtMoney(analytics.totalExpenses)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Net Profit Inflow:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-completed)' }}>{fmtMoney(analytics.netProfit)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Operating Profit Margin:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{analytics.profitMargin}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uncollected Receivables:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-pending)' }}>{fmtMoney(analytics.pendingMoney)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        className="fab-btn"
        onClick={handleOpenNew}
        title="Record New Shoot (Keyboard shortcut: N)"
      >
        +
      </button>

      {/* Modals */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        project={editingProject}
      />

      <PaymentLedger
        isOpen={!!activePaymentProject}
        onClose={() => setActivePaymentProject(null)}
        project={activePaymentProject}
        onRefresh={loadData}
      />

      <PaymentsOverviewModal
        isOpen={isPaymentsOverviewOpen}
        onClose={() => setIsPaymentsOverviewOpen(false)}
        projects={projects}
        onRefresh={loadData}
        onOpenInvoice={handleJumpToInvoice}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay open" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div className="modal-title">Delete Shoot</div>
              <button type="button" className="btn-icon" onClick={() => setDeleteConfirmId(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to permanently delete this project record?</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '6px' }}>
                This will remove all associated payment installments and itemized expenses from MySQL.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDeleteProject(deleteConfirmId)}
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
