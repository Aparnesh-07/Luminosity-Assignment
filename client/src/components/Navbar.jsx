import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOverviewAnalytics } from '../services/api';
import { fmtMoney } from '../utils/format';

export default function Navbar({ onOpenNewProject }) {
  const { user, studio, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingTotal, setPendingTotal] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const stats = await getOverviewAnalytics();
        if (mounted && stats) {
          setPendingTotal(stats.pendingMoney || 0);
        }
      } catch (e) {
        // Silently handle if not ready
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="brand-section">
        <img
          src="/assets/images/logo-dark.png"
          alt="Luminosity Logo"
          className="brand-logo-img"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
        <div className="brand-title">
          <span>LUMINOSITY</span>
          <span className="brand-subtitle-tag">{studio?.name || 'STUDIO SUITE'}</span>
        </div>
      </div>

      <nav className="nav-links">
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>🎬 Projects</span>
        </NavLink>
        <NavLink to="/clients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>👥 Clients</span>
        </NavLink>
        <NavLink to="/invoices" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>📄 Invoices</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>⚙️ Settings</span>
        </NavLink>
      </nav>

      <div className="header-actions">
        {pendingTotal > 0 ? (
          <span className="badge-chip pending" title="Pending Uncollected Receivables">
            Due: {fmtMoney(pendingTotal)}
          </span>
        ) : (
          <span className="badge-chip success" title="All payments collected">
            Settled ✓
          </span>
        )}

        {onOpenNewProject && (
          <button className="btn btn-primary btn-sm" onClick={onOpenNewProject}>
            + New Shoot
          </button>
        )}

        <div className="user-pill">
          <span className="user-avatar-dot"></span>
          <span>{user?.name || user?.email?.split('@')[0]}</span>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Sign Out">
          Log Out
        </button>
      </div>
    </header>
  );
}
