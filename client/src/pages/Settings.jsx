import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import {
  getSettings,
  updateSettings,
  uploadLogo,
  deleteLogo,
  exportBackup,
  importBackup,
  resetSequenceCounter
} from '../services/api';

export default function Settings() {
  const [settings, setSettings] = useState({
    studioName: 'Luminav Films',
    companyName: 'Luminav Films',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    currency: '₹',
    logoUrl: '',
    terms: ''
  });

  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [importing, setImporting] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s) setSettings(s);
      })
      .catch((e) => console.warn('Could not load settings:', e.message));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(settings);
      showToast('Settings saved to MySQL database');
    } catch (err) {
      alert(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const res = await uploadLogo(formData);
      setSettings((prev) => ({ ...prev, logoUrl: res.logoUrl }));
      showToast('Logo uploaded and linked');
    } catch (err) {
      alert(err.message || 'Failed to upload logo');
    }
  };

  const handleDeleteLogo = async () => {
    if (!window.confirm('Remove studio logo?')) return;
    try {
      await deleteLogo();
      setSettings((prev) => ({ ...prev, logoUrl: '' }));
      showToast('Logo removed');
    } catch (err) {
      alert(err.message || 'Error removing logo');
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `luminosity-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Database backup downloaded successfully');
    } catch (err) {
      alert(err.message || 'Export failed');
    }
  };

  const handleImportBackupFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const payload = JSON.parse(ev.target.result);
        const mode = window.confirm(
          'Choose Import Strategy:\n\nClick OK to MERGE records with existing data.\nClick CANCEL to ABORT.\n\n(To replace all records, contact database administrator).'
        )
          ? 'merge'
          : null;

        if (!mode) return;

        setImporting(true);
        const result = await importBackup(payload, mode);
        showToast(
          `Import complete: ${result.importedProjectsCount} projects, ${result.importedInvoicesCount} invoices.`
        );
      } catch (err) {
        alert('Invalid JSON backup file: ' + err.message);
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetSequence = async () => {
    if (!window.confirm('Reset current month invoice sequence counter to 0?')) return;
    try {
      await resetSequenceCounter();
      showToast('Invoice sequence counter reset to 0');
    } catch (err) {
      alert(err.message || 'Error resetting counter');
    }
  };

  return (
    <div className="app-shell">
      <Navbar />

      <main className="main-content">
        {toastMsg && (
          <div className="toast success" style={{ position: 'fixed', top: '80px', right: '40px', zIndex: 9999 }}>
            ✓ {toastMsg}
          </div>
        )}

        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}>
              ⚙️ Studio &amp; System Settings
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Configure your studio profile, invoice branding defaults, and database backups
            </div>
          </div>

          {/* Form Card */}
          <div className="table-card" style={{ padding: '28px', marginBottom: '28px' }}>
            <form onSubmit={handleSave}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '18px', color: 'var(--accent)' }}>
                Studio Identity &amp; Branding
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Studio Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.studioName || ''}
                    onChange={(e) => setSettings({ ...settings, studioName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Business Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.companyName || ''}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Company Address (Multi-line)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={settings.companyAddress || ''}
                  onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Company Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.companyPhone || ''}
                    onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={settings.companyEmail || ''}
                    onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.currency || '₹'}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                  />
                </div>
              </div>

              {/* Logo Management */}
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Studio Logo (A4 Sheet Header)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {settings.logoUrl ? (
                    <div style={{ padding: '8px', background: '#ffffff', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: '42px', maxWidth: '140px', objectFit: 'contain' }} />
                      <button type="button" className="btn-icon-del" onClick={handleDeleteLogo} title="Remove Logo">
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No custom logo uploaded.</div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ fontSize: '12px' }}
                    onChange={handleLogoFile}
                  />
                </div>
              </div>

              {/* Terms */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Default Invoice Terms &amp; Conditions</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={settings.terms || ''}
                  onChange={(e) => setSettings({ ...settings, terms: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleResetSequence}>
                  🔄 Reset Month Sequence #
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>

          {/* Database Backup & Restore Card */}
          <div className="table-card" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: 'var(--accent)' }}>
              📦 Database Backup &amp; Migration Hub
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Export your entire MySQL database (projects, clients, itemized expenses, payments, invoices, settings) to a standardized JSON backup file, or restore from a previous export.
            </p>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={handleExportBackup}>
                📥 Export Full Database (JSON)
              </button>

              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                📤 Import Backup File
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImportBackupFile}
                  disabled={importing}
                />
              </label>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
