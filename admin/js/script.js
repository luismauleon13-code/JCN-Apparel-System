"use strict";



(() => {

  if (window.__JCN_SHARED_SCRIPT_READY__) return;

  window.__JCN_SHARED_SCRIPT_READY__ = true;



  // =====================================================

  // SETTINGS

  // This file belongs in admin/js/script.js.

  // =====================================================



  const API_ROOT = "http://localhost:5000/api";

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

          "Cannot connect to http://localhost:5000. " +

          "Check that the backend is running."

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

  // ADMIN RESET MODAL

  // Preserve existing controls; reset API handler still

  // needs to be connected separately.

  // =====================================================



  function setupAdminResetModal() {

    const modal = $("resetModal");



    function close() {

      setVisible(modal, false);

      setText("resetMessage", "");



      [

        "resetEmail",

        "resetOtp",

        "resetNewPassword",

        "resetConfirmPassword"

      ].forEach(id => {

        if ($(id)) $(id).value = "";

      });

    }



    $("adminForgotPasswordBtn")?.addEventListener("click", event => {

      event.preventDefault();

      setVisible(modal, true);

      $("resetEmail")?.focus();

    });



    $("cancelResetBtn")?.addEventListener("click", close);



    $("resetNextBtn")?.addEventListener("click", event => {

      event.preventDefault();



      showMessage(

        $("resetMessage"),

        "Password reset is not configured on this page yet."

      );

    });



    modal?.addEventListener("click", event => {

      if (event.target === modal) close();

    });



    $("successOkBtn")?.addEventListener("click", () => {

      setVisible($("successModal"), false);

    });



    document.addEventListener("keydown", event => {

      if (event.key === "Escape") close();

    });

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