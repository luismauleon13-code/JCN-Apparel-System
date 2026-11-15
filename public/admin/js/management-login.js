// JCN Management Login: ADMIN works with existing backend.
// STAFF requires POST /api/auth/management-login (not yet implemented).
// The server must determine each role; never trust a role selected by the browser.
(() => {
  const form = document.getElementById('adminLoginForm');
  if (!form || form.dataset.managementAuthReady === '1') return;
  form.dataset.managementAuthReady = '1';

  const usernameField = document.getElementById('adminUsername');
  const passwordField = document.getElementById('adminPassword');
  const message = document.getElementById('adminLoginMessage');
  const button = form.querySelector('[type="submit"]');
  const destinations = {
    admin: '/admin/html/admin-dashboard.html',
    // VERIFY these paths against your actual folder structure before enabling staff login.
    inventory_staff: '/Inventory/html/inventory-product.html',
    cashier: '/Cashier/html/cashier-dashboard.html',
    graphic_designer: '/graphic-designer/html/designer-dashboard.html'
  };
  const staffRoles = new Set(['inventory_staff', 'cashier', 'graphic_designer']);
  let busy = false;

  async function requestLogin(url, credentials) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const username = usernameField?.value.trim();
    const password = passwordField?.value;
    if (!username || !password) return;

    busy = true;
    if (button) button.disabled = true;
    if (message) message.textContent = 'Signing in...';

    try {
      // Once the unified backend exists, it handles both Admin and Staff.
      let result = await requestLogin('/api/auth/management-login', { username, password });
      if (result.response.status === 404 || result.response.status === 405) {
        // Backward compatibility ONLY while management-login endpoint is absent.
        // Existing admin authentication continues working. Staff login does not.
        result = await requestLogin('/api/auth/admin-login', { username, password });
      }
      const { response, data } = result;
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Invalid username or password.');
      }
      const role = data.user?.role;
      if (!data.token || !role || !destinations[role]) {
        throw new Error('Invalid account role or login response.');
      }

      if (role === 'admin') {
        // Existing Admin dashboard requests rely on these exact keys.
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
      } else if (staffRoles.has(role)) {
        // Existing Staff dashboards rely on these keys.
        localStorage.setItem('staffToken', data.token);
        localStorage.setItem('staffUser', JSON.stringify(data.user));
      }
      if (message) message.textContent = 'Login successful.';
      window.location.assign(destinations[role]);
    } catch (error) {
      if (message) message.textContent = error.message || 'Login failed.';
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  });
})();
