/* ==========================================================
   JCN APPAREL PRINTING SERVICES
   ADMIN ACCOUNT SETTINGS
   WITH GLOBAL DARK / LIGHT THEME INTEGRATION
========================================================== */

(() => {

  /* ==========================================================
     01. API AND THEME CONFIGURATION
  ========================================================== */

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
  const DEFAULT_THEME = "dark";

  const $ = id => document.getElementById(id);


  /* ==========================================================
     02. SETTINGS FIELDS
  ========================================================== */

  const PROFILE_KEYS = [
    "admin_name",
    "admin_username",
    "admin_email"
  ];

  const SECURITY_KEYS = [
    "session_timeout",
    "strong_password_required"
  ];

  const ACCOUNT_KEYS = [
    ...PROFILE_KEYS,
    ...SECURITY_KEYS
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


  /* ==========================================================
     03. APPLICATION STATE
  ========================================================== */

  let savedSettings = null;
  let isBusy = false;
  let accessBlocked = false;
  let hasUnsavedChanges = false;
  let saveUnconfirmed = false;
  let themeInitialized = false;


  /* ==========================================================
     04. UTILITY FUNCTIONS
  ========================================================== */

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

    if (!messageBox) return;

    messageBox.textContent = message;

    messageBox.className =
      `settings-message ${type}`;

  }

  function hideMessage() {

    const messageBox = $("settingsMessage");

    if (!messageBox) return;

    messageBox.textContent = "";

    messageBox.className =
      "settings-message d-none";

  }

  function setStatus(message, type = "") {

    const status = $("settingsStatus");

    if (!status) return;

    status.textContent = message;

    status.className =
      `settings-status ${type}`.trim();

  }


  /* ==========================================================
     05. LOADING AND FORM STATE
  ========================================================== */

  function setBusy(value) {

    isBusy = value;

    const disabled =
      value ||
      !savedSettings ||
      accessBlocked ||
      saveUnconfirmed;

    for (const group of ["profile", "security"]) {

      const fields = $(group + "Fields");
      const saveButton = $(group + "Save");

      if (fields) {
        fields.disabled = disabled;
      }

      if (saveButton) {
        saveButton.disabled = disabled;
      }

    }

    if ($("reloadAccount")) {
      $("reloadAccount").disabled = value;
    }

    $("profileForm")?.setAttribute(
      "aria-busy",
      String(value)
    );

    $("securityForm")?.setAttribute(
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


  /* ==========================================================
     06. FILL SAVED ACCOUNT INFORMATION
  ========================================================== */

  function fillForm() {

    if (!savedSettings) return;

    for (const key of ACCOUNT_KEYS) {

      const field = $(key);

      if (!field) continue;

      if (key === "strong_password_required") {

        field.checked =
          toBoolean(savedSettings[key]);

      } else {

        field.value =
          savedSettings[key] ?? "";

      }

    }

  }


  /* ==========================================================
     07. READ FORM VALUES
  ========================================================== */

  function readForm(keys) {

    const values = {};

    for (const key of keys) {

      const field = $(key);

      if (!field) continue;

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


  /* ==========================================================
     08. UNSAVED CHANGES
  ========================================================== */

  function updateDirtyState() {

    if (!savedSettings) return;

    const currentValues = readForm(ACCOUNT_KEYS);

    hasUnsavedChanges = ACCOUNT_KEYS.some(key => {

      return (
        normalizeValue(key, currentValues[key]) !==
        normalizeValue(key, savedSettings[key])
      );

    });

    if (saveUnconfirmed) {

      setStatus("Save not confirmed", "error");

    } else if (hasUnsavedChanges) {

      setStatus("Unsaved changes");

    } else {

      setStatus("Settings loaded", "success");

    }

  }


  /* ==========================================================
     09. ACCOUNT SECTION NAVIGATION
  ========================================================== */

  function openPanel(key = null) {

    // Preferences can open while the API is loading.

    if (
      isBusy &&
      key !== null &&
      key !== "preferences"
    ) {
      return;
    }

    const selectedPanel = key
      ? $("panel-" + key)
      : null;

    if (key && !selectedPanel) return;


    /* CHECK UNSAVED ACCOUNT CHANGES */

    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved changes?")
    ) {
      return;
    }

    hasUnsavedChanges = false;

    fillForm();

    hideMessage();


    /* SHOW OR HIDE ACCOUNT HOME */

    $("accountHome").hidden = Boolean(key);


    /* SHOW SELECTED PANEL */

    document.querySelectorAll(".account-section")
      .forEach(panel => {

        panel.hidden = panel !== selectedPanel;

      });


    /* REFRESH THEME WHEN OPENING PREFERENCES */

    if (key === "preferences") {

      refreshTheme();

    } else if (!isBusy) {

      if (saveUnconfirmed) {

        showMessage(
          "The previous save could not be verified. " +
          "Reload your account before making changes.",
          "error"
        );

      } else if (accessBlocked) {

        showMessage(
          "Account access is unavailable. Please log in again.",
          "error"
        );

      } else if (!savedSettings) {

        showMessage(
          "Account settings are unavailable. " +
          "Return to account and reload.",
          "error"
        );

      } else {

        setStatus("Settings loaded", "success");

      }

    }


    /* ACCESSIBILITY FOCUS */

    if (selectedPanel) {

      selectedPanel.querySelector("h2")?.focus();

    } else {

      document.querySelector("[data-open]")?.focus();

    }

  }


  /* ==========================================================
     10. SETTINGS API REQUEST
  ========================================================== */

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


      /* VALIDATE SERVER RESPONSE */

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
          "Request timed out. " +
          "Reload the account before trying again."
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


  /* ==========================================================
     11. LOAD ADMIN ACCOUNT SETTINGS
  ========================================================== */

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


      /* UPDATE APPLICATION STATE */

      savedSettings = data.settings;

      accessBlocked = false;
      saveUnconfirmed = false;
      hasUnsavedChanges = false;

      fillForm();

      setStatus("Settings loaded", "success");

    } catch (error) {

      savedSettings = null;

      setStatus("Connection failed", "error");


      // Do not overwrite the theme notification
      // while the Preferences panel is open.

      const preferences = $("panel-preferences");

      if (!preferences || preferences.hidden) {

        showMessage(error.message, "error");

      }

      console.error(
        "Load settings error:",
        error
      );

    } finally {

      setBusy(false);

    }

  }


  /* ==========================================================
     12. FORM VALIDATION
  ========================================================== */

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


  /* ==========================================================
     13. SAVE ADMIN SETTINGS
  ========================================================== */

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

      showMessage(error.message, "error");

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


      /* PRESERVE EXISTING SYSTEM CONFIGURATIONS */

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

      Object.assign(payload, updatedValues);


      /* SAVE TO BACKEND */

      writeAttempted = true;

      await requestSettings("PUT", payload);


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

      setStatus("Settings saved", "success");

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

        setStatus("Save failed", "error");

        showMessage(error.message, "error");

      }

    } finally {

      setBusy(false);

    }

  }


  /* ==========================================================
     14. GLOBAL ADMIN THEME CONFIGURATION

     Compatible with admin-theme.js.
     Uses the same LocalStorage key across Admin modules.
  ========================================================== */

  function normalizeTheme(value) {

    return value === "light" || value === "dark"
      ? value
      : DEFAULT_THEME;

  }

  function getSavedTheme() {

    try {

      return normalizeTheme(
        localStorage.getItem(THEME_KEY)
      );

    } catch (error) {

      console.warn(
        "[JCN Theme] Unable to retrieve saved theme:",
        error
      );

      return DEFAULT_THEME;

    }

  }


  /* ==========================================================
     15. UPDATE THEME BUTTONS
  ========================================================== */

  function updateThemeButtons(value) {

    const theme = normalizeTheme(value);

    const buttons = document.querySelectorAll(
      "#panel-preferences .theme-option[data-theme-value]"
    );

    buttons.forEach(button => {

      const isActive =
        button.dataset.themeValue === theme;


      /* ENABLE THEME BUTTONS */

      button.disabled = false;

      button.removeAttribute("disabled");

      button.removeAttribute("aria-disabled");


      /* UPDATE SELECTED THEME */

      button.classList.toggle(
        "active",
        isActive
      );

      button.setAttribute(
        "aria-pressed",
        String(isActive)
      );

    });


    /* UPDATE HIDDEN SELECT */

    const select = $("accountTheme");

    if (select) {

      select.disabled = false;

      select.value = theme;

    }


    /* OPTIONAL SLIDING SWITCH */

    document.querySelectorAll(
      ".jcn-admin-theme-switch"
    ).forEach(button => {

      button.disabled = false;

      button.setAttribute("role", "switch");

      button.setAttribute(
        "aria-checked",
        String(theme === "light")
      );

      button.setAttribute(
        "aria-label",
        theme === "light"
          ? "Switch to Dark Mode"
          : "Switch to Light Mode"
      );

    });


    /* CURRENT THEME LABEL */

    document.querySelectorAll(
      "[data-jcn-admin-current-theme]"
    ).forEach(element => {

      element.textContent =
        theme === "light"
          ? "Light Mode"
          : "Dark Mode";

    });

  }


  /* ==========================================================
     16. APPLY ADMIN THEME

     Supports existing Admin CSS and Bootstrap.
  ========================================================== */

  function applyTheme(value) {

    const theme = normalizeTheme(value);

    const root = document.documentElement;


    /* CUSTOMER-STYLE ATTRIBUTE */

    root.setAttribute(
      "data-theme",
      theme
    );


    /* EXISTING ADMIN THEME ATTRIBUTE */

    root.setAttribute(
      "data-account-theme",
      theme
    );


    /* BOOTSTRAP THEME SUPPORT */

    root.setAttribute(
      "data-bs-theme",
      theme
    );


    /* BROWSER COLOR SCHEME */

    root.style.colorScheme = theme;


    /* UPDATE PREFERENCES BUTTONS */

    updateThemeButtons(theme);

    return theme;

  }


  /* ==========================================================
     17. REFRESH SAVED THEME
  ========================================================== */

  function refreshTheme() {

    const theme = getSavedTheme();

    const controller = window.JCNAdminTheme;

    try {

      if (
        typeof controller?.applyTheme === "function"
      ) {

        controller.applyTheme(theme);

      }

    } catch (error) {

      console.warn(
        "[JCN Theme] Controller refresh failed:",
        error
      );

    }

    return applyTheme(theme);

  }


  /* ==========================================================
     18. SAVE AND CHANGE ADMIN THEME
  ========================================================== */

  function changeTheme(value) {

    if (!["dark", "light"].includes(value)) {
      return;
    }

    const theme = normalizeTheme(value);

    try {

      const controller = window.JCNAdminTheme;

      let usingGlobalController = false;


      /* CONNECT TO GLOBAL ADMIN THEME */

      if (
        typeof controller?.setTheme === "function"
      ) {

        controller.setTheme(theme);

        usingGlobalController = true;

      } else if (
        typeof controller?.set === "function"
      ) {

        controller.set(theme);

        usingGlobalController = true;

      } else {

        /* FALLBACK WHEN GLOBAL JS IS UNAVAILABLE */

        localStorage.setItem(
          THEME_KEY,
          theme
        );

        console.warn(
          "[JCN Theme] Global controller unavailable. " +
          "Using Settings theme fallback."
        );

      }


      /* APPLY THEME TO CURRENT PAGE */

      applyTheme(theme);


      /* NOTIFY OTHER COMPONENTS WHEN USING FALLBACK */

      if (!usingGlobalController) {

        document.dispatchEvent(

          new CustomEvent(
            "jcn:admin-themechange",
            {
              detail: { theme }
            }
          )

        );

        window.dispatchEvent(

          new CustomEvent(
            "jcn:admin-theme-changed",
            {
              detail: { theme }
            }
          )

        );

      }


      /* SUCCESS NOTIFICATION */

      const themeName =
        theme === "light"
          ? "Light Mode"
          : "Dark Mode";

      if (usingGlobalController) {

        showMessage(
          `${themeName} activated.`,
          "success"
        );

      } else {

        showMessage(
          `${themeName} preference saved. ` +
          "Global theme files must be connected to all modules.",
          "info"
        );

      }

      console.log(
        "[JCN Theme] Selected theme:",
        theme
      );

      console.log(
        "[JCN Theme] Saved preference:",
        localStorage.getItem(THEME_KEY)
      );

    } catch (error) {

      refreshTheme();

      showMessage(
        "Unable to save theme preference.",
        "error"
      );

      console.error(
        "[JCN Theme] Save error:",
        error
      );

    }

  }


  /* ==========================================================
     19. INITIALIZE THEME PREFERENCES

     Direct button events ensure the theme cards
     are connected to the Settings page.
  ========================================================== */

  function setupTheme() {

    if (themeInitialized) return;

    const panel = $("panel-preferences");

    if (!panel) return;

    themeInitialized = true;


    /* DARK MODE AND LIGHT MODE BUTTONS */

    const themeButtons = panel.querySelectorAll(
      ".theme-option[data-theme-value]"
    );

    themeButtons.forEach(button => {

      button.disabled = false;

      button.removeAttribute("disabled");

      button.removeAttribute("aria-disabled");

      button.addEventListener("click", event => {

        event.preventDefault();

        // Prevent duplicate handling by the delegated
        // click listener inside admin-theme.js.

        event.stopPropagation();

        changeTheme(
          button.dataset.themeValue
        );

      });

    });


    /* HIDDEN THEME SELECT */

    const themeSelect = $("accountTheme");

    if (themeSelect) {

      themeSelect.disabled = false;

      themeSelect.addEventListener(
        "change",
        event => {

          event.stopPropagation();

          changeTheme(themeSelect.value);

        }
      );

    }


    /* OPTIONAL CUSTOMER-STYLE SWITCH */

    panel.querySelectorAll(
      "[data-jcn-admin-theme-toggle]"
    ).forEach(button => {

      button.disabled = false;

      button.addEventListener("click", event => {

        event.preventDefault();

        event.stopPropagation();

        const nextTheme =
          getSavedTheme() === "dark"
            ? "light"
            : "dark";

        changeTheme(nextTheme);

      });

    });


    /* LOAD SAVED THEME */

    refreshTheme();


    /* SYNCHRONIZE BROWSER TABS */

    window.addEventListener("storage", event => {

      if (
        event.key === THEME_KEY ||
        event.key === null
      ) {

        refreshTheme();

      }

    });


    /* RESTORE THEME WHEN RETURNING TO PAGE */

    window.addEventListener("pageshow", () => {

      refreshTheme();

    });


    /* UPDATE BUTTONS WHEN GLOBAL THEME CHANGES */

    window.addEventListener(
      "jcn:admin-theme-changed",
      event => {

        const theme = event.detail?.theme;

        if (["dark", "light"].includes(theme)) {

          applyTheme(theme);

        }

      }
    );


    /* DEBUG INFORMATION */

    console.log(
      "[JCN Settings] Theme buttons connected:",
      themeButtons.length
    );

    console.log(
      "[JCN Settings] Global theme controller:",
      typeof window.JCNAdminTheme
    );

    console.log(
      "[JCN Settings] Current theme:",
      getSavedTheme()
    );

  }


  /* ==========================================================
     20. ADMIN LOGOUT MODAL
  ========================================================== */

  function setupLogout() {

    const overlay = $("adminLogoutModal");

    const openButton = $("adminLogoutBtn");

    const confirmButton = $("adminConfirmLogout");

    const cancelButton = $("adminCancelLogout");

    const page = document.querySelector(
      "body.dashboard-body > .container-fluid"
    );

    if (
      !overlay ||
      !openButton ||
      !confirmButton ||
      !cancelButton
    ) {
      return;
    }

    let previousOverflow = "";
    let previousInert = false;


    /* OPEN LOGOUT MODAL */

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


    /* CLOSE LOGOUT MODAL */

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


    /* LOGOUT BUTTON EVENTS */

    openButton.addEventListener(
      "click",
      openModal
    );

    cancelButton.addEventListener(
      "click",
      closeModal
    );


    /* CLOSE MODAL ON OUTSIDE CLICK */

    overlay.addEventListener("click", event => {

      if (event.target === overlay) {

        closeModal();

      }

    });


    /* KEYBOARD ACCESSIBILITY */

    overlay.addEventListener("keydown", event => {

      if (event.key === "Escape") {

        event.preventDefault();

        closeModal();

        return;

      }

      if (event.key !== "Tab") return;


      /* FOCUS TRAP */

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


    /* CONFIRM ADMIN LOGOUT */

    confirmButton.addEventListener("click", () => {

      if (isBusy) {

        closeModal();

        showMessage(
          "Please finish the current operation before logging out."
        );

        return;

      }


      /* CHECK UNSAVED CHANGES */

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


      /* REMOVE ADMIN SESSION ONLY */

      try {

        localStorage.removeItem("adminToken");

        localStorage.removeItem("adminUser");

        /*
          IMPORTANT:
          Do not use localStorage.clear().

          Keep jcnAdminAccountTheme saved.
          Customer preferences must also remain unchanged.
        */

      } catch (error) {

        closeModal();

        showMessage(
          "Unable to clear your local session.",
          "error"
        );

        console.error(error);

        return;

      }


      /* RESET APPLICATION STATE */

      hasUnsavedChanges = false;

      saveUnconfirmed = false;


      /* REDIRECT TO ADMIN LOGIN */

      window.location.replace(LOGIN_URL);

    });

  }


  /* ==========================================================
     21. ACCOUNT EVENT LISTENERS
  ========================================================== */

  function setupEvents() {

    /* OPEN ACCOUNT SECTIONS */

    document.querySelectorAll("[data-open]")
      .forEach(button => {

        button.addEventListener("click", () => {

          openPanel(
            button.dataset.open
          );

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


  if (!hasUnsavedChanges) return;

  event.preventDefault();
  event.returnValue = "";

});

}


  /* ==========================================================
     22. INITIALIZE ADMIN ACCOUNT SETTINGS
  ========================================================== */

  function init() {

    /* INITIALIZE THEME FIRST */

    setupTheme();


    /* REQUIRED HTML ELEMENTS */

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

      // Logout Modal
      "adminLogoutBtn",
      "adminLogoutModal",
      "adminConfirmLogout",
      "adminCancelLogout",

      // Account Fields
      ...ACCOUNT_KEYS

    ];


    /* VALIDATE REQUIRED ELEMENTS */

    const missing = requiredIds.filter(
      id => !$(id)
    );

    if (missing.length > 0) {

      console.error(
        "Missing settings HTML elements:",
        missing
      );

      showMessage(
        "Settings HTML is incomplete. Missing: " +
        missing.join(", "),
        "error"
      );

      return;

    }


    /* INITIALIZE LOGOUT */

    setupLogout();


    /* INITIALIZE ACCOUNT EVENTS */

    setupEvents();


    /* LOAD ACCOUNT SETTINGS */

    loadSettings();

    console.log(
      "[JCN Settings] Successfully initialized."
    );

  }


  /* ==========================================================
     23. DOM READY
  ========================================================== */

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