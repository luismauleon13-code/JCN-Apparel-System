// =========================================================
// JCN APPAREL - STAFF LOGIN
// File: staff/js/staff-login.js
// =========================================================

"use strict";

(() => {
  const API_BASE_URL = "http://localhost:5000";

  const STAFF_PAGES = {
  inventory_staff: "../../Inventory/html/inventory-product.html",
  cashier: "../../Cashier/cashier-dashboard.html"
};

  function initializeStaffLogin() {
    // =====================================================
    // HTML ELEMENTS
    // =====================================================

    const loginForm = document.getElementById("staffLoginForm");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");

    const loginButton =
      document.getElementById("loginButton") ||
      loginForm?.querySelector('[type="submit"]');

    const loginMessage = document.getElementById("loginMessage");

    if (!loginForm || !usernameInput || !passwordInput) {
      console.error(
        "Staff login requires #staffLoginForm, #username, and #password."
      );
      return;
    }

    let isSubmitting = false;

    const originalButtonHTML = loginButton
      ? loginButton.innerHTML
      : "";

    // =====================================================
    // EXISTING SESSION BEHAVIOR
    // =====================================================

    // Intentionally no automatic redirect.
    // Opening Staff Login will show the login page first.
    // Dashboard redirect only happens after successful login.

    // =====================================================
    // SHOW / HIDE PASSWORD
    // =====================================================

    if (togglePassword) {
      // Prevent an eye button inside the form from submitting it.
      if (togglePassword.tagName === "BUTTON") {
        togglePassword.type = "button";
      }

      function updatePasswordToggle() {
        const isVisible = passwordInput.type === "text";
        const icon = togglePassword.querySelector("i");

        if (icon) {
          icon.classList.toggle("fa-eye", !isVisible);
          icon.classList.toggle("fa-eye-slash", isVisible);
        }

        togglePassword.setAttribute(
          "aria-label",
          isVisible ? "Hide password" : "Show password"
        );

        togglePassword.setAttribute(
          "aria-pressed",
          String(isVisible)
        );
      }

      updatePasswordToggle();

      togglePassword.addEventListener("click", (event) => {
        event.preventDefault();

        passwordInput.type =
          passwordInput.type === "password" ? "text" : "password";

        updatePasswordToggle();
      });
    }

    // =====================================================
    // LOGIN FORM
    // =====================================================

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      // Prevent duplicate requests.
      if (isSubmitting) return;

      clearMessage();

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username) {
        showError("Please enter your username.");
        usernameInput.focus();
        return;
      }

      if (!password) {
        showError("Please enter your password.");
        passwordInput.focus();
        return;
      }

      setLoading(true);

      const controller = new AbortController();

      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, 20000);

      try {
        // Clear the old staff identity before a new login attempt.
        clearStaffSession();

        // =================================================
        // EXISTING STAFF LOGIN ENDPOINT
        // =================================================

        const response = await fetch(
          `${API_BASE_URL}/api/staff/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify({
              username,
              password
            }),
            signal: controller.signal
          }
        );

        let data;

        try {
          data = await response.json();
        } catch (error) {
          if (error.name === "AbortError") throw error;

          throw new Error(
            "Invalid response from the server. Check the staff login API."
          );
        }

        if (!response.ok || data?.success !== true) {
          throw new Error(
            typeof data?.message === "string"
              ? data.message
              : "Login failed. Please check your username and password."
          );
        }

        // =================================================
        // VALIDATE LOGIN RESPONSE
        // =================================================

        if (
          typeof data.token !== "string" ||
          !data.token.trim()
        ) {
          throw new Error(
            "Login successful, but authentication token is missing."
          );
        }

        if (
          !data.user ||
          typeof data.user !== "object" ||
          Array.isArray(data.user)
        ) {
          throw new Error(
            "Login successful, but staff information is missing."
          );
        }

        const role = String(data.user.role || "")
          .trim()
          .toLowerCase();

        const status = String(data.user.status || "")
          .trim()
          .toLowerCase();

        if (status !== "active") {
          throw new Error(
            "Your staff account is inactive or restricted. Please contact the administrator."
          );
        }

        // =================================================
        // ROLE VALIDATION
        // =================================================

        if (role === "admin") {
          throw new Error(
            "Admin accounts must use the Admin Login."
          );
        }

        if (role === "graphic_designer") {
          throw new Error(
            "Graphic Designer Dashboard is not available yet."
          );
        }

        if (
          !Object.prototype.hasOwnProperty.call(STAFF_PAGES, role)
        ) {
          throw new Error(
            "Your account does not have an authorized staff role. Please contact the administrator."
          );
        }

        // =================================================
        // SAVE STAFF SESSION
        // =================================================

        const staffUser = {
          ...data.user,
          role,
          status
        };

        saveStaffSession(data.token, staffUser);

        passwordInput.value = "";

        // =================================================
        // ROLE-BASED REDIRECT
        // =================================================

        if (role === "cashier") {
          showSuccess(
            "Welcome Cashier!",
            "Login successful. Opening Cashier Dashboard..."
          );
        } else {
          showSuccess(
            "Welcome Inventory Staff!",
            "Login successful. Opening Inventory Management..."
          );
        }

        const dashboardURL = new URL(
  STAFF_PAGES[role],
  window.location.href
);

console.log("Staff role:", role);
console.log("Dashboard URL:", dashboardURL.href);

window.location.replace(dashboardURL.href);

        // Keep the button disabled while redirecting.
      } catch (error) {
        let message =
          error.message || "Unable to login. Please try again.";

        if (error.name === "AbortError") {
          message =
            "The login request timed out. Please check your connection and try again.";
        } else if (error instanceof TypeError) {
          message =
            "Cannot connect to the server. Make sure the backend is running at http://localhost:5000.";
        }

        showError(message);
        setLoading(false);
      } finally {
        window.clearTimeout(timeoutId);
      }
    });

    // =====================================================
    // SESSION HELPERS
    // =====================================================

    function saveStaffSession(token, user) {
      try {
        localStorage.setItem("staffUser", JSON.stringify(user));
        localStorage.setItem("staffToken", token);
      } catch {
        // Remove any partially saved session.
        try {
          clearStaffSession();
        } catch {
          // Browser storage may be unavailable.
        }

        throw new Error(
          "Cannot save your login session. Please allow browser storage and try again."
        );
      }
    }

    function clearStaffSession() {
      localStorage.removeItem("staffToken");
      localStorage.removeItem("staffUser");
    }

    // =====================================================
    // MESSAGE HELPERS
    // =====================================================

    function clearMessage() {
      if (!loginMessage) return;

      loginMessage.textContent = "";
      loginMessage.className = "login-message";
    }

    function showError(message) {
      if (loginMessage) {
        loginMessage.textContent = message;
        loginMessage.className = "login-message error";
        loginMessage.setAttribute("role", "alert");
      }

      if (
        window.Swal &&
        typeof window.Swal.fire === "function"
      ) {
        window.Swal.fire({
          icon: "error",
          title: "Login Failed",
          text: message,
          background: "#111111",
          color: "#ffffff",
          confirmButtonText: "OK",
          confirmButtonColor: "#d4af37"
        });
      } else if (!loginMessage) {
        window.alert(message);
      }
    }

    function showSuccess(title, message) {
      if (loginMessage) {
        loginMessage.textContent = message;
        loginMessage.className = "login-message success";
        loginMessage.setAttribute("role", "status");
      }

      if (
        window.Swal &&
        typeof window.Swal.fire === "function"
      ) {
        window.Swal.fire({
          icon: "success",
          title,
          text: message,
          background: "#111111",
          color: "#ffffff",
          showConfirmButton: false,
          allowOutsideClick: false,
          allowEscapeKey: false,
          timer: 700,
          timerProgressBar: true
        });
      }
    }

    // =====================================================
    // LOADING STATE
    // =====================================================

    function setLoading(loading) {
      isSubmitting = loading;

      loginForm.setAttribute("aria-busy", String(loading));

      if (!loginButton) return;

      loginButton.disabled = loading;

      loginButton.innerHTML = loading
        ? `
          <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <span>Signing In...</span>
        `
        : originalButtonHTML;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeStaffLogin,
      { once: true }
    );
  } else {
    initializeStaffLogin();
  }
})();