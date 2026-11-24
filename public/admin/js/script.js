


(() => {

  if (window.__JCN_SHARED_SCRIPT_READY__) return;

  window.__JCN_SHARED_SCRIPT_READY__ = true;

  
const API_ROOT = "/api";

  const PENDING_KEY = "pendingRegistration";

  const VERIFY_EMAIL_KEY = "verifyEmail";



  const source = document.currentScript?.src;



  const projectRoot = source

    ? new URL("../../", source)

    : new URL("./", window.location.href);



  const pages = {

    customerLogin: new URL(

      "customer/html/user-login.html",

      projectRoot

    ).href,



    customerDashboard: new URL(

      "customer/html/dashboard.html",

      projectRoot

    ).href,



    adminLogin: new URL(

      "admin/html/admin-login.html",

      projectRoot

    ).href,



    adminDashboard: new URL(

      "admin/html/admin-dashboard.html",

      projectRoot

    ).href,



    register: new URL(

      "user-register.html",

      projectRoot

    ).href,



    verification: new URL(

      "email-verification.html",

      projectRoot

    ).href

  };



  const $ = id => document.getElementById(id);

  let navigating = false;



  // =====================================================

  // HELPERS

  // =====================================================



  function setText(id, value) {

    const element = $(id);

    if (element) element.textContent = String(value ?? "");

  }



  function showMessage(element, value, success = false) {

    if (!element) return;



    element.textContent = value;

    element.classList.toggle("text-danger", !success);

    element.classList.toggle("text-success", success);

    element.setAttribute("role", "status");

    element.setAttribute("aria-live", "polite");

  }



  function ensureMessage(form, ids) {

    let element = ids.map(id => $(id)).find(Boolean);



    if (!element) {

      element = document.createElement("p");

      element.id = ids[0];

      element.className = "small text-center mb-3";

      form.appendChild(element);

    }



    return element;

  }



  function setVisible(element, visible) {

    if (!element) return;



    element.classList.toggle("hidden", !visible);

    element.setAttribute("aria-hidden", String(!visible));

  }



  function escapeHTML(value) {

    return String(value ?? "").replace(

      /[&<>"']/g,

      character => ({

        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        '"': "&quot;",

        "'": "&#39;"

      })[character]

    );

  }



  function peso(value) {

    const amount = Number(value ?? 0);



    return new Intl.NumberFormat("en-PH", {

      style: "currency",

      currency: "PHP",

      minimumFractionDigits: 0,

      maximumFractionDigits: 2

    }).format(Number.isFinite(amount) ? amount : 0);

  }



  function formatDate(value) {

    const date = new Date(value);



    if (!value || Number.isNaN(date.getTime())) {

      return "—";

    }



    return new Intl.DateTimeFormat("en-PH", {

      timeZone: "Asia/Manila",

      dateStyle: "medium",

      timeStyle: "short"

    }).format(date);

  }



  function clearAdminSession() {

    ["adminToken", "adminUser", "admin"].forEach(key => {

      localStorage.removeItem(key);

    });

  }



  function goToAdminLogin() {

    clearAdminSession();



    if (

      navigating ||

      window.location.pathname === new URL(pages.adminLogin).pathname

    ) {

      return;

    }



    navigating = true;

    window.location.replace(pages.adminLogin);

  }



  function setButtonLabel(button, label) {

    if (!button) return;



    if (button.tagName === "INPUT") {

      button.value = label;

    } else {

      button.textContent = label;

    }

  }



  function findField(form, name, ids = []) {

    return form.elements.namedItem(name) ||

      ids.map(id => $(id)).find(Boolean) ||

      null;

  }



  // =====================================================

  // API

  // =====================================================



  async function apiRequest(path, options = {}, admin = false) {

    const headers = new Headers(options.headers || {});

    headers.set("Accept", "application/json");



    if (options.body && !(options.body instanceof FormData)) {

      headers.set("Content-Type", "application/json");

    }



    if (admin) {

      const token = localStorage.getItem("adminToken");



      if (!token) {

        goToAdminLogin();

        throw new Error("Please sign in as administrator.");

      }



      headers.set("Authorization", `Bearer ${token}`);

    }



    const controller = new AbortController();

    const timer = setTimeout(() => controller.abort(), 30000);



    try {

      const response = await fetch(`${API_ROOT}${path}`, {

        ...options,

        headers,

        cache: "no-store",

        signal: controller.signal

      });



      const data = await response.json().catch(() => null);



      if (admin && response.status === 401) {

        goToAdminLogin();

        throw new Error(

          data?.message || "Your admin session has expired."

        );

      }



      if (!response.ok) {

        throw new Error(

          data?.message ||

          `Request failed (${response.status}): ${path}`

        );

      }



      if (!data || typeof data !== "object") {

        throw new Error("The server returned an invalid response.");

      }



      if (data.success === false) {

        throw new Error(data.message || "Request failed.");

      }



      return data;

    } catch (error) {

      if (error.name === "AbortError") {

        throw new Error(

          "Request timed out. Check the server and try again."

        );

      }



      
if (error instanceof TypeError) {
  throw new Error(
    `Cannot connect to ${API_ROOT}. ` +
    "Please check your internet connection or backend service."
  );
}




      throw error;

    } finally {

      clearTimeout(timer);

    }

  }



  function postAuth(endpoint, payload) {

    return apiRequest(`/auth/${endpoint}`, {

      method: "POST",

      body: JSON.stringify(payload)

    });

  }



  // =====================================================

  // LANDING PAGE

  // =====================================================



  function setupLandingPage() {

    const destinations = {

      openLoginBtn: pages.customerLogin,

      openPortalBtn: pages.register

    };



    Object.entries(destinations).forEach(([id, destination]) => {

      const element = $(id);

      if (!element) return;



      if (element.tagName === "A") {

        element.href = destination;

        return;

      }



      element.type = "button";



      element.addEventListener("click", event => {

        event.preventDefault();

        window.location.assign(destination);

      });

    });

  }



  // =====================================================

  // PASSWORD VISIBILITY

  // =====================================================



  function setupPasswordButtons() {

    document.querySelectorAll(".password-eye-btn[data-target]")

      .forEach(button => {

        button.type = "button";



        button.addEventListener("click", event => {

          event.preventDefault();



          const input = $(button.dataset.target);

          if (!input) return;



          const show = input.type === "password";

          input.type = show ? "text" : "password";



          button.setAttribute(

            "aria-label",

            show ? "Hide password" : "Show password"

          );



          const icon = button.querySelector("i");



          if (icon) {

            icon.classList.toggle("fa-eye", !show);

            icon.classList.toggle("fa-eye-slash", show);

          }

        });

      });

  }



  // =====================================================

  // ADMIN / CUSTOMER LOGIN

  // =====================================================



  function setupLogin(form, accountType) {

    const isCustomer = accountType === "customer";



    const usernameInput = findField(form, "username", isCustomer

      ? ["loginUsername", "userUsername", "customerUsername"]

      : ["adminUsername"]

    );



    const passwordInput = findField(form, "password", isCustomer

      ? ["loginPassword", "userPassword", "customerPassword"]

      : ["adminPassword"]

    );



    const messageElement = ensureMessage(form, isCustomer

      ? ["userLoginMessage", "customerLoginMessage", "loginMessage"]

      : ["adminLoginMessage"]

    );



    const button = form.querySelector('[type="submit"]');

    let busy = false;



    form.addEventListener("submit", async event => {

      event.preventDefault();



      if (busy) return;



      if (!usernameInput || !passwordInput) {

        showMessage(messageElement, "Login inputs were not found.");

        return;

      }



      if (!form.reportValidity()) return;



      const username = usernameInput.value.trim();

      const password = passwordInput.value;



      if (!username || !password) {

        showMessage(

          messageElement,

          "Please enter your username and password."

        );

        return;

      }



      busy = true;



      const originalLabel = button

        ? (button.tagName === "INPUT" ? button.value : button.innerHTML)

        : "";



      if (button) button.disabled = true;

      setButtonLabel(button, "Signing in...");

      showMessage(messageElement, "");



      try {

        const data = await postAuth(

          isCustomer ? "customer-login" : "admin-login",

          { username, password }

        );



        if (

          typeof data.token !== "string" ||

          !data.token.trim() ||

          !data.user ||

          data.user.role !== accountType

        ) {

          throw new Error(

            "The server returned an invalid login response."

          );

        }



        const user = {

          ...data.user,

          full_name: data.user.full_name || data.user.fullname || ""

        };



        const prefix = isCustomer ? "customer" : "admin";



        localStorage.setItem(`${prefix}Token`, data.token);

        localStorage.setItem(`${prefix}User`, JSON.stringify(user));



        showMessage(

          messageElement,

          "Login successful. Opening dashboard...",

          true

        );



        window.location.assign(

          isCustomer ? pages.customerDashboard : pages.adminDashboard

        );

      } catch (error) {

        console.error("LOGIN ERROR:", error);

        showMessage(messageElement, error.message);

      } finally {

        busy = false;



        if (button) {

          button.disabled = false;



          if (button.tagName === "INPUT") {

            button.value = originalLabel;

          } else {

            button.innerHTML = originalLabel;

          }

        }

      }

    });

  }



  // =====================================================

  // REGISTRATION -> EMAIL VERIFICATION PAGE

  // No Supabase insert happens on the registration page.

  // =====================================================



  function setupCustomerRegistration(form) {
    const messageElement = ensureMessage(form, [
      "userRegisterMessage",
      "registerMessage"
    ]);

    const button = form.querySelector('[type="submit"]');

    const fields = {
      firstName: findField(form, "firstName", ["registerFirstName"]),
      middleName: findField(form, "middleName", ["registerMiddleName"]),
      lastName: findField(form, "lastName", ["registerLastName"]),
      phone: findField(form, "phone", ["registerPhone"]),
      email: findField(form, "email", ["registerEmail"]),
      username: findField(form, "username", ["registerUsername"]),
      password: findField(form, "password", ["registerPassword"]),
      confirmPassword: findField(
        form,
        "confirmPassword",
        ["registerConfirmPassword"]
      )
    };

    // OTP is entered on email-verification.html, not on this page.
    [
      form.querySelector('[name="otp"]'),
      $("registerOtp"),
      $("sendOtpBtn")
    ].filter(Boolean).forEach(element => {
      element.disabled = true;
      element.hidden = true;
      element.required = false;
    });

    setButtonLabel(button, "Get Started");

    let busy = false;

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (busy) return;

      const requiredNames = [
        "firstName",
        "lastName",
        "phone",
        "email",
        "username",
        "password",
        "confirmPassword"
      ];

      const missing = requiredNames.filter(name => !fields[name]);

      if (missing.length) {
        showMessage(
          messageElement,
          `Missing registration inputs: ${missing.join(", ")}`
        );
        return;
      }

      if (!form.reportValidity()) return;

      const method = form.querySelector(
        'input[name="otpMethod"]:checked'
      )?.value || "email";

      // This verification page is currently the email OTP flow.
      if (method !== "email") {
        showMessage(
          messageElement,
          "Please select Email OTP for this verification flow."
        );
        return;
      }

      const registration = {
        firstName: fields.firstName.value.trim(),
        middleName: fields.middleName?.value.trim() || "",
        lastName: fields.lastName.value.trim(),
        phone: fields.phone.value.trim(),
        email: fields.email.value.trim().toLowerCase(),
        username: fields.username.value.trim(),
        password: fields.password.value,
        otp_method: "email"
      };

      if (
        !registration.firstName ||
        !registration.lastName ||
        !registration.phone ||
        !registration.email ||
        !registration.username ||
        !registration.password
      ) {
        showMessage(messageElement, "Complete all required fields.");
        return;
      }

      if (!/^09[0-9]{9}$/.test(registration.phone)) {
        showMessage(
          messageElement,
          "Enter an 11-digit phone number starting with 09."
        );
        return;
      }

      const strongPassword =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

      if (!strongPassword.test(registration.password)) {
        showMessage(
          messageElement,
          "Use at least 8 characters with uppercase, lowercase, " +
          "a number, and a special character."
        );
        return;
      }

      if (registration.password !== fields.confirmPassword.value) {
        showMessage(messageElement, "Passwords do not match.");
        return;
      }

      busy = true;
      if (button) button.disabled = true;
      setButtonLabel(button, "Sending email code...");
      showMessage(messageElement, "");

      try {
        // Save the complete registration only for this browser tab.
        // email-verification.js will read this after OTP verification.
        const pending = {
          ...registration,
          createdAt: Date.now(),
          expiresAt: Date.now() + 5 * 60 * 1000
        };

        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify(pending)
        );

        // IMPORTANT: email-verification.js reads this exact key.
        sessionStorage.setItem(
          VERIFY_EMAIL_KEY,
          registration.email
        );

        // Keep only the email as a localStorage fallback.
        localStorage.setItem(
          VERIFY_EMAIL_KEY,
          registration.email
        );

        console.log("REGISTRATION EMAIL SAVED:", registration.email);
        console.log(
          "pendingRegistration:",
          sessionStorage.getItem(PENDING_KEY)
        );
        console.log(
          "verifyEmail:",
          sessionStorage.getItem(VERIFY_EMAIL_KEY)
        );

        const data = await postAuth("send-otp", {
          email: registration.email,
          username: registration.username,
          phone: registration.phone,
          otp_method: "email"
        });

        if (data.success !== true) {
          throw new Error(
            data.message || "The server did not confirm sending the code."
          );
        }

        // Refresh the local expiry timestamp after the backend confirms send.
        pending.expiresAt = Date.now() + 5 * 60 * 1000;
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

        showMessage(
          messageElement,
          "Code sent. Opening email verification...",
          true
        );

        window.location.assign(pages.verification);
      } catch (error) {
        // Keep no stale registration if sending the OTP failed.
        sessionStorage.removeItem(PENDING_KEY);
        sessionStorage.removeItem(VERIFY_EMAIL_KEY);
        localStorage.removeItem(VERIFY_EMAIL_KEY);

        console.error("REGISTRATION OTP ERROR:", error);
        showMessage(messageElement, error.message);
      } finally {
        busy = false;
        if (button) button.disabled = false;
        setButtonLabel(button, "Get Started");
      }
    });
  }


  // =====================================================
  // CUSTOMER FORGOT PASSWORD
  // Shared script is stored in admin/js but also powers customer login.
  // =====================================================

  function setupCustomerForgotPassword() {
    const trigger = document.querySelector(
      '#userForgotPasswordBtn, #customerForgotPasswordBtn, #forgotPasswordBtn, ' +
      '#forgotPasswordLink, #forgotPassword, [data-action="forgot-password"], ' +
      'a[href="#forgot-password"], a[href="#forgotPassword"]'
    );

    if (!trigger) {
      console.warn('CUSTOMER RESET: Forgot Password trigger not found. Add id="forgotPasswordBtn" to the link/button.');
      return;
    }

    // Reuse a dedicated customer overlay, never the admin reset modal.
    const overlay = document.createElement('div');
    overlay.id = 'customerPasswordResetOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.8)';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="customerResetTitle"
           style="position:relative;width:min(100%,440px);padding:28px;border-radius:16px;border:1px solid #bc963c;background:#161616;color:#fff;font-family:Arial,sans-serif;box-shadow:0 16px 50px #0009">
        <button type="button" id="customerResetClose" aria-label="Close" style="position:absolute;right:16px;top:10px;border:0;background:none;color:#fff;font-size:28px;cursor:pointer">&times;</button>
        <h2 id="customerResetTitle" style="color:#e4b94f;margin:0 0 12px;font-size:22px">Forgot Password</h2>
        <p id="customerResetInfo" style="font-size:14px;color:#ccc">Enter the email registered to your customer account.</p>
        <form id="customerResetForm" novalidate>
          <label for="customerResetEmail" style="display:block;margin:14px 0 6px">Email</label>
          <input id="customerResetEmail" type="email" autocomplete="email" style="width:100%;padding:11px;border-radius:7px;border:1px solid #aaa;color:#111">
          <div id="customerResetOtpBox" hidden><label for="customerResetOtp" style="display:block;margin:14px 0 6px">6-digit OTP</label>
          <input id="customerResetOtp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" style="width:100%;padding:11px;border-radius:7px;border:1px solid #aaa;color:#111"></div>
          <div id="customerResetPasswordBox" hidden><label for="customerResetNewPassword" style="display:block;margin:14px 0 6px">New password</label>
          <input id="customerResetNewPassword" type="password" autocomplete="new-password" style="width:100%;padding:11px;border-radius:7px;border:1px solid #aaa;color:#111">
          <label for="customerResetConfirmPassword" style="display:block;margin:14px 0 6px">Confirm password</label>
          <input id="customerResetConfirmPassword" type="password" autocomplete="new-password" style="width:100%;padding:11px;border-radius:7px;border:1px solid #aaa;color:#111"></div>
          <p id="customerResetMessage" role="status" aria-live="polite" style="min-height:20px;font-size:13px;margin:14px 0"></p>
          <button id="customerResetSubmit" type="submit" style="width:100%;padding:12px;border:0;border-radius:8px;background:#e4b94f;color:#111;font-weight:bold;cursor:pointer">Send OTP</button>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    const get = id => overlay.querySelector('#' + id);
    const form = get('customerResetForm');
    const submit = get('customerResetSubmit');
    const email = get('customerResetEmail');
    const otp = get('customerResetOtp');
    const password = get('customerResetNewPassword');
    const confirmation = get('customerResetConfirmPassword');
    const message = get('customerResetMessage');
    let step = 1;
    let busy = false;
    let savedEmail = '';
    let savedOtp = '';

    // Check the actual route names and request fields in server.js.
    const ENDPOINTS = {
      send: 'forgot-password',
      verify: 'verify-reset-otp',
      finish: 'reset-password'
    };

    function showStep() {
      email.parentElement.querySelector('label[for="customerResetEmail"]').hidden = step !== 1;
      email.hidden = step !== 1;
      get('customerResetOtpBox').hidden = step !== 2;
      get('customerResetPasswordBox').hidden = step !== 3;
      get('customerResetInfo').textContent = step === 1
        ? 'Enter the email registered to your customer account.'
        : step === 2 ? 'Enter the six-digit code sent to your email.' : 'Create a new strong password.';
      submit.textContent = step === 1 ? 'Send OTP' : step === 2 ? 'Verify OTP' : 'Reset Password';
      (step === 1 ? email : step === 2 ? otp : password).focus();
    }

    function close(force = false) {
      if (busy && !force) return;
      overlay.style.display = 'none';
      form.reset();
      message.textContent = '';
      savedEmail = '';
      savedOtp = '';
      step = 1;
    }

    trigger.addEventListener('click', event => {
      event.preventDefault();
      if (busy) return;
      overlay.style.display = 'flex';
      showStep();
    });
    get('customerResetClose').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && overlay.style.display !== 'none') close();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      submit.disabled = true;
      message.style.color = '#ff9999';
      message.textContent = '';
      try {
        if (step === 1) {
          const value = email.value.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Please enter a valid email address.');
          await postAuth(ENDPOINTS.send, { email: value, accountType: 'customer' });
          savedEmail = value;
          step = 2;
          showStep();
          message.style.color = '#8ce3a1';
          message.textContent = 'If this customer account exists, check your email for the OTP.';
        } else if (step === 2) {
          const code = otp.value.trim();
          if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit OTP.');
          await postAuth(ENDPOINTS.verify, { email: savedEmail, otp: code, accountType: 'customer' });
          savedOtp = code;
          step = 3;
          showStep();
          message.style.color = '#8ce3a1';
          message.textContent = 'OTP verified. Enter a new password.';
        } else {
          const newPassword = password.value;
          if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/.test(newPassword)) {
            throw new Error('Use 8+ characters with uppercase, lowercase, number and special character.');
          }
          if (confirmation.value !== newPassword) throw new Error('Passwords do not match.');
          await postAuth(ENDPOINTS.finish, {
            email: savedEmail, otp: savedOtp, newPassword, accountType: 'customer'
          });
          busy = false;
          close(true);
          alert('Password successfully updated. Please log in with your new password.');
          window.location.assign(pages.customerLogin);
        }
      } catch (error) {
        console.error('CUSTOMER RESET ERROR:', error);
        message.textContent = error.message || 'Password reset failed.';
        if (/No OTP request found|OTP expired/i.test(error.message || '')) {
          savedOtp = '';
          savedEmail = '';
          step = 1;
          showStep();
          message.textContent = 'The OTP is no longer available on the server. Please request a new code.';
        }
      } finally {
        busy = false;
        submit.disabled = false;
      }
    });
  }

  // =====================================================

  // ADMIN RESET MODAL

  // Preserve existing controls; reset API handler still

  // needs to be connected separately.

  // =====================================================



  function setupAdminResetModal() {
    const modal = $("resetModal");
    const nextButton = $("resetNextBtn");
    const message = $("resetMessage");
    const email = $("resetEmail");
    const otp = $("resetOtp");
    const password = $("resetNewPassword");
    const confirmPassword = $("resetConfirmPassword");

    if (!modal || !nextButton || !email || !otp || !password || !confirmPassword) {
      console.warn("ADMIN RESET: Missing one or more required modal elements.");
      return;
    }

    // IMPORTANT: Match these three route names to your real server.js.
    // All routes use POST /api/auth/<route-name>.
    const RESET_ENDPOINTS = {
      send: "send-reset-otp",
      verify: "verify-reset-otp",
      finish: "reset-password"
    };

    let step = 1;
    let busy = false;
    let verifiedEmail = "";
    let verifiedOtp = "";

    function fieldGroup(input) {
      return input.closest(".form-group, .mb-3, .input-group, .field-group") || input.parentElement;
    }

    function updateStep() {
      // Only the fields for the current step are displayed.
      fieldGroup(email).hidden = step !== 1;
      fieldGroup(otp).hidden = step !== 2;
      fieldGroup(password).hidden = step !== 3;
      fieldGroup(confirmPassword).hidden = step !== 3;
      setButtonLabel(nextButton, step === 1 ? "Send OTP" : step === 2 ? "Verify OTP" : "Reset Password");
      [email, otp, password][step - 1].focus();
    }

    function close() {
      if (busy) return;
      setVisible(modal, false);
      [email, otp, password, confirmPassword].forEach(el => { el.value = ""; });
      showMessage(message, "");
      verifiedEmail = "";
      verifiedOtp = "";
      step = 1;
      updateStep();
    }

    $("adminForgotPasswordBtn")?.addEventListener("click", event => {
      event.preventDefault();
      step = 1;
      updateStep();
      setVisible(modal, true);
      email.focus();
    });

    $("cancelResetBtn")?.addEventListener("click", event => {
      event.preventDefault();
      close();
    });

    nextButton.addEventListener("click", async event => {
      event.preventDefault();
      if (busy) return;

      try {
        busy = true;
        nextButton.disabled = true;
        showMessage(message, "");

        if (step === 1) {
          const value = email.value.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error("Please enter a valid email address.");
          }
          await postAuth(RESET_ENDPOINTS.send, { email: value, accountType: "admin" });
          verifiedEmail = value;
          step = 2;
          updateStep();
          showMessage(message, "If the account exists, a reset code has been sent. Check your email.", true);
        } else if (step === 2) {
          const code = otp.value.trim();
          if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit OTP.");
          await postAuth(RESET_ENDPOINTS.verify, { email: verifiedEmail, otp: code, accountType: "admin" });
          verifiedOtp = code;
          step = 3;
          updateStep();
          showMessage(message, "Code verified. Enter your new password.", true);
        } else {
          const newPassword = password.value;
          if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/.test(newPassword)) {
            throw new Error("Password needs 8+ characters, uppercase, lowercase, number and symbol.");
          }
          if (newPassword !== confirmPassword.value) {
            throw new Error("Passwords do not match.");
          }
          await postAuth(RESET_ENDPOINTS.finish, {
            email: verifiedEmail,
            otp: verifiedOtp,
            newPassword,
            accountType: "admin"
          });
          busy = false;
          close();
          setVisible($("successModal"), true);
          showMessage(message, "Password updated. You may now log in.", true);
        }
      } catch (error) {
        console.error("ADMIN PASSWORD RESET ERROR:", error);
        showMessage(message, error.message || "Unable to reset password.");
      } finally {
        busy = false;
        nextButton.disabled = false;
      }
    });

    modal.addEventListener("click", event => {
      if (event.target === modal) close();
    });

    $("successOkBtn")?.addEventListener("click", () => {
      setVisible($("successModal"), false);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !busy) close();
    });

    updateStep();
  }


  // =====================================================

  // ADMIN OVERVIEW

  // =====================================================



  async function loadOverview() {

    const activityElement = $("recentActivity");



    try {

      const data = await apiRequest("/admin/overview", {}, true);



      setText("totalUsers", Number(data.totalUsers || 0));

      setText("pendingOrders", Number(data.pendingOrders || 0));

      setText("completedOrders", Number(data.completedOrders || 0));

      setText("revenue", peso(data.revenue));



      if (!activityElement) return;



      const announcements = Array.isArray(data.recentAnnouncements)

        ? data.recentAnnouncements

        : [];



      const orders = Array.isArray(data.recentOrders)

        ? data.recentOrders

        : [];



      const activities = [

        ...announcements.map(item => ({

          icon: "fa-bullhorn",

          title: item.title || "Announcement",

          message: item.message || "",

          date: item.created_at

        })),



        ...orders.map(order => ({

          icon: "fa-cart-shopping",

          title: `Order #${order.order_number || order.id || ""}`,

          message:

            `Status: ${order.status || "Unknown"} | ` +

            `Payment: ${order.payment_status || "Unknown"} | ` +

            `Amount: ${peso(order.total_amount)}`,

          date: order.created_at

        }))

      ];



      activities.sort((a, b) =>

        (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)

      );



      activityElement.innerHTML = activities.length

        ? activities.slice(0, 8).map(item => `

            <div class="inner-panel p-3 mb-3 d-flex gap-3 align-items-start">

              <div class="activity-icon">

                <i class="fa-solid ${item.icon}"></i>

              </div>



              <div class="flex-grow-1">

                <p class="text-light mb-1 fw-semibold">

                  ${escapeHTML(item.title)}

                </p>

                <small class="text-secondary-light">

                  ${escapeHTML(item.message)}

                </small>

              </div>



              <small class="text-secondary-light text-end">

                ${escapeHTML(formatDate(item.date))}

              </small>

            </div>

          `).join("")

        : `

            <div class="inner-panel p-3">

              <p class="text-light mb-1">No recent activity</p>

              <small class="text-secondary-light">

                No orders or announcements yet.

              </small>

            </div>

          `;

    } catch (error) {

      console.error("ADMIN OVERVIEW ERROR:", error);



      ["totalUsers", "pendingOrders", "completedOrders", "revenue"]

        .forEach(id => setText(id, "—"));



      if (activityElement) {

        activityElement.innerHTML = `

          <div class="inner-panel p-3">

            <p class="text-danger mb-1">Unable to load dashboard</p>

            <small class="text-secondary-light">

              ${escapeHTML(error.message)}

            </small>

          </div>

        `;

      }

    }

  }



  // =====================================================

  // ADMIN SALES

  // =====================================================



  async function loadSalesSummary() {

    const fields = {

      salesToday: "today",

      salesWeek: "week",

      salesMonth: "month",

      salesQuarterly: "quarterly",

      salesYearly: "yearly"

    };



    if (!Object.keys(fields).some(id => $(id))) return;



    try {

      const data = await apiRequest("/admin/sales-summary", {}, true);



      Object.entries(fields).forEach(([id, key]) => {

        setText(id, peso(data[key]));

      });

    } catch (error) {

      console.error("ADMIN SALES ERROR:", error);



      Object.keys(fields).forEach(id => {

        setText(id, "—");

        if ($(id)) $(id).title = error.message;

      });

    }

  }



  // =====================================================

  // ADMIN LOGOUT

  // =====================================================



  function setupLogout() {

    const modal = $("adminLogoutModal");



    $("adminLogoutBtn")?.addEventListener("click", event => {

      event.preventDefault();



      if (modal) setVisible(modal, true);

      else goToAdminLogin();

    });



    $("adminConfirmLogout")?.addEventListener("click", event => {

      event.preventDefault();

      goToAdminLogin();

    });



    $("adminCancelLogout")?.addEventListener("click", event => {

      event.preventDefault();

      setVisible(modal, false);

    });



    modal?.addEventListener("click", event => {

      if (

        event.target === modal ||

        event.target.classList.contains("logout-backdrop")

      ) {

        setVisible(modal, false);

      }

    });



    document.addEventListener("keydown", event => {

      if (event.key === "Escape") {

        setVisible(modal, false);

      }

    });

  }



  // =====================================================

  // PAGE INITIALIZATION

  // =====================================================



  function start() {

    const pathname = window.location.pathname.toLowerCase();



    // The verification page uses its own email-verification.js.

    if (pathname.endsWith("/email-verification.html")) {

      return;

    }



    setupLandingPage();

    setupPasswordButtons();



    // Registration must be initialized before other page guards.

    const registerForm = $("userRegisterForm");



    if (registerForm) {

      setupCustomerRegistration(registerForm);

      return;

    }



    const isCustomerLogin =

      pathname.endsWith("/customer/html/user-login.html") ||

      pathname.endsWith("/customer/html/customer-login.html") ||

      document.body.dataset.page === "customer-login";



    if (isCustomerLogin) {

      const form =

        $("userLoginForm") ||

        $("customerLoginForm") ||

        $("loginForm");



      if (form) setupLogin(form, "customer");

      setupCustomerForgotPassword();

      return;

    }



    // Do not apply admin session handling to other portals.

    if (

      pathname.includes("/customer/") ||

      pathname.includes("/staff/")

    ) {

      return;

    }



    const adminForm = $("adminLoginForm");



    if (adminForm) {

      setupLogin(adminForm, "admin");

      setupAdminResetModal();

      return;

    }



    const isAdminDashboard =

      pathname.includes("/admin/html/") &&

      Boolean($("totalUsers") && $("recentActivity"));



    if (!isAdminDashboard) return;



    setupLogout();



    if (!localStorage.getItem("adminToken")) {

      goToAdminLogin();

      return;

    }



    Promise.all([

      loadOverview(),

      loadSalesSummary()

    ]).catch(error => {

      console.error("ADMIN INITIALIZATION ERROR:", error);

    });

  }



  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", start, {

      once: true

    });

  } else {

    start();

  }

})();