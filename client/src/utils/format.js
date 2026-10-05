/**
 * Currency and date formatting utilities
 */

export function fmtMoney(num) {
  const n = parseFloat(num);
  if (isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function fmtDateSingle(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch (e) {
    return String(dateStr);
  }
}

export function fmtDateRange(start, end) {
  if (!start && !end) return 'Dates Unspecified';
  if (start && (!end || start === end)) return fmtDateSingle(start);
  if (!start && end) return 'Due ' + fmtDateSingle(end);
  return `${fmtDateSingle(start)} — ${fmtDateSingle(end)}`;
}

export function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
