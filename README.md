# LUMINOSITY — Studio Project Log & Financial Suite

An all-in-one, dark-aesthetic studio operations and financial management suite built for film production companies, cinematographers, photographers, and creative agencies. Designed for **Luminav Films**, Luminosity delivers client shoot tracking, multi-installment payment management, itemized expense ledgers, real-time analytics, and client-ready PDF invoice generation.

Luminosity runs entirely in the browser with **zero backend dependencies**, **zero build steps**, and **100% private local storage**.

---

## Table of Contents

- [Quick Start: How to Run](#quick-start-how-to-run)
  - [Option 1: Local HTTP Server (Recommended)](#option-1-local-http-server-recommended)
  - [Option 2: Direct File Launch](#option-2-direct-file-launch)
  - [Option 3: VS Code Live Server](#option-3-vs-code-live-server)
- [Access & Credentials](#access--credentials)
- [Core Architecture & Modules](#core-architecture--modules)
  - [1. Executive Studio Portal (`index.html`)](#1-executive-studio-portal-indexhtml)
  - [2. Project Tracker & Financial Ledger (`tracker.html`)](#2-project-tracker--financial-ledger-trackerhtml)
  - [3. Invoice Generator Studio (`invoices.html`)](#3-invoice-generator-studio-invoiceshtml)
  - [4. Inter-Module Workflow & Slide Transition](#4-inter-module-workflow--slide-transition)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Data Storage & Backup Management](#data-storage--backup-management)
  - [Exporting Backups](#exporting-backups)
  - [Restoring from Backup](#restoring-from-backup)
- [Project Structure](#project-structure)
- [Troubleshooting & Browser Notes](#troubleshooting--browser-notes)
- [License](#license)

---

## Quick Start: How to Run

Luminosity is a pure client-side application (HTML5, CSS3, ES6 JavaScript). You can run it immediately without running `npm install` or configuring databases.

### Option 1: Local HTTP Server (Recommended)

Running over a lightweight local web server is recommended because some modern web browsers restrict `localStorage` or web font loading when accessing files through the `file://` protocol.

#### Using Python (Pre-installed on macOS / Linux / most developer machines):

```bash
# Navigate to the project root
cd /path/to/Luminosity

# Python 3
python3 -m http.server 8000
```

Then open your browser and go to:
**[http://localhost:8000](http://localhost:8000)**

*(If using Python 2: `python -m SimpleHTTPServer 8000`)*

---

#### Using Node.js / `npx`:

```bash
# Using 'serve'
npx serve .

# OR using 'http-server'
npx http-server -p 8000
```

Then navigate to the URL printed in the terminal (typically `http://localhost:3000` or `http://localhost:8000`).

---

#### Using PHP:

```bash
php -S localhost:8000
```

Open `http://localhost:8000` in your browser.

---

### Option 2: Direct File Launch

If you do not have Python or Node installed, you can run Luminosity directly:

1. Locate `index.html` in your file manager (Finder / Windows Explorer).
2. Double-click **`index.html`** or right-click and choose **Open With → Google Chrome** (or Edge / Firefox / Brave / Safari).
3. The application will launch instantly.

> **Note on Browser Restrictions**: While direct opening works in most browsers, Chrome and Safari may run `file://` files in a strict sandboxed mode that could limit persistent `localStorage` between browser sessions. If you see a red diagnostic indicator in the Invoice Studio, use Option 1 or Option 3.

---

### Option 3: VS Code Live Server

If using Visual Studio Code or GitHub Codespaces:

1. Install the **Live Server** extension (`ritwickdey.LiveServer`).
2. Right-click [`index.html`](file:///workspaces/Luminosity/index.html) in the file explorer.
3. Click **"Open with Live Server"**.
4. The studio portal will open automatically on port `5500`.

---

## Access & Credentials

The main entry point (`index.html`) features a luxury cinematic shutter security screen.

- **Studio Passcode**: `luminav2026`
- **Behavior**: The passcode field is pre-filled for convenience. Click **ENTER STUDIO PORTAL** (or press Enter) to trigger the anamorphic horizon beam and film shutter opening into the Project Tracker.

### Direct Module Links (Bypassing Portal):

| Module | Direct File / URL | Description |
|---|---|---|
| **Studio Portal** | [`index.html`](file:///workspaces/Luminosity/index.html) | Main gateway & authentication |
| **Project Tracker** | [`tracker.html`](file:///workspaces/Luminosity/tracker.html) | Production tracking, expenses, profits & KPIs |
| **Invoice Studio** | [`invoices.html`](file:///workspaces/Luminosity/invoices.html) | Client invoicing, quotations & PDF exports |

---

## Core Architecture & Modules

```
┌─────────────────────────────────────────────────────────────┐
│                 LUMINOSITY STUDIO PORTAL                     │
│                       (index.html)                          │
└──────────────────────────────┬──────────────────────────────┘
                               │ Enter Portal
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 PROJECT TRACKER & LEDGER                    │
│                       (tracker.html)                        │
│  - Table / Grid / Analytics Views                           │
│  - Multi-Installment Payment Records (UPI, Cash, etc.)      │
│  - Itemized Production Expenses                             │
│  - Automated Net Profit & Margin Calculations               │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
     "Slide to Invoices"            "Slide to Tracker"
   or "Create Invoice" Action     or Back Button
               │                              │
               ▼                              │
┌─────────────────────────────────────────────────────────────┐
│                  INVOICE GENERATOR STUDIO                   │
│                       (invoices.html)                       │
│  - Live A4 Document Sheet Preview                           │
│  - Auto Invoice ID (#MON + SEQ + RAND)                      │
│  - Company Profile, Terms & Logo Customization              │
│  - PDF Export (html2pdf.js) & Clean Print Engine            │
│  - Invoices Database & Historical Archives                  │
└─────────────────────────────────────────────────────────────┘
```

### 1. Executive Studio Portal (`index.html`)
- Interactive canvas dust particle background with ambient gold radial glow.
- Viewfinder HUD overlays and anamorphic laser beam transition.
- Secure client entry point into the workspace.

### 2. Project Tracker & Financial Ledger (`tracker.html`)
- **Multi-View Interface**:
  - **Table View (`1`)**: Compact tabular view with sortable columns (Status, ID, Client/Project, Dates, Quotation, Payment Progress, Expenses, Net Profit).
  - **Grid View (`2`)**: Visual cards showing shoot timeline, deliverable chips, and progress bars.
  - **Analytics View (`3`)**: Executive KPI dashboard tracking Gross Revenue, Total Expenses, Net Profit (Quoted), Profit Margin %, and project status distribution (All-Time, This Month, This Year).
- **Financial Controls**:
  - Log agreed quotation amounts.
  - Record progressive payments (UPI, Cash, Bank Transfer, Cheque) with timestamps and custom notes.
  - Auto-completion status when 100% payment balance is received.
  - Add itemized expense breakdowns (e.g., Gear Rental, Crew Fees, Locations, Travel).
  - Live net profit and margin calculation.
- **Search & Filtering**:
  - Instant search across clients, project scopes, deliverables, and notes.
  - Status filters (`All`, `Upcoming`, `Ongoing`, `Pending`, `Completed`).
  - Date range filtering (`From Date` → `To Date`).

### 3. Invoice Generator Studio (`invoices.html`)
- **Interactive Sheet Preview**: Live rendering of an A4 invoice sheet styled with clean modern typography.
- **Invoice Number Generation**: Automatically formats IDs based on month and sequence (e.g., `#AUG0113`).
- **Itemized Billing**: Dynamic row management with quantity, unit rates, discounts, and advance deductions.
- **Export Capabilities**:
  - **Export PDF**: Generates downloadable vector PDF documents using the bundled [`assets/js/vendor/html2pdf.bundle.min.js`](file:///workspaces/Luminosity/assets/js/vendor/html2pdf.bundle.min.js) library (with auto-fallback to CDN).
  - **Clean Print**: Triggers a clean print stylesheet stripping UI chrome, sidebars, and background elements.
- **Settings & Branding**:
  - Configurable studio name, address, phone, email, custom logo, and default invoice terms & conditions.
- **Database & History**:
  - Searchable and sortable archive of all issued invoices stored in browser storage.
  - Instant PDF generation directly from past invoice records.

### 4. Inter-Module Workflow & Slide Transition
- **Slide Right**: In the Project Tracker, hover the right edge strip or click **"INVOICE STUDIO"** to trigger a smooth cinematic slide transition into the Invoice Generator.
- **Slide Left**: In the Invoice Studio, hover the left edge strip or click **"PROJECT TRACKER"** to slide back.
- **One-Click Invoice Conversion**: In the Project Tracker, click **"Invoice"** on any project row or card. The project title, client details, scope of deliverables, quotation amount, and already-paid advances are automatically staged into the Invoice Studio.

---

## Keyboard Shortcuts

Press **`?`** in the Project Tracker at any time to open the built-in shortcuts modal:

| Shortcut | Action |
|---|---|
| **`N`** | Open "New Project" modal (Water droplet morph animation) |
| **`1`** | Switch to **Table View** |
| **`2`** | Switch to **Grid View** |
| **`3`** | Switch to **Analytics / KPIs Dashboard** |
| **`/`** | Focus search input bar |
| **`?`** | Open Keyboard Shortcuts help |
| **`Esc`** | Close open modals, dropdown menus, and popups |

---

## Data Storage & Backup Management

Luminosity does not send client financial data to any external server. All state is stored in your browser's **`localStorage`**:
- `projects-data`: Project registry, shoot dates, milestones, payment records, and expenses.
- `invoiceApp:*`: Invoice history, sequence counters, drafts, and company branding settings.

### Exporting Backups
To protect against browser cache clearing or to move data between computers:
1. Click the **Data & CSV** icon in the top navigation bar of `tracker.html`.
2. Choose:
   - **Export Projects Backup**: Exports projects, milestones, payments, and expenses as a `.json` file.
   - **Export Full Studio Backup**: Exports all projects plus all invoices, drafts, and studio settings.

### Restoring from Backup
1. Click the **Upload icon** in the top navigation bar.
2. Select your exported `.json` file.
3. The entire studio database will restore immediately without requiring a manual page refresh.

> **Sample Backups**: Reference backup files are included in the [`backups/`](file:///workspaces/Luminosity/backups/) folder (`projects-backup-2026-08-29.json` and `studio-backup-2026-08-29.json`) for testing and demonstrations.

---

## Project Structure

```
Luminosity/
├── assets/
│   ├── css/
│   │   └── invoices.css                 # Styling for invoice sheet preview & controls
│   ├── js/
│   │   ├── invoices.js                  # Invoicing engine, PDF exporter & database
│   │   └── vendor/
│   │       └── html2pdf.bundle.min.js   # Client-side PDF generation library
│   └── images/
│       └── logo-dark.png                # Studio brand logo
├── backups/                             # JSON backup files for data migration & restore
│   ├── projects-backup-2026-08-29.json
│   └── studio-backup-2026-08-29.json
├── builds/                              # Historical release archive
│   ├── v1.0/
│   └── v1.1/
├── index.html                           # Studio entry portal & cinematic shutter login
├── tracker.html                         # Project tracker, financial ledger & analytics
├── invoices.html                        # Client billing, invoice generator & PDF studio
├── .gitignore                           # OS metadata and editor ignores
├── LICENSE                              # MIT License
└── README.md                            # Documentation & setup guide
```

---

## Troubleshooting & Browser Notes

### Browser shows "This browser is blocking local storage on this page right now"
- This occurs if opening the file via `file:///` in a browser configured with strict tracking prevention or in an Incognito / Private window with third-party storage blocked.
- **Solution**: Run a local HTTP server using `python3 -m http.server 8000` as described in [Option 1](#option-1-local-http-server-recommended).

### PDF Export text or borders look slightly offset
- Ensure your browser zoom level is set to `100%` (`Cmd + 0` on Mac, `Ctrl + 0` on Windows/Linux) before clicking **Export PDF**.
- Alternatively, click **Print instead** to open the browser's native print dialog and choose **Save as PDF** for 100% vector printing.

### Resetting Studio Data
- If you wish to wipe the local ledger and start fresh, click the **Skull icon (💀)** in the Project Tracker header and confirm the prompt. Remember to export a backup first!

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](file:///workspaces/Luminosity/LICENSE) file for details.

Developed for **Luminav Films** &copy; 2026. All rights reserved.
