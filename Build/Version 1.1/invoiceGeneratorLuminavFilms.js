(function () {
      "use strict";

      /* ---------------------------------------------------------------
         STORAGE LAYER
         Uses localStorage so everything saved here stays on this PC,
         in this browser, across sessions — meant for running the file
         locally rather than inside Claude.ai.
      --------------------------------------------------------------- */
      const STORAGE_PREFIX = 'invoiceApp:';
      const memoryStore = {};

      function lsAvailable() {
        try {
          const t = '__ledgerline_test__';
          localStorage.setItem(t, '1');
          localStorage.removeItem(t);
          return true;
        } catch (e) { return false; }
      }
      const hasLocalStorage = lsAvailable();

      async function storeGet(key) {
        if (hasLocalStorage) {
          return localStorage.getItem(STORAGE_PREFIX + key);
        }
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
      }
      async function storeSet(key, value) {
        if (hasLocalStorage) {
          try { localStorage.setItem(STORAGE_PREFIX + key, value); return true; } catch (e) { return false; }
        }
        memoryStore[key] = value; return true;
      }
      async function storeDelete(key) {
        if (hasLocalStorage) { localStorage.removeItem(STORAGE_PREFIX + key); return true; }
        delete memoryStore[key]; return true;
      }
      async function listAllKeys() {
        if (hasLocalStorage) {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.indexOf(STORAGE_PREFIX) === 0) keys.push(k.slice(STORAGE_PREFIX.length));
          }
          return keys;
        }
        return Object.keys(memoryStore);
      }

      /* ---------------------------------------------------------------
         STATE
      --------------------------------------------------------------- */
      const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

      let settings = {
        currency: '₹',
        companyName: '',
        companyAddress: '',
        companyPhone: '',
        companyEmail: '',
        logoDataUrl: '',
        terms: 'All deliverables are provided as per the agreed project scope.\nAny additional revisions or services beyond the agreed scope may be charged separately.\nThis invoice confirms that full payment has been received and the project has been successfully completed.'
      };

      let invoice = {
        id: '',
        date: todayISO(),
        billName: '',
        billCompany: '',
        billPhone: '',
        billEmail: '',
        project: '',
        items: [],
        discount: 0,
        advance: 0
      };

      let dbSort = { key: 'dateIso', dir: 'desc' };
      let dbSearch = '';

      function todayISO() {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
      }

      function newItem() {
        return { key: Math.random().toString(36).slice(2, 9), description: '', qty: 1, price: 0 };
      }

      /* ---------------------------------------------------------------
         INVOICE ID GENERATION — #MON + SEQ(2) + RAND(2)
      --------------------------------------------------------------- */
      async function generateInvoiceId(isoDate) {
        const d = parseISO(isoDate);
        const monKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const seqStorageKey = `seq:${monKey}`;
        let seq = parseInt(await storeGet(seqStorageKey), 10);
        if (isNaN(seq)) seq = 0;
        seq += 1;
        await storeSet(seqStorageKey, String(seq));
        const mon = MONTHS[d.getMonth()];
        const seqStr = String(seq).padStart(2, '0');
        const rand = String(Math.floor(Math.random() * 100)).padStart(2, '0');
        return `${mon}${seqStr}${rand}`;
      }

      function parseISO(iso) {
        const [y, m, day] = iso.split('-').map(Number);
        return new Date(y, m - 1, day);
      }

      function formatDisplayDate(iso) {
        const d = parseISO(iso);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      }

      function formatCurrency(n) {
        n = Number(n) || 0;
        const opts = (n % 1 !== 0) ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
        return (settings.currency || '₹') + ' ' + n.toLocaleString(undefined, opts);
      }

      function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }

      function initials(name) {
        if (!name) return 'L';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return 'L';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }

      /* ---------------------------------------------------------------
         RENDER: SIDEBAR FORM (line items)
      --------------------------------------------------------------- */
      function renderItemRows() {
        const container = document.getElementById('itemsContainer');
        container.innerHTML = '';
        invoice.items.forEach((item, idx) => {
          const row = document.createElement('div');
          row.className = 'item-row';
          row.innerHTML = `
        ${invoice.items.length > 1 ? '<button class="remove-item" data-idx="' + idx + '" title="Remove item">&times;</button>' : ''}
        <div class="field-group">
          <label class="field-label">Description</label>
          <input type="text" class="item-desc" data-idx="${idx}" value="${escapeHtml(item.description)}" placeholder="e.g. DOP services - shoot day">
        </div>
        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Quantity</label>
            <input type="number" class="item-qty" data-idx="${idx}" value="${item.qty}" min="0" step="1">
          </div>
          <div class="field-group">
            <label class="field-label">Price</label>
            <input type="number" class="item-price" data-idx="${idx}" value="${item.price}" min="0" step="0.01">
          </div>
        </div>
        <div class="item-amount-line"><span>Amount</span><b class="item-line-amount" data-idx="${idx}">${formatCurrency((Number(item.qty) || 0) * (Number(item.price) || 0))}</b></div>
      `;
          container.appendChild(row);
        });

        container.querySelectorAll('.item-desc').forEach(el => el.addEventListener('input', e => {
          invoice.items[+e.target.dataset.idx].description = e.target.value;
          renderPreview();
        }));
        container.querySelectorAll('.item-qty').forEach(el => el.addEventListener('input', e => {
          const idx = +e.target.dataset.idx;
          invoice.items[idx].qty = e.target.value;
          const amt = (Number(invoice.items[idx].qty) || 0) * (Number(invoice.items[idx].price) || 0);
          container.querySelector(`.item-line-amount[data-idx="${idx}"]`).textContent = formatCurrency(amt);
          renderPreview();
        }));
        container.querySelectorAll('.item-price').forEach(el => el.addEventListener('input', e => {
          const idx = +e.target.dataset.idx;
          invoice.items[idx].price = e.target.value;
          const amt = (Number(invoice.items[idx].qty) || 0) * (Number(invoice.items[idx].price) || 0);
          container.querySelector(`.item-line-amount[data-idx="${idx}"]`).textContent = formatCurrency(amt);
          renderPreview();
        }));
        container.querySelectorAll('.remove-item').forEach(el => el.addEventListener('click', e => {
          invoice.items.splice(+e.currentTarget.dataset.idx, 1);
          renderItemRows();
          renderPreview();
        }));
      }

      /* ---------------------------------------------------------------
         RENDER: INVOICE PREVIEW (the actual invoice sheet)
      --------------------------------------------------------------- */
      let draftSaveTimer = null;
      function renderPreview() {
        document.getElementById('companyBlock').innerHTML = settings.companyName || settings.companyAddress || settings.companyPhone || settings.companyEmail
          ? `
        <div class="company-name">${escapeHtml(settings.companyName)}</div>
        <div>${escapeHtml(settings.companyAddress).replace(/\n/g, '<br>')}</div>
        <div>${escapeHtml(settings.companyPhone)}</div>
        <div>${settings.companyEmail ? '<a href="mailto:' + escapeHtml(settings.companyEmail) + '">' + escapeHtml(settings.companyEmail) + '</a>' : ''}</div>
      `
          : '<span class="empty-hint">Add your company details in Defaults</span>';

        const logoBox = document.getElementById('logoBox');
        if (logoBox) {
          logoBox.innerHTML = settings.logoDataUrl
            ? `<img src="${settings.logoDataUrl}" alt="logo">`
            : `<img src="logo 1.0 dark.png" alt="Luminav Logo" class="brand-logo-img">`;
        }

        document.getElementById('metaDate').textContent = formatDisplayDate(invoice.date);
        document.getElementById('metaId').textContent = '#' + (invoice.id || '—');
        document.getElementById('chipId').textContent = invoice.id || '—';

        document.getElementById('billBlock').innerHTML = `
      <div class="party-label">Bill to</div>
      ${invoice.billName ? '<div class="line1">' + escapeHtml(invoice.billName) + '</div>' : '<span class="empty-hint">Add client details</span>'}
      ${invoice.billCompany ? '<div>' + escapeHtml(invoice.billCompany) + '</div>' : ''}
      ${invoice.billPhone ? '<div>' + escapeHtml(invoice.billPhone) + '</div>' : ''}
      ${invoice.billEmail ? '<div><a href="mailto:' + escapeHtml(invoice.billEmail) + '">' + escapeHtml(invoice.billEmail) + '</a></div>' : ''}
    `;

        document.getElementById('projectBlock').innerHTML = invoice.project
          ? escapeHtml(invoice.project).replace(/\n/g, '<br>')
          : '<span class="empty-hint">Add project details</span>';

        const body = document.getElementById('itemsBody');
        body.innerHTML = '';
        let subtotal = 0;
        const MIN_ROWS = 8;
        const rowsToRender = Math.max(invoice.items.length, MIN_ROWS);
        for (let i = 0; i < rowsToRender; i++) {
          const item = invoice.items[i];
          const tr = document.createElement('tr');
          if (item) {
            const amount = (Number(item.qty) || 0) * (Number(item.price) || 0);
            subtotal += amount;
            tr.innerHTML = `
          <td class="idx-col">${i + 1}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="num-col">${item.qty !== '' ? item.qty : ''}</td>
          <td class="num-col">${item.price !== '' ? formatCurrency(item.price) : ''}</td>
          <td class="num-col">${formatCurrency(amount)}</td>
        `;
          } else {
            tr.className = 'blank-row';
            tr.innerHTML = `<td class="idx-col">${i + 1}</td><td>&nbsp;</td><td class="num-col"></td><td class="num-col"></td><td class="num-col"></td>`;
          }
          body.appendChild(tr);
        }

        let discount = Number(invoice.discount) || 0;
        let advance = Number(invoice.advance) || 0;
        let total = subtotal - discount - advance;

        if (discount > 0 || advance > 0) {
          document.getElementById('subtotalsBlock').innerHTML = `
              <div class="totals-row" style="margin-top: 18px; padding-top: 10px; border-top: 2px solid #1c1c1c;">
                <span class="t-label">Subtotal</span>
                <span class="t-amount">${formatCurrency(subtotal)}</span>
              </div>
              ${discount > 0 ? `
              <div class="subtotal-row">
                <span class="t-label">Discount</span>
                <span class="t-amount">- ${formatCurrency(discount)}</span>
              </div>` : ''}
              ${advance > 0 ? `
              <div class="subtotal-row">
                <span class="t-label">Advance Paid</span>
                <span class="t-amount">- ${formatCurrency(advance)}</span>
              </div>` : ''}
              <div class="totals-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #1c1c1c;">
                <span class="t-label">Total Due</span>
                <span class="t-amount">${formatCurrency(total)}</span>
              </div>
           `;
        } else {
          document.getElementById('subtotalsBlock').innerHTML = `
              <div class="totals-row">
                <span class="t-label">Total</span>
                <span class="t-amount">${formatCurrency(subtotal)}</span>
              </div>
           `;
        }

        const lines = (settings.terms || '').split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) {
          document.getElementById('notesBlock').innerHTML = '';
        } else {
          const bodyLines = lines.slice(0, -1);
          const closing = lines[lines.length - 1];
          document.getElementById('notesBlock').innerHTML =
            bodyLines.map(l => '<div>' + escapeHtml(l) + '</div>').join('') +
            '<div class="closing-line">' + escapeHtml(closing) + '</div>';
        }

        clearTimeout(draftSaveTimer);
        draftSaveTimer = setTimeout(async () => {
          if (invoice.id) {
            await storeSet('invoice:draft', JSON.stringify(invoice));
          }
        }, 1000);
      }

      /* ---------------------------------------------------------------
         BIND: invoice form fields <-> state
      --------------------------------------------------------------- */
      function bindInvoiceFields() {
        const bindInput = (id, fn) => {
          const el = document.getElementById(id);
          if (el) el.addEventListener('input', fn);
        };
        const bindClick = (id, fn) => {
          const el = document.getElementById(id);
          if (el) el.addEventListener('click', fn);
        };

        bindInput('billName', e => { invoice.billName = e.target.value; renderPreview(); });
        bindInput('billCompany', e => { invoice.billCompany = e.target.value; renderPreview(); });
        bindInput('billPhone', e => { invoice.billPhone = e.target.value; renderPreview(); });
        bindInput('billEmail', e => { invoice.billEmail = e.target.value; renderPreview(); });
        bindInput('projectDetails', e => { invoice.project = e.target.value; renderPreview(); });
        bindInput('invoiceDate', e => { invoice.date = e.target.value; renderPreview(); });
        bindInput('invoiceIdInput', e => {
          invoice.id = e.target.value.replace(/^#/, '').toUpperCase();
          renderPreview();
        });
        bindInput('invoiceDiscount', e => { invoice.discount = e.target.value; renderPreview(); });
        bindInput('invoiceAdvance', e => { invoice.advance = e.target.value; renderPreview(); });

        bindClick('btnAddItem', () => {
          invoice.items.push(newItem());
          renderItemRows();
          renderPreview();
        });
        bindClick('btnRegenId', async () => {
          invoice.id = await generateInvoiceId(invoice.date);
          const inp = document.getElementById('invoiceIdInput');
          if (inp) inp.value = invoice.id;
          renderPreview();
        });
        bindClick('btnSaveInvoice', async () => {
          await saveCurrentInvoiceToHistory();
          flashButton('btnSaveInvoice', 'Saved ✓');
        });
        bindClick('btnResetForm', startNewInvoice);
      }

      /* ---------------------------------------------------------------
         BIND: settings form
      --------------------------------------------------------------- */
      function populateSettingsForm() {
        const setVal = (id, v) => {
          const el = document.getElementById(id);
          if (el) el.value = v;
        };
        setVal('setCurrency', settings.currency || '₹');
        setVal('setCompanyName', settings.companyName || '');
        setVal('setCompanyAddress', settings.companyAddress || '');
        setVal('setCompanyPhone', settings.companyPhone || '');
        setVal('setCompanyEmail', settings.companyEmail || '');
        setVal('setTerms', settings.terms || '');
        const preview = document.getElementById('settingsLogoPreview');
        if (preview) {
          preview.innerHTML = settings.logoDataUrl
            ? `<img src="${settings.logoDataUrl}" alt="logo">`
            : `<img src="logo 1.0 dark.png" alt="Luminav Logo" class="brand-logo-img">`;
        }
      }

      function setSettingsStatus(text) {
        const el = document.getElementById('settingsSaveStatus');
        if (el) el.textContent = text;
      }

      function readSettingsFieldsIntoState() {
        const getVal = id => {
          const el = document.getElementById(id);
          return el ? el.value : '';
        };
        settings.currency = getVal('setCurrency') || '₹';
        settings.companyName = getVal('setCompanyName');
        settings.companyAddress = getVal('setCompanyAddress');
        settings.companyPhone = getVal('setCompanyPhone');
        settings.companyEmail = getVal('setCompanyEmail');
        settings.terms = getVal('setTerms');
      }

      async function persistSettingsNow() {
        const ok = await storeSet('settings', JSON.stringify(settings));
        setSettingsStatus(ok ? 'All changes saved to this PC ✓' : 'Could not save — see the note at the bottom of the sidebar.');
        return ok;
      }

      let settingsSaveTimer = null;
      function scheduleSettingsAutosave() {
        readSettingsFieldsIntoState();
        renderPreview();
        setSettingsStatus('Saving…');
        clearTimeout(settingsSaveTimer);
        settingsSaveTimer = setTimeout(persistSettingsNow, 450);
      }

      function bindSettingsFields() {
        ['setCurrency', 'setCompanyName', 'setCompanyAddress', 'setCompanyPhone', 'setCompanyEmail', 'setTerms'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.addEventListener('input', scheduleSettingsAutosave);
        });
        const logoInput = document.getElementById('logoFileInput');
        if (logoInput) {
          logoInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
              const img = new Image();
              img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 400;
                let width = img.width;
                let height = img.height;
                if (width > height && width > MAX_SIZE) {
                  height *= MAX_SIZE / width;
                  width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                  width *= MAX_SIZE / height;
                  height = MAX_SIZE;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                settings.logoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                populateSettingsForm();
                renderPreview();
                await persistSettingsNow();
                e.target.value = '';
              };
              img.src = reader.result;
            };
            reader.readAsDataURL(file);
          });
        }
        document.getElementById('btnRemoveLogo')?.addEventListener('click', async () => {
          settings.logoDataUrl = '';
          populateSettingsForm();
          renderPreview();
          await persistSettingsNow();
        });
        document.getElementById('btnSaveSettings')?.addEventListener('click', async () => {
          clearTimeout(settingsSaveTimer);
          readSettingsFieldsIntoState();
          await persistSettingsNow();
          renderPreview();
          populateSettingsForm();
          flashButton('btnSaveSettings', 'Saved ✓');
        });
        document.getElementById('btnResetAll')?.addEventListener('click', async () => {
          if (!confirm('This clears saved defaults, invoice history and month counters on this PC. Continue?')) return;
          const keys = await listAllKeys();
          for (const k of keys) await storeDelete(k);
          location.reload();
        });
        document.getElementById('btnResetSeq')?.addEventListener('click', async () => {
          if (!confirm('This will reset the generated invoice counter for the current month back to 1. Continue?')) return;
          const d = parseISO(todayISO());
          const monKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const seqStorageKey = `seq:${monKey}`;
          await storeSet(seqStorageKey, '0');
          flashButton('btnResetSeq', 'Reset ✓');
        });
        document.getElementById('btnExportBackup')?.addEventListener('click', exportAllDataBackup);
        document.getElementById('btnExportBackup2')?.addEventListener('click', exportAllDataBackup);
        document.getElementById('backupFileInput')?.addEventListener('change', e => {
          const file = e.target.files[0];
          if (file) importAllDataBackup(file);
          e.target.value = '';
        });
      }

      function flashButton(id, text) {
        const btn = document.getElementById(id);
        const original = btn.textContent;
        btn.textContent = text;
        setTimeout(() => { btn.textContent = original; }, 1400);
      }

      /* ---------------------------------------------------------------
         BACKUP EXPORT / IMPORT (Invoices & Project Tracker Data)
      --------------------------------------------------------------- */
      async function exportAllDataBackup() {
        const keys = await listAllKeys();
        const data = {};
        for (const k of keys) {
          if (k !== 'diagnostic:write-test' && k !== 'diagnostic:last-load' && k !== 'incoming_project') {
            data[k] = await storeGet(k);
          }
        }

        // Also fetch project data from localStorage if available
        let projectsList = [];
        try {
          if (hasLocalStorage) {
            const raw = localStorage.getItem('projects-data') || localStorage.getItem('shoots-data');
            if (raw) projectsList = JSON.parse(raw) || [];
          }
        } catch (e) {}

        const payload = {
          app: 'luminosity-studio-suite',
          version: 6,
          exportedAt: new Date().toISOString(),
          projects: projectsList,
          shoots: projectsList,
          invoicesData: data,
          data: data
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studio-backup-${todayISO()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      async function importAllDataBackup(file) {
        let parsed;
        try {
          const text = await file.text();
          parsed = JSON.parse(text);
        } catch (e) {
          alert("That file doesn't look like a valid backup.");
          return;
        }

        const data = parsed && (parsed.invoicesData || parsed.data) ? (parsed.invoicesData || parsed.data) : (parsed && typeof parsed === 'object' && !parsed.projects && !parsed.shoots ? parsed : null);
        const projectsList = parsed && (parsed.projects || parsed.shoots);

        if (!data && !projectsList) {
          alert("That file doesn't look like a valid backup.");
          return;
        }
        if (!confirm('Import this backup? This will restore your saved invoices and project records on this PC.')) return;

        if (data && typeof data === 'object') {
          const existingKeys = await listAllKeys();
          for (const k of existingKeys) {
            await storeDelete(k);
          }
          for (const k of Object.keys(data)) {
            await storeSet(k, data[k]);
          }
        }

        if (Array.isArray(projectsList) && projectsList.length > 0 && hasLocalStorage) {
          try {
            const projectsJson = JSON.stringify(projectsList);
            localStorage.setItem('projects-data', projectsJson);
            localStorage.setItem('shoots-data', projectsJson);
          } catch(e) {}
        }

        location.reload();
      }

      /* ---------------------------------------------------------------
         DATABASE INDEX (history of saved invoices)
      --------------------------------------------------------------- */
      async function getHistoryIndex() {
        const raw = await storeGet('invoice-history');
        if (!raw) return [];
        try { return JSON.parse(raw); } catch (e) { return []; }
      }

      async function saveCurrentInvoiceToHistory() {
        if (!invoice.id) return;
        let subtotal = invoice.items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
        let discount = Number(invoice.discount) || 0;
        let advance = Number(invoice.advance) || 0;
        const total = subtotal - discount - advance;
        const summary = {
          id: invoice.id,
          dateIso: invoice.date,
          dateDisplay: formatDisplayDate(invoice.date),
          billName: invoice.billName || '(no client name)',
          project: invoice.project || '',
          total: total,
          savedAt: Date.now()
        };
        let index = await getHistoryIndex();
        index = index.filter(x => x.id !== invoice.id);
        index.unshift(summary);
        const MAX_HISTORY = 500;
        if (index.length > MAX_HISTORY) {
          const removed = index.slice(MAX_HISTORY);
          index = index.slice(0, MAX_HISTORY);
          for (const item of removed) {
            await storeDelete('invoice:' + item.id);
          }
        }
        await storeSet('invoice-history', JSON.stringify(index));
        await storeSet('invoice:' + invoice.id, JSON.stringify(invoice));
        await updateSidebarSummary();
      }

      async function updateSidebarSummary() {
        const index = await getHistoryIndex();
        const total = index.reduce((s, it) => s + (Number(it.total) || 0), 0);
        const countEl = document.getElementById('sidebarDbCount');
        if (countEl) countEl.textContent = `${index.length} invoice${index.length === 1 ? '' : 's'}`;
        const totalEl = document.getElementById('sidebarDbTotal');
        if (totalEl) totalEl.textContent = `${formatCurrency(total)} total billed`;
      }

      function filterAndSortIndex(index) {
        let filtered = index;
        if (dbSearch.trim()) {
          const q = dbSearch.trim().toLowerCase();
          filtered = filtered.filter(it =>
            (it.id || '').toLowerCase().includes(q) ||
            (it.billName || '').toLowerCase().includes(q) ||
            (it.project || '').toLowerCase().includes(q)
          );
        }
        const dir = dbSort.dir === 'asc' ? 1 : -1;
        filtered = filtered.slice().sort((a, b) => {
          let av = a[dbSort.key], bv = b[dbSort.key];
          if (dbSort.key === 'total') { av = Number(av) || 0; bv = Number(bv) || 0; }
          else { av = (av || '').toString().toLowerCase(); bv = (bv || '').toString().toLowerCase(); }
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
          return 0;
        });
        return filtered;
      }

      async function renderDatabaseView() {
        const index = await getHistoryIndex();
        const filtered = filterAndSortIndex(index);
        const tbody = document.getElementById('dbTableBody');

        if (!filtered.length) {
          tbody.innerHTML = `<tr><td colspan="6" class="db-empty">${index.length ? 'No invoices match your search.' : 'No invoices saved yet. Print or export an invoice to add it here.'}</td></tr>`;
        } else {
          tbody.innerHTML = filtered.map(item => `
        <tr>
          <td class="db-id">#${escapeHtml(item.id)}</td>
          <td>${escapeHtml(item.dateDisplay)}</td>
          <td>${escapeHtml(item.billName)}</td>
          <td class="db-project">${escapeHtml(item.project)}</td>
          <td class="num-col">${formatCurrency(item.total)}</td>
          <td class="db-actions">
            <button class="db-link" data-load="${escapeHtml(item.id)}">Load</button>
            <button class="db-link" data-dup="${escapeHtml(item.id)}">Duplicate</button>
            <button class="db-link" data-export="${escapeHtml(item.id)}">Export PDF</button>
            <button class="db-link db-link-danger" data-del="${escapeHtml(item.id)}">Delete</button>
          </td>
        </tr>
      `).join('');
        }

        const total = index.reduce((s, it) => s + (Number(it.total) || 0), 0);
        document.getElementById('dbSummary').textContent = `${index.length} invoice${index.length === 1 ? '' : 's'} · ${formatCurrency(total)} total`;

        document.querySelectorAll('#dbTable th[data-sort]').forEach(th => {
          th.classList.toggle('sort-active-asc', th.dataset.sort === dbSort.key && dbSort.dir === 'asc');
          th.classList.toggle('sort-active-desc', th.dataset.sort === dbSort.key && dbSort.dir === 'desc');
        });

        tbody.querySelectorAll('[data-load]').forEach(btn => btn.addEventListener('click', () => loadInvoiceById(btn.dataset.load)));
        tbody.querySelectorAll('[data-dup]').forEach(btn => btn.addEventListener('click', () => duplicateInvoiceById(btn.dataset.dup)));
        tbody.querySelectorAll('[data-export]').forEach(btn => btn.addEventListener('click', (e) => exportInvoiceByIdAsPDF(btn.dataset.export, e.target)));
        tbody.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => deleteInvoiceById(btn.dataset.del)));
      }

      async function duplicateInvoiceById(id) {
        const raw = await storeGet('invoice:' + id);
        if (!raw) return;
        try {
          const dup = JSON.parse(raw);
          dup.date = todayISO();
          dup.id = await generateInvoiceId(dup.date);
          invoice = dup;
          applyInvoiceToForm();
          renderItemRows();
          renderPreview();
          switchTab('invoice');
        } catch (e) { }
      }

      async function loadInvoiceById(id) {
        const raw = await storeGet('invoice:' + id);
        if (!raw) return;
        try {
          invoice = JSON.parse(raw);
          if (!invoice.items || !invoice.items.length) invoice.items = [newItem()];
          applyInvoiceToForm();
          renderItemRows();
          renderPreview();
          switchTab('invoice');
        } catch (e) { }
      }

      async function deleteInvoiceById(id) {
        if (!confirm(`Delete invoice #${id}? This can't be undone.`)) return;
        let index = await getHistoryIndex();
        index = index.filter(x => x.id !== id);
        await storeSet('invoice-history', JSON.stringify(index));
        await storeDelete('invoice:' + id);
        renderDatabaseView();
        updateSidebarSummary();
      }

      function applyInvoiceToForm() {
        document.getElementById('billName').value = invoice.billName || '';
        document.getElementById('billCompany').value = invoice.billCompany || '';
        document.getElementById('billPhone').value = invoice.billPhone || '';
        document.getElementById('billEmail').value = invoice.billEmail || '';
        document.getElementById('projectDetails').value = invoice.project || '';
        document.getElementById('invoiceDate').value = invoice.date;
        document.getElementById('invoiceIdInput').value = invoice.id;
        document.getElementById('invoiceDiscount').value = invoice.discount || '';
        document.getElementById('invoiceAdvance').value = invoice.advance || '';
      }

      function bindDatabaseControls() {
        document.getElementById('dbSearch').addEventListener('input', e => {
          dbSearch = e.target.value;
          renderDatabaseView();
        });
        document.querySelectorAll('#dbTable th[data-sort]').forEach(th => {
          th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (dbSort.key === key) dbSort.dir = dbSort.dir === 'asc' ? 'desc' : 'asc';
            else { dbSort.key = key; dbSort.dir = 'asc'; }
            renderDatabaseView();
          });
        });
      }

      function printInvoiceCleanly() {
        const origTitle = document.title;
        const safeName = (invoice.billName || 'Invoice').replace(/[^\w\- ]+/g, '').trim() || 'Invoice';
        document.title = `${invoice.id || 'INVOICE'} - ${safeName}`;
        window.print();
        setTimeout(() => {
          document.title = origTitle;
        }, 1500);
      }

      /* ---------------------------------------------------------------
         PDF EXPORT (auto-downloads, no print dialog)
      --------------------------------------------------------------- */
      async function exportInvoiceAsPDF(targetInvoice, btnEl) {
        const previousText = btnEl ? btnEl.textContent : '';
        if (btnEl) {
          btnEl.textContent = 'Generating...';
          btnEl.style.pointerEvents = 'none';
        }
        const previous = invoice;
        const isSame = targetInvoice.id === invoice.id;
        if (!isSame) {
          invoice = targetInvoice;
          renderPreview();
        }
        await new Promise(r => setTimeout(r, 80));

        const el = document.getElementById('sheet');
        const trackerStrip = document.getElementById('leftTrackerStrip');
        const slideCurtain = document.getElementById('slideCurtainLeft');
        const prevTrackerDisplay = trackerStrip ? trackerStrip.style.display : '';
        const prevCurtainDisplay = slideCurtain ? slideCurtain.style.display : '';

        // Temporarily hide tracker strip & curtain during PDF export to ensure 100% clean PDF
        if (trackerStrip) trackerStrip.style.display = 'none';
        if (slideCurtain) slideCurtain.style.display = 'none';

        const safeName = (invoice.billName || 'invoice').replace(/[^\w\- ]+/g, '').trim() || 'invoice';
        const filename = `${invoice.id || 'INVOICE'} - ${safeName}.pdf`;

        try {
          if (typeof html2pdf !== 'undefined') {
            await html2pdf().set({
              margin: [0, 0, 0, 0],
              filename: filename,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                ignoreElements: (element) => {
                  return element.id === 'leftTrackerStrip' ||
                         element.id === 'slideCurtainLeft' ||
                         element.classList?.contains('left-edge-strip') ||
                         element.classList?.contains('stage-toolbar') ||
                         element.classList?.contains('sidebar');
                }
              },
              jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
            }).from(el).save();
          } else {
            printInvoiceCleanly();
          }
        } catch (err) {
          console.warn('html2pdf generation error, falling back to clean print:', err);
          printInvoiceCleanly();
        } finally {
          if (trackerStrip) trackerStrip.style.display = prevTrackerDisplay;
          if (slideCurtain) slideCurtain.style.display = prevCurtainDisplay;

          if (!isSame) {
            invoice = previous;
            renderPreview();
          }
          if (btnEl) {
            btnEl.textContent = previousText;
            btnEl.style.pointerEvents = '';
          }
        }
      }

      async function exportInvoiceByIdAsPDF(id, btnEl) {
        const raw = await storeGet('invoice:' + id);
        if (!raw) return;
        let target;
        try { target = JSON.parse(raw); } catch (e) { return; }
        await exportInvoiceAsPDF(target, btnEl);
      }

      /* ---------------------------------------------------------------
         NEW INVOICE / EXPORT / PRINT
      --------------------------------------------------------------- */
      async function startNewInvoice() {
        invoice = {
          id: '',
          date: todayISO(),
          billName: '',
          billCompany: '',
          billPhone: '',
          billEmail: '',
          project: '',
          items: [newItem()],
          discount: 0,
          advance: 0
        };
        invoice.id = await generateInvoiceId(invoice.date);
        await storeDelete('invoice:draft');
        applyInvoiceToForm();
        renderItemRows();
        renderPreview();
      }

      function bindToolbar() {
        document.getElementById('btnNewInvoiceTop')?.addEventListener('click', startNewInvoice);
        document.getElementById('btnNewInvoiceMain')?.addEventListener('click', startNewInvoice);
        document.getElementById('btnPrint')?.addEventListener('click', async () => {
          await saveCurrentInvoiceToHistory();
          printInvoiceCleanly();
        });
        document.getElementById('btnExportPdf')?.addEventListener('click', async (e) => {
          await saveCurrentInvoiceToHistory();
          await exportInvoiceAsPDF(invoice, e.target);
        });
      }

      /* ---------------------------------------------------------------
         TABS
      --------------------------------------------------------------- */
      function switchTab(name) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
        document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
        const showDb = name === 'database';
        const invView = document.getElementById('stageInvoiceView');
        if (invView) invView.style.display = showDb ? 'none' : '';
        const dbView = document.getElementById('stageDatabaseView');
        if (dbView) dbView.style.display = showDb ? 'block' : 'none';
        if (showDb) renderDatabaseView();
      }
      function bindTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
      }

      /* ---------------------------------------------------------------
         INIT
      --------------------------------------------------------------- */
      async function runPersistenceDiagnostic() {
        let workingNow = false;
        try {
          const marker = 'ok-' + Date.now();
          localStorage.setItem(STORAGE_PREFIX + 'diagnostic:write-test', marker);
          workingNow = localStorage.getItem(STORAGE_PREFIX + 'diagnostic:write-test') === marker;
        } catch (e) { workingNow = false; }

        const previousLoadMarker = workingNow ? localStorage.getItem(STORAGE_PREFIX + 'diagnostic:last-load') : null;
        if (workingNow) {
          try { localStorage.setItem(STORAGE_PREFIX + 'diagnostic:last-load', String(Date.now())); } catch (e) { }
        }
        return { workingNow, survivedRefresh: !!previousLoadMarker };
      }

      async function init() {
        const persistNote = document.getElementById('persistNote');
        const diag = await runPersistenceDiagnostic();
        if (persistNote) {
          if (!diag.workingNow) {
            persistNote.innerHTML = '<span class="persist-dot" style="background:#c0554a;"></span>This browser is blocking local storage on this page right now — nothing will be saved between visits.';
          } else if (!diag.survivedRefresh) {
            persistNote.innerHTML = '<span class="persist-dot" style="background:#d9a463;"></span>Saving is working. Refresh the page once — this should switch to "confirmed" below.';
          } else {
            persistNote.innerHTML = '<span class="persist-dot" style="background:#7fbf7f;"></span>Confirmed — saved data is surviving refreshes on this PC.';
          }
        }

        const savedSettings = await storeGet('settings');
        if (savedSettings) {
          try { settings = Object.assign(settings, JSON.parse(savedSettings)); } catch (e) { }
        }
        populateSettingsForm();

        // Check for incoming project from Project Tracker
        let incomingProject = null;
        try {
          const incomingRaw = localStorage.getItem('invoiceApp:incoming_project') || sessionStorage.getItem('invoiceApp:incoming_project');
          if (incomingRaw) {
            incomingProject = JSON.parse(incomingRaw);
            localStorage.removeItem('invoiceApp:incoming_project');
            sessionStorage.removeItem('invoiceApp:incoming_project');
          }
        } catch(e) {}

        if (incomingProject) {
          invoice.date = incomingProject.date || todayISO();
          invoice.id = await generateInvoiceId(invoice.date);
          invoice.billName = incomingProject.clientName || incomingProject.title || '';
          invoice.billCompany = incomingProject.company || '';
          invoice.project = incomingProject.projectScope || incomingProject.deliverables || incomingProject.title || '';
          const fee = Number(incomingProject.payment) || 0;
          invoice.items = [{
            key: Math.random().toString(36).slice(2, 9),
            description: incomingProject.deliverables ? `${incomingProject.title} — ${incomingProject.deliverables}` : (incomingProject.title || 'Studio & Production Services'),
            qty: 1,
            price: fee
          }];
          invoice.advance = Number(incomingProject.paid) || 0;
          invoice.discount = 0;
        } else {
          const draft = await storeGet('invoice:draft');
          if (draft) {
            try { invoice = JSON.parse(draft); } catch (e) { }
          } else {
            invoice.items = [newItem()];
            invoice.date = todayISO();
            invoice.id = await generateInvoiceId(invoice.date);
          }
        }

        applyInvoiceToForm();
        document.getElementById('invoiceDate').value = invoice.date;
        document.getElementById('invoiceIdInput').value = invoice.id;

        bindInvoiceFields();
        bindSettingsFields();
        bindToolbar();
        bindTabs();
        bindDatabaseControls();

        renderItemRows();
        renderPreview();
        updateSidebarSummary();
      }

      window.slideTransitionToTracker = function(e) {
        if (e) e.preventDefault();
        document.body.style.transform = 'translateX(100vw)';
        document.body.style.opacity = '0.1';
        document.body.style.filter = 'blur(6px)';
        document.body.style.transition = 'transform 0.42s cubic-bezier(0.76, 0, 0.24, 1), opacity 0.42s';
        setTimeout(() => {
          window.location.href = 'shoot_tracker.html';
        }, 380);
      };

      init();

    })();