
(() => {
  const API_BASE_URL = 'http://localhost:5000';

  // Paths are resolved relative to staff/html/staff-login.html.
  const STAFF_PAGES = Object.freeze({
    inventory_staff: '../../Inventory/html/inventory-product.html',
    cashier: '../../Cashier/html/cashier-dashboard.html',
    graphic_designer: '../../graphic-designer/html/designer-dashboard.html'
  });

  function initializeStaffLogin() {
    const form = document.getElementById('staffLoginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const loginButton = document.getElementById('loginButton') || form?.querySelector('[type="submit"]');
    const loginMessage = document.getElementById('loginMessage');

    if (!form || !usernameInput || !passwordInput) {
      console.error('Missing staff login elements: #staffLoginForm, #username, #password');
      return;
    }

    let isSubmitting = false;
    const originalButtonHTML = loginButton?.innerHTML ?? '';

    function message(text, kind = 'error') {
      if (loginMessage) {
        loginMessage.textContent = text;
        loginMessage.className = `login-message ${kind}`;
        loginMessage.setAttribute('role', kind === 'error' ? 'alert' : 'status');
      }
      if (kind === 'error' && window.Swal?.fire) {
        window.Swal.fire({
          icon: 'error', title: 'Login Failed', text,
          background: '#111111', color: '#ffffff',
          confirmButtonColor: '#d4af37'
        });
      } else if (kind === 'error' && !loginMessage) {
        window.alert(text);
      }
    }

    function setLoading(loading) {
      isSubmitting = loading;
      form.setAttribute('aria-busy', String(loading));
      if (!loginButton) return;
      loginButton.disabled = loading;
      loginButton.innerHTML = loading
        ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> <span>Signing In...</span>'
        : originalButtonHTML;
    }

    function clearStaffSession() {
      localStorage.removeItem('staffToken');
      localStorage.removeItem('staffUser');
    }

    function saveStaffSession(token, user) {
      try {
        localStorage.setItem('staffUser', JSON.stringify(user));
        localStorage.setItem('staffToken', token);
      } catch (error) {
        clearStaffSession();
        throw new Error('Cannot save login session. Enable browser storage and try again.');
      }
    }

    if (togglePassword) {
      if (togglePassword.tagName === 'BUTTON') togglePassword.type = 'button';
      const syncToggle = () => {
        const visible = passwordInput.type === 'text';
        const icon = togglePassword.querySelector('i');
        icon?.classList.toggle('fa-eye', !visible);
        icon?.classList.toggle('fa-eye-slash', visible);
        togglePassword.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
        togglePassword.setAttribute('aria-pressed', String(visible));
      };
      syncToggle();
      togglePassword.addEventListener('click', event => {
        event.preventDefault();
        passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        syncToggle();
      });
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (isSubmitting) return;
      if (loginMessage) {
        loginMessage.textContent = '';
        loginMessage.className = 'login-message';
      }

      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username) { message('Please enter your username.'); usernameInput.focus(); return; }
      if (!password) { message('Please enter your password.'); passwordInput.focus(); return; }

      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        clearStaffSession();
        const response = await fetch(`${API_BASE_URL}/api/staff/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ username, password }),
          signal: controller.signal
        });

        const data = await response.json().catch(() => {
          throw new Error('Invalid server response. Check /api/staff/login.');
        });
        if (!response.ok || data?.success !== true) {
          throw new Error(data?.message || 'Incorrect username or password.');
        }
        if (typeof data.token !== 'string' || !data.token.trim()) {
          throw new Error('Login succeeded but staff token is missing.');
        }
        if (!data.user || typeof data.user !== 'object' || Array.isArray(data.user)) {
          throw new Error('Login succeeded but staff user data is missing.');
        }

        const role = String(data.user.role || '').trim().toLowerCase();
        const status = String(data.user.status || '').trim().toLowerCase();

        if (status !== 'active') {
          throw new Error('Your staff account is inactive or restricted. Contact the administrator.');
        }
        if (role === 'admin') {
          throw new Error('Admin accounts must use the Admin Login.');
        }
        if (!Object.prototype.hasOwnProperty.call(STAFF_PAGES, role)) {
          throw new Error('Unauthorized staff role. Contact the administrator.');
        }

        const user = { ...data.user, role, status };
        saveStaffSession(data.token, user);
        passwordInput.value = '';

        const welcome = {
          inventory_staff: 'Opening Inventory Management...',
          cashier: 'Opening Cashier Dashboard...',
          graphic_designer: 'Opening Graphic Designer Dashboard...'
        };
        message(welcome[role], 'success');

        const destination = new URL(STAFF_PAGES[role], window.location.href);
        window.location.replace(destination.href);
      } catch (error) {
        const text = error.name === 'AbortError'
          ? 'Login request timed out. Check your connection and try again.'
          : error instanceof TypeError
            ? `Cannot connect to backend at ${API_BASE_URL}.`
            : error.message || 'Unable to login.';
        message(text);
        setLoading(false);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStaffLogin, { once: true });
  } else {
    initializeStaffLogin();
  }
})();
