// JCN Customer Authentication - independent from Management Login.
(() => {
  const form = document.getElementById('userLoginForm');
  if (!form || form.dataset.customerAuthReady === '1') return;
  form.dataset.customerAuthReady = '1';

  const usernameField = document.getElementById('loginUsername');
  const passwordField = document.getElementById('loginPassword');
  const message = document.getElementById('userLoginMessage');
  const button = form.querySelector('[type="submit"]');
  let busy = false;

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
      const response = await fetch('/api/auth/customer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Unable to sign in.');
      }
      if (!data.token || !data.user || data.user.role !== 'customer') {
        throw new Error('Unexpected customer login response.');
      }
      localStorage.setItem('customerToken', data.token);
      localStorage.setItem('customerUser', JSON.stringify(data.user));
      if (message) message.textContent = 'Login successful.';
      window.location.assign('/customer/html/dashboard.html');
    } catch (error) {
      if (message) message.textContent = error.message || 'Login failed.';
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  });
})();
