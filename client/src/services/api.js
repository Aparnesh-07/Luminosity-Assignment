const API_BASE = '/api';

/**
 * Core HTTP Request Handler
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  // If body is FormData (e.g. logo upload), don't set Content-Type header
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const resData = await response.json().catch(() => ({}));

  if (!response.ok || resData.success === false) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const errorMsg = resData.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return resData.data !== undefined ? resData.data : resData;
}

// ---------------------------------------------------------------------------
// AUTHENTICATION
// ---------------------------------------------------------------------------
export const login = (email, password) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

export const register = (data) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const getMe = () => request('/auth/me');

// ---------------------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------------------
export const getProjects = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  return request(`/projects${qs ? `?${qs}` : ''}`);
};

export const getProject = (id) => request(`/projects/${id}`);

export const createProject = (data) =>
  request('/projects', {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const updateProject = (id, data) =>
  request(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

export const deleteProject = (id) =>
  request(`/projects/${id}`, {
    method: 'DELETE'
  });

export const getProjectFinancials = (id) => request(`/projects/${id}/financials`);

// ---------------------------------------------------------------------------
// PAYMENTS
// ---------------------------------------------------------------------------
export const getPayments = (projectId) => request(`/projects/${projectId}/payments`);

export const recordPayment = (projectId, data) =>
  request(`/projects/${projectId}/payments`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const quickSettleProject = (projectId) =>
  request(`/projects/${projectId}/settle`, {
    method: 'POST'
  });

export const updatePayment = (id, data) =>
  request(`/payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

export const deletePayment = (id) =>
  request(`/payments/${id}`, {
    method: 'DELETE'
  });

// ---------------------------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------------------------
export const getExpenses = (projectId) => request(`/projects/${projectId}/expenses`);

export const recordExpense = (projectId, data) =>
  request(`/projects/${projectId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const updateExpense = (id, data) =>
  request(`/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

export const deleteExpense = (id) =>
  request(`/expenses/${id}`, {
    method: 'DELETE'
  });

// ---------------------------------------------------------------------------
// INVOICES
// ---------------------------------------------------------------------------
export const getInvoices = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  return request(`/invoices${qs ? `?${qs}` : ''}`);
};

export const getInvoice = (id) => request(`/invoices/${id}`);

export const createInvoice = (data) =>
  request('/invoices', {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const updateInvoice = (id, data) =>
  request(`/invoices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

export const deleteInvoice = (id) =>
  request(`/invoices/${id}`, {
    method: 'DELETE'
  });

export const getNextInvoiceNumber = (date) =>
  request(`/invoices/next-number${date ? `?date=${date}` : ''}`);

// ---------------------------------------------------------------------------
// CLIENTS
// ---------------------------------------------------------------------------
export const getClients = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  return request(`/clients${qs ? `?${qs}` : ''}`);
};

export const getClient = (id) => request(`/clients/${id}`);

export const createClient = (data) =>
  request('/clients', {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const updateClient = (id, data) =>
  request(`/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

export const deleteClient = (id) =>
  request(`/clients/${id}`, {
    method: 'DELETE'
  });

// ---------------------------------------------------------------------------
// ANALYTICS
// ---------------------------------------------------------------------------
export const getOverviewAnalytics = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  return request(`/analytics/overview${qs ? `?${qs}` : ''}`);
};

export const getPaymentsAnalytics = () => request('/analytics/payments');

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------
export const getSettings = () => request('/settings');

export const updateSettings = (data) =>
  request('/settings', {
    method: 'PUT',
    body: JSON.stringify(data)
  });

export const uploadLogo = (formData) =>
  request('/settings/logo', {
    method: 'POST',
    body: formData
  });

export const deleteLogo = () =>
  request('/settings/logo', {
    method: 'DELETE'
  });

export const resetSequenceCounter = (yearMonth) =>
  request('/settings/reset-sequence', {
    method: 'POST',
    body: JSON.stringify({ yearMonth })
  });

// ---------------------------------------------------------------------------
// BACKUPS
// ---------------------------------------------------------------------------
export const exportBackup = () => request('/backups/export');

export const importBackup = (data, mode = 'merge') =>
  request('/backups/import', {
    method: 'POST',
    body: JSON.stringify({ data, mode })
  });
