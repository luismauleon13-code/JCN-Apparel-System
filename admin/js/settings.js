/* =========================================
   JCN ADMIN ACCOUNT SETTINGS
========================================= */

(() => {

  /* =========================================
     01. API CONFIGURATION
  ========================================= */

  const isLocalServer =
    ["localhost", "127.0.0.1"].includes(location.hostname) &&
    location.port === "5500";

  const SETTINGS_API =
    window.JCN_SETTINGS_API ||
    (isLocalServer
      ? "http://localhost:5000/api/admin/settings"
      : "/api/admin/settings");

  const LOGIN_URL = "admin-login.html";
  const THEME_KEY = "jcnAdminAccountTheme";

  const $ = id => document.getElementById(id);


  /* =========================================
     02. SETTINGS FIELDS
  ========================================= */

  const PROFILE_KEYS = [
    "admin_name",
    "admin_username",
    "admin_email"
  ];

  const SECURITY_KEYS = [
    "session_timeout",
    "strong_password_required"
  ];

  const ALLOWED_FIELDS = [

    // Shop Information
    "shop_name",
    "shop_email",
    "shop_phone",
    "shop_address",
    "business_hours",

    // Admin Account
    "admin_name",
    "admin_username",
    "admin_email",

    // Delivery
    "delivery_fee",
    "free_shipping_min",
    "delivery_days",

    // Payment
    "paypal_client_id",
    "paypal_mode",

    // Email
    "email_order_confirmation",
    "email_tracking_updates",
    "email_delivery_updates",

    // AI
    "ai_enabled",
    "ai_style",
    "ai_design_suggestions",

    // Announcements
    "announcement_title",
    "announcement_message",
    "announcement_enabled",

    // Security
    "session_timeout",
    "strong_password_required"

  ];


  /* =========================================
     03. APPLICATION STATE
  ========================================= */

  let savedSettings = null;
  let isBusy = false;
  let accessBlocked = false;
  let hasUnsavedChanges = false;
  let saveUnconfirmed = false;


  /* =========================================
     04. UTILITY FUNCTIONS
  ========================================= */

  function isValidObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function toBoolean(value) {
    return [true, 1, "true", "1"].includes(value);
  }

  function showMessage(message, type = "info") {

    const messageBox = $("settingsMessage");

    messageBox.textContent = message;

    messageBox.className =
      `settings-message ${type}`;

  }

  function hideMessage() {

    const messageBox = $("settingsMessage");

    messageBox.textContent = "";

    messageBox.className =
      "settings-message d-none";

  }

  function setStatus(message, type = "") {

    const status = $("settingsStatus");

    status.textContent = message;

    status.className =
      `settings-status ${type}`.trim();

  }


  /* =========================================
     05. LOADING AND FORM STATE
  ========================================= */

  function setBusy(value) {

    isBusy = value;

    const disabled =
      value ||
      !savedSettings ||
      accessBlocked ||
      saveUnconfirmed;

    for (const group of ["profile", "security"]) {

      $(group + "Fields").disabled = disabled;

      $(group + "Save").disabled = disabled;

    }

    $("reloadAccount").disabled = value;

    $("profileForm").setAttribute(
      "aria-busy",
      String(value)
    );

    $("securityForm").setAttribute(
      "aria-busy",
      String(value)
    );

  }

  function canEdit() {

    return (
      !isBusy &&
      Boolean(savedSettings) &&
      !accessBlocked &&
      !saveUnconfirmed
    );

  }


  /* =========================================
     06. FILL SAVED ACCOUNT INFORMATION
  ========================================= */

  function fillForm() {

    if (!savedSettings) return;

    const keys = [
      ...PROFILE_KEYS,
      ...SECURITY_KEYS
    ];

    for (const key of keys) {

      const field = $(key);

      if (key === "strong_password_required") {

        field.checked =
          toBoolean(savedSettings[key]);

      } else {

        field.value =
          savedSettings[key] ?? "";

      }

    }

  }


  /* =========================================
     07. READ FORM VALUES
  ========================================= */

  function readForm(keys) {

    const values = {};

    for (const key of keys) {

      const field = $(key);

      if (key === "strong_password_required") {

        values[key] = field.checked;

      } else if (key === "session_timeout") {

        values[key] = Number(field.value);

      } else {

        values[key] = field.value.trim();

      }

    }

    return values;

  }

  function normalizeValue(key, value) {

    if (key === "strong_password_required") {
      return toBoolean(value);
    }

    if (key === "session_timeout") {
      return Number(value);
    }

    return String(value ?? "").trim();

  }


  /* =========================================
     08. UNSAVED CHANGES
  ========================================= */

  function updateDirtyState() {

    if (!savedSettings) return;

    const keys = [
      ...PROFILE_KEYS,
      ...SECURITY_KEYS
    ];

    const currentValues = readForm(keys);

    hasUnsavedChanges = keys.some(key => {

      return (
        normalizeValue(key, currentValues[key]) !==
        normalizeValue(key, savedSettings[key])
      );

    });

    if (saveUnconfirmed) {

      setStatus(
        "Save not confirmed",
        "error"
      );

    } else if (hasUnsavedChanges) {

      setStatus("Unsaved changes");

    } else {

      setStatus(
        "Settings loaded",
        "success"
      );

    }

  }


  /* =========================================
     09. ACCOUNT SECTION NAVIGATION
  ========================================= */

  function openPanel(key = null) {

    if (isBusy) return;

    const selectedPanel = key
      ? $("panel-" + key)
      : null;

    // Prevent invalid section navigation.

    if (key && !selectedPanel) return;

    // Confirm unsaved changes.

    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved changes?")
    ) {
      return;
    }

    hasUnsavedChanges = false;

    fillForm();
    hideMessage();

    // Show or hide account home.

    $("accountHome").hidden = Boolean(key);

    // Display selected section.

    document.querySelectorAll(".account-section")
      .forEach(panel => {

        panel.hidden = panel !== selectedPanel;

      });

    // Preferences can work without the Settings API.

    if (key !== "preferences") {

      if (saveUnconfirmed) {

        showMessage(
          "The previous save could not be verified. " +
          "Reload your account before making changes.",
          "error"
        );

      } else if (!savedSettings) {

        showMessage(
          "Account settings are unavailable. " +
          "Return to account and reload.",
          "error"
        );

      } else if (accessBlocked) {

        showMessage(
          "Account access is unavailable. Please log in again.",
          "error"
        );

      } else {

        setStatus(
          "Settings loaded",
          "success"
        );

      }

    }

    // Accessibility focus.

    if (selectedPanel) {

      selectedPanel.querySelector("h2")?.focus();

    } else {

      document.querySelector("[data-open]")?.focus();

    }

  }


  /* =========================================
     10. SETTINGS API REQUEST
  ========================================= */

  async function requestSettings(
    method = "GET",
    payload
  ) {

    const controller = new AbortController();

    const timeout = setTimeout(() => {

      controller.abort();

    }, 15000);

    try {

      /* ADMIN AUTHENTICATION */

      const token =
        localStorage.getItem("adminToken");

      if (!token) {

        accessBlocked = true;

        throw new Error(
          "Admin login is required. Please log in again."
        );

      }


      /* REQUEST HEADERS */

      const headers = {

        Accept: "application/json",

        Authorization: `Bearer ${token}`

      };

      if (payload !== undefined) {

        headers["Content-Type"] =
          "application/json";

      }


      /* SEND API REQUEST */

      const response = await fetch(SETTINGS_API, {

        method,
        headers,

        signal: controller.signal,

        cache: "no-store",

        ...(payload !== undefined
          ? {
              body: JSON.stringify(payload)
            }
          : {})

      });


      /* EXPIRED SESSION */

      if (response.status === 401) {

        accessBlocked = true;

        throw new Error(
          "Your admin session has expired. " +
          "Log out and log in again."
        );

      }


      /* ACCESS DENIED */

      if (response.status === 403) {

        accessBlocked = true;

        throw new Error(
          "You do not have permission to manage settings."
        );

      }


      /* API NOT FOUND */

      if (response.status === 404) {

        throw new Error(
          "Settings API not found. " +
          "Check /api/admin/settings in server.js."
        );

      }


      /* PARSE SERVER RESPONSE */

      let data;

      try {

        data = await response.json();

      } catch (error) {

        if (error.name === "AbortError") {
          throw error;
        }

        throw new Error(
          `Invalid server response (HTTP ${response.status}).`
        );

      }


      /* VALIDATE RESPONSE */

      if (
        !response.ok ||
        data?.success !== true
      ) {

        throw new Error(

          typeof data?.message === "string"
            ? data.message
            : `Request failed (HTTP ${response.status}).`

        );

      }

      return data;

    } catch (error) {

      /* REQUEST TIMEOUT */

      if (error.name === "AbortError") {

        throw new Error(
          "Request timed out. Reload the account " +
          "before trying again."
        );

      }


      /* NETWORK ERROR */

      if (error instanceof TypeError) {

        throw new Error(
          "Cannot connect to the backend. " +
          "Check your server and internet connection."
        );

      }

      throw error;

    } finally {

      clearTimeout(timeout);

    }

  }


  /* =========================================
     11. LOAD ADMIN ACCOUNT SETTINGS
  ========================================= */

  async function loadSettings() {

    if (isBusy) return;

    if (
      hasUnsavedChanges &&
      !window.confirm("Discard your current changes?")
    ) {
      return;
    }

    setBusy(true);

    setStatus("Connecting...");

    hideMessage();

    try {

      const data = await requestSettings();

      if (!isValidObject(data.settings)) {

        throw new Error(
          "Invalid settings response."
        );

      }

      savedSettings = data.settings;

      accessBlocked = false;
      saveUnconfirmed = false;
      hasUnsavedChanges = false;

      fillForm();

      setStatus(
        "Settings loaded",
        "success"
      );

    } catch (error) {

      savedSettings = null;

      setStatus(
        "Connection failed",
        "error"
      );

      showMessage(
        error.message,
        "error"
      );

      console.error(
        "Load settings error:",
        error
      );

    } finally {

      setBusy(false);

    }

  }


  /* =========================================
     12. FORM VALIDATION
  ========================================= */

  function validateForm(keys, values) {

    /* PERSONAL INFORMATION */

    if (keys === PROFILE_KEYS) {

      if (!values.admin_username) {

        throw new Error(
          "Username is required."
        );

      }

      if (!values.admin_email) {

        throw new Error(
          "Email address is required."
        );

      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(values.admin_email)) {

        throw new Error(
          "Enter a valid email address."
        );

      }

      if (values.admin_name.length > 120) {

        throw new Error(
          "Full name is too long."
        );

      }

    }


    /* ACCOUNT SECURITY */

    if (keys === SECURITY_KEYS) {

      const timeout = values.session_timeout;

      if (
        !Number.isSafeInteger(timeout) ||
        timeout < 1
      ) {

        throw new Error(
          "Session timeout must be a positive whole number."
        );

      }

    }

  }


  /* =========================================
     13. SAVE ADMIN SETTINGS
  ========================================= */

  async function saveGroup(event, keys) {

    event.preventDefault();

    if (!canEdit()) return;

    if (!event.currentTarget.reportValidity()) {
      return;
    }

    hideMessage();

    const updatedValues = readForm(keys);


    /* VALIDATE INPUTS */

    try {

      validateForm(keys, updatedValues);

    } catch (error) {

      showMessage(
        error.message,
        "error"
      );

      return;

    }

    let writeAttempted = false;

    setBusy(true);

    setStatus("Saving...");

    try {

      /* GET LATEST SAVED SETTINGS */

      const latest = await requestSettings();

      if (!isValidObject(latest.settings)) {

        throw new Error(
          "Cannot read the current saved settings."
        );

      }


      /* PRESERVE EXISTING SYSTEM SETTINGS */

      const payload = Object.fromEntries(

        ALLOWED_FIELDS

          .filter(key =>

            Object.prototype.hasOwnProperty.call(
              latest.settings,
              key
            )

          )

          .map(key => [

            key,
            latest.settings[key]

          ])

      );


      /* APPLY UPDATED ACCOUNT VALUES */

      Object.assign(
        payload,
        updatedValues
      );


      /* SAVE TO BACKEND */

      writeAttempted = true;

      await requestSettings(
        "PUT",
        payload
      );


      /* VERIFY SAVED SETTINGS */

      const verified = await requestSettings();

      if (!isValidObject(verified.settings)) {

        throw new Error(
          "Saved settings could not be verified."
        );

      }

      const matches = keys.every(key => {

        return (

          Object.prototype.hasOwnProperty.call(
            verified.settings,
            key
          ) &&

          normalizeValue(
            key,
            verified.settings[key]
          ) ===

          normalizeValue(
            key,
            updatedValues[key]
          )

        );

      });

      if (!matches) {

        throw new Error(
          "The saved information does not match your changes."
        );

      }


      /* UPDATE APPLICATION STATE */

      savedSettings = verified.settings;

      hasUnsavedChanges = false;
      saveUnconfirmed = false;

      fillForm();

      setStatus(
        "Settings saved",
        "success"
      );

      showMessage(
        "Your settings have been saved successfully.",
        "success"
      );


      /* SETTINGS UPDATE EVENT */

      window.dispatchEvent(

        new CustomEvent("jcn:settings-saved", {

          detail: {
            ...savedSettings
          }

        })

      );


      /* SWEETALERT SUCCESS MESSAGE */

      if (window.Swal) {

        Swal.fire({

          icon: "success",

          title: "Settings Saved",

          text:
            "Your changes have been saved successfully.",

          confirmButtonText: "Okay",

          confirmButtonColor: "#f4c542",

          background: "var(--panel-bg)",

          color: "var(--text)"

        });

      }

    } catch (error) {

      console.error(
        "Save settings error:",
        error
      );

      if (writeAttempted) {

        saveUnconfirmed = true;

        setStatus(
          "Save not confirmed",
          "error"
        );

        showMessage(

          error.message +
          " Return to account and reload before retrying.",

          "error"

        );

      } else {

        setStatus(
          "Save failed",
          "error"
        );

        showMessage(
          error.message,
          "error"
        );

      }

    } finally {

      setBusy(false);

    }

  }


  /* =========================================
     14. GLOBAL ADMIN THEME PREFERENCES
  ========================================= */

  function setupTheme() {

    const themeSelect = $("accountTheme");

    const themeButtons =
      document.querySelectorAll(
        ".theme-option[data-theme-value]"
      );

    if (!themeSelect) return;


    /* -------------------------------------
       GET SAVED THEME
    ------------------------------------- */

    function getTheme() {

      try {

        return localStorage.getItem(THEME_KEY) === "light"
          ? "light"
          : "dark";

      } catch {

        return "dark";

      }

    }


    /* -------------------------------------
       UPDATE ACTIVE THEME BUTTON
    ------------------------------------- */

    function updateThemeButtons(theme) {

      themeButtons.forEach(button => {

        const isActive =
          button.dataset.themeValue === theme;

        button.classList.toggle(
          "active",
          isActive
        );

        button.setAttribute(
          "aria-pressed",
          String(isActive)
        );

      });

      themeSelect.value = theme;

    }


    /* -------------------------------------
       APPLY SELECTED THEME
    ------------------------------------- */

    function applyTheme(value) {

      const theme = value === "light"
        ? "light"
        : "dark";

      // Connect to the Global Admin Theme.

      if (window.JCNAdminTheme) {

        window.JCNAdminTheme.applyTheme(theme);

      }

      // Local fallback.

      document.documentElement.setAttribute(
        "data-account-theme",
        theme
      );

      updateThemeButtons(theme);

    }


    /* -------------------------------------
       CHANGE AND SAVE THEME
    ------------------------------------- */

    function changeTheme(value) {

      const theme = value === "light"
        ? "light"
        : "dark";

      try {

        if (window.JCNAdminTheme) {

          window.JCNAdminTheme.setTheme(theme);

        } else {

          localStorage.setItem(
            THEME_KEY,
            theme
          );

        }

        applyTheme(theme);

        showMessage(

          `${theme === "light" ? "Light" : "Dark"} mode activated.`,

          "success"

        );

      } catch (error) {

        applyTheme(getTheme());

        showMessage(
          "Unable to save theme preference.",
          "error"
        );

        console.error(
          "Theme error:",
          error
        );

      }

    }


    /* -------------------------------------
       LOAD SAVED THEME
    ------------------------------------- */

    const savedTheme = getTheme();

    applyTheme(savedTheme);


    /* -------------------------------------
       DARK AND LIGHT MODE BUTTONS
    ------------------------------------- */

    themeButtons.forEach(button => {

      button.addEventListener("click", () => {

        changeTheme(
          button.dataset.themeValue
        );

      });

    });


    /* -------------------------------------
       DROPDOWN COMPATIBILITY
    ------------------------------------- */

    themeSelect.addEventListener("change", () => {

      changeTheme(themeSelect.value);

    });


    /* -------------------------------------
       SYNCHRONIZE THEME BETWEEN TABS
    ------------------------------------- */

    window.addEventListener("storage", event => {

      if (
        event.key === THEME_KEY ||
        event.key === null
      ) {

        applyTheme(getTheme());

      }

    });

  }


  /* =========================================
     15. ADMIN LOGOUT MODAL
  ========================================= */

  function setupLogout() {

    const overlay = $("adminLogoutModal");

    const openButton = $("adminLogoutBtn");

    const confirmButton = $("adminConfirmLogout");

    const cancelButton = $("adminCancelLogout");

    const page = document.querySelector(
      "body.dashboard-body > .container-fluid"
    );

    let previousOverflow = "";

    let previousInert = false;


    /* -------------------------------------
       OPEN LOGOUT MODAL
    ------------------------------------- */

    function openModal() {

      if (overlay.classList.contains("show")) {
        return;
      }

      previousOverflow =
        document.body.style.overflow;

      previousInert = page
        ? page.inert
        : false;

      overlay.classList.add("show");

      overlay.setAttribute(
        "aria-hidden",
        "false"
      );

      document.body.style.overflow = "hidden";

      if (page) {
        page.inert = true;
      }

      cancelButton.focus();

    }


    /* -------------------------------------
       CLOSE LOGOUT MODAL
    ------------------------------------- */

    function closeModal() {

      if (page) {
        page.inert = previousInert;
      }

      document.body.style.overflow =
        previousOverflow;

      overlay.classList.remove("show");

      overlay.setAttribute(
        "aria-hidden",
        "true"
      );

      openButton.focus();

    }


    /* -------------------------------------
       LOGOUT BUTTON EVENTS
    ------------------------------------- */

    openButton.addEventListener(
      "click",
      openModal
    );

    cancelButton.addEventListener(
      "click",
      closeModal
    );


    /* -------------------------------------
       CLOSE MODAL ON OUTSIDE CLICK
    ------------------------------------- */

    overlay.addEventListener("click", event => {

      if (event.target === overlay) {

        closeModal();

      }

    });


    /* -------------------------------------
       KEYBOARD ACCESSIBILITY
    ------------------------------------- */

    overlay.addEventListener("keydown", event => {

      // Escape key.

      if (event.key === "Escape") {

        event.preventDefault();

        closeModal();

        return;

      }

      // Keyboard focus trap.

      if (event.key !== "Tab") return;

      if (

        event.shiftKey &&
        document.activeElement === confirmButton

      ) {

        event.preventDefault();

        cancelButton.focus();

      } else if (

        !event.shiftKey &&
        document.activeElement === cancelButton

      ) {

        event.preventDefault();

        confirmButton.focus();

      }

    });


    /* -------------------------------------
       CONFIRM ADMIN LOGOUT
    ------------------------------------- */

    confirmButton.addEventListener("click", () => {

      if (isBusy) {

        closeModal();

        showMessage(
          "Please finish the current operation before logging out."
        );

        return;

      }


      /* CHECK UNSAVED SETTINGS */

      if (

        (
          hasUnsavedChanges ||
          saveUnconfirmed
        ) &&

        !window.confirm(
          "Log out and discard your current edits?"
        )

      ) {

        return;

      }


      /* CLEAR ADMIN SESSION */

      try {

        localStorage.removeItem("adminToken");

        localStorage.removeItem("adminUser");

        // Keep the selected theme after logout.
        // Do not remove THEME_KEY.

      } catch {

        closeModal();

        showMessage(
          "Unable to clear your local session.",
          "error"
        );

        return;

      }


      /* RESET APPLICATION STATE */

      hasUnsavedChanges = false;

      saveUnconfirmed = false;


      /* REDIRECT TO ADMIN LOGIN */

      window.location.replace(LOGIN_URL);

    });

  }


  /* =========================================
     16. ACCOUNT EVENT LISTENERS
  ========================================= */

  function setupEvents() {

    /* OPEN ACCOUNT SECTIONS */

    document.querySelectorAll("[data-open]")
      .forEach(button => {

        button.addEventListener("click", () => {

          openPanel(button.dataset.open);

        });

      });


    /* BACK TO ACCOUNT MENU */

    document.querySelectorAll("[data-back]")
      .forEach(button => {

        button.addEventListener("click", () => {

          openPanel();

        });

      });


    /* RELOAD ACCOUNT */

    $("reloadAccount").addEventListener(
      "click",
      loadSettings
    );


    /* PERSONAL INFORMATION FORM */

    $("profileForm").addEventListener(

      "submit",

      event => saveGroup(
        event,
        PROFILE_KEYS
      )

    );


    /* ACCOUNT SECURITY FORM */

    $("securityForm").addEventListener(

      "submit",

      event => saveGroup(
        event,
        SECURITY_KEYS
      )

    );


    /* DETECT UNSAVED CHANGES */

    for (const id of [

      "profileForm",
      "securityForm"

    ]) {

      $(id).addEventListener(
        "input",
        updateDirtyState
      );

      $(id).addEventListener(
        "change",
        updateDirtyState
      );

    }


    /* PREVENT ACCIDENTAL PAGE EXIT */

    window.addEventListener("beforeunload", event => {

      if (

        hasUnsavedChanges ||
        isBusy ||
        saveUnconfirmed

      ) {

        event.preventDefault();

        event.returnValue = "";

      }

    });

  }


  /* =========================================
     17. INITIALIZE ADMIN ACCOUNT SETTINGS
  ========================================= */

  function init() {

    const requiredIds = [

      // Account Home
      "accountHome",
      "settingsMessage",
      "settingsStatus",
      "reloadAccount",

      // Account Sections
      "panel-profile",
      "panel-password",
      "panel-security",
      "panel-activity",
      "panel-preferences",

      // Profile Form
      "profileForm",
      "profileFields",
      "profileSave",

      // Security Form
      "securityForm",
      "securityFields",
      "securitySave",

      // Theme Preferences
      "accountTheme",

      // Logout Modal
      "adminLogoutBtn",
      "adminLogoutModal",
      "adminConfirmLogout",
      "adminCancelLogout",

      // Settings Fields
      ...PROFILE_KEYS,
      ...SECURITY_KEYS

    ];


    /* VALIDATE REQUIRED HTML ELEMENTS */

    const missing = requiredIds.filter(id => !$(id));

    if (missing.length > 0) {

      console.error(
        "Missing settings HTML elements:",
        missing
      );

      if ($("settingsMessage")) {

        showMessage(

          "Settings HTML is incomplete. Missing: " +
          missing.join(", "),

          "error"

        );

      }

      return;

    }


    /* INITIALIZE FEATURES */

    setupTheme();

    setupLogout();

    setupEvents();


    /* LOAD SAVED ACCOUNT INFORMATION */

    loadSettings();

  }


  /* =========================================
     18. DOM READY
  ========================================= */

  if (document.readyState === "loading") {

    document.addEventListener(

      "DOMContentLoaded",

      init,

      { once: true }

    );

  } else {

    init();

  }

})();