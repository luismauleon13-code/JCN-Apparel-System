(() => {
  "use strict";

  const SETTINGS_API =
    window.JCN_SETTINGS_API ||
    "http://localhost:5000/api/admin/settings";

  const LOGIN_URL = "admin-login.html";

  const DEFAULT_SETTINGS = Object.freeze({
    shop_name: "JCN Apparel Printing Services",
    shop_email: "",
    shop_phone: "",
    shop_address: "",
    business_hours: "Monday - Saturday, 8:00 AM - 6:00 PM",

    admin_name: "",
    admin_username: "",
    admin_email: "",

    delivery_fee: 80,
    free_shipping_min: 1500,
    delivery_days: 3,

    paypal_client_id: "",
    paypal_mode: "Sandbox",

    email_order_confirmation: true,
    email_tracking_updates: true,
    email_delivery_updates: true,

    ai_enabled: true,
    ai_style: "Friendly",
    ai_design_suggestions: true,

    announcement_title: "",
    announcement_message: "",
    announcement_enabled: false,

    session_timeout: 30,
    strong_password_required: true
  });

  const NUMBER_MINIMUMS = {
    delivery_fee: 0,
    free_shipping_min: 0,
    delivery_days: 1,
    session_timeout: 1
  };

  const SELECT_OPTIONS = {
    paypal_mode: ["Sandbox", "Live"],
    ai_style: ["Friendly", "Professional", "Creative"]
  };

  const PRESERVED_FIELDS = [
    "shop_name",
    "shop_email",
    "shop_phone",
    "shop_address",
    "business_hours",
    "admin_name",
    "admin_username",
    "admin_email",
    "paypal_client_id",
    "paypal_mode"
  ];

  const keys = Object.keys(DEFAULT_SETTINGS);
  const getElement = id => document.getElementById(id);
  const owns = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key);

  let elements;
  let savedSettings = null;
  let isBusy = false;
  let hasUnsavedChanges = false;
  let saveUnconfirmed = false;
  let accessBlocked = false;

  // INITIALIZATION
  function init() {
    const requiredIds = [
      "settingsForm",
      "settingsFields",
      "settingsStatus",
      "settingsMessage",
      "saveSettingsBtn",
      "cancelSettingsBtn",
      "resetSettingsBtn",
      "backupBtn",
      "restoreBtn",
      "settingsImport",
      "adminLogoutBtn",
      "adminLogoutModal",
      "adminConfirmLogout",
      "adminCancelLogout",
      ...keys
    ];

    const missing = requiredIds.filter(id => !getElement(id));

    if (missing.length) {
      console.error("Missing Settings HTML elements:", missing);

      const message = getElement("settingsMessage");

      if (message) {
        message.className = "settings-message error";
        message.textContent =
          "Settings HTML is incomplete. Missing: " + missing.join(", ");
      }

      return;
    }

    elements = Object.fromEntries(
      requiredIds.map(id => [id, getElement(id)])
    );

    setupLogout();

    elements.settingsForm.addEventListener("submit", saveSettings);

    elements.settingsForm.addEventListener("input", handleFormChange);
    elements.settingsForm.addEventListener("change", handleFormChange);

    elements.cancelSettingsBtn.addEventListener("click", loadSettings);
    elements.resetSettingsBtn.addEventListener("click", resetPreferences);
    elements.backupBtn.addEventListener("click", exportSettings);

    elements.restoreBtn.addEventListener("click", () => {
      if (!canEdit()) return;
      elements.settingsImport.click();
    });

    elements.settingsImport.addEventListener("change", importSettings);

    window.addEventListener("beforeunload", event => {
      if (!hasUnsavedChanges && !saveUnconfirmed && !isBusy) return;

      event.preventDefault();
      event.returnValue = "";
    });

    loadSettings();
  }

  // MESSAGES AND STATE
  function showMessage(message, type = "info") {
    elements.settingsMessage.textContent = message;
    elements.settingsMessage.className = `settings-message ${type}`;
  }

  function hideMessage() {
    elements.settingsMessage.textContent = "";
    elements.settingsMessage.className = "settings-message d-none";
  }

  function setStatus(message, type = "") {
    elements.settingsStatus.textContent = message;
    elements.settingsStatus.className =
      `settings-status ${type}`.trim();
  }

  function setBusy(value) {
    isBusy = value;

    const disabled = value || !savedSettings || accessBlocked;

    elements.settingsFields.disabled = disabled;
    elements.saveSettingsBtn.disabled = disabled;
    elements.cancelSettingsBtn.disabled = value;

    // Export must reflect a confirmed saved snapshot.
    elements.backupBtn.disabled = disabled || saveUnconfirmed;

    elements.settingsForm.setAttribute("aria-busy", String(value));
  }

  function canEdit() {
    return !isBusy && Boolean(savedSettings) && !accessBlocked;
  }

  function readForm() {
    const values = {};

    for (const key of keys) {
      values[key] =
        typeof DEFAULT_SETTINGS[key] === "boolean"
          ? elements[key].checked
          : elements[key].value.trim();
    }

    return values;
  }

  function fillForm(settings) {
    for (const key of keys) {
      if (typeof DEFAULT_SETTINGS[key] === "boolean") {
        elements[key].checked = settings[key];
      } else {
        elements[key].value = settings[key];
      }
    }
  }

  function updateDirtyState() {
    if (!savedSettings) return;

    try {
      const draft = normalizeSettings(readForm(), true);

      hasUnsavedChanges = keys.some(
        key => draft[key] !== savedSettings[key]
      );
    } catch {
      hasUnsavedChanges = true;
    }

    if (saveUnconfirmed) {
      setStatus("Save not confirmed", "error");
    } else if (hasUnsavedChanges) {
      setStatus("Unsaved changes");
    } else {
      setStatus("No unsaved changes", "success");
    }
  }

  function handleFormChange(event) {
    // File selection is handled separately.
    if (!keys.includes(event.target.id) || !canEdit()) return;

    updateDirtyState();
  }

  // VALIDATION
  function normalizeSettings(raw, requireAll = false) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Invalid settings data.");
    }

    const result = {};

    for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
      const present = owns(raw, key);

      if (requireAll && (!present || raw[key] == null)) {
        throw new Error(`Missing setting: ${key}.`);
      }

      const value = present && raw[key] != null ? raw[key] : fallback;
      const label = key.replaceAll("_", " ");

      if (typeof fallback === "boolean") {
        const accepted = [
          true, false, 1, 0, "true", "false", "1", "0"
        ];

        if (!accepted.includes(value)) {
          throw new Error(`Invalid value for ${label}.`);
        }

        result[key] =
          value === true ||
          value === 1 ||
          value === "true" ||
          value === "1";

        continue;
      }

      if (owns(NUMBER_MINIMUMS, key)) {
        if (
          !["number", "string"].includes(typeof value) ||
          String(value).trim() === ""
        ) {
          throw new Error(`Enter a number for ${label}.`);
        }

        const number = Number(value);
        const integerRequired =
          key === "delivery_days" || key === "session_timeout";

        if (
          !Number.isFinite(number) ||
          number < NUMBER_MINIMUMS[key] ||
          number > Number.MAX_SAFE_INTEGER ||
          (integerRequired && !Number.isSafeInteger(number))
        ) {
          throw new Error(
            `Invalid ${label}. Minimum: ${NUMBER_MINIMUMS[key]}.` +
            (integerRequired ? " Use a whole number." : "")
          );
        }

        result[key] = number;
        continue;
      }

      if (typeof value !== "string") {
        throw new Error(`Invalid text for ${label}.`);
      }

      result[key] = value.trim();

      if (
        owns(SELECT_OPTIONS, key) &&
        !SELECT_OPTIONS[key].includes(result[key])
      ) {
        throw new Error(`Invalid option for ${label}.`);
      }
    }

    return result;
  }

  function validateForSave(settings) {
    for (const key of [
      "shop_name",
      "shop_email",
      "admin_username",
      "admin_email"
    ]) {
      if (!settings[key]) {
        elements[key].focus();

        throw new Error(
          `Please enter ${key.replaceAll("_", " ")}.`
        );
      }
    }

    if (
      settings.announcement_enabled &&
      (!settings.announcement_title || !settings.announcement_message)
    ) {
      throw new Error(
        "Enter an announcement title and message before enabling it."
      );
    }
  }

  // API
  async function requestSettings(method = "GET", payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const token = localStorage.getItem("adminToken");

      if (!token) {
        accessBlocked = true;

        throw new Error(
          "Admin login is required. Use Logout to return to the login page."
        );
      }

      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      };

      if (payload !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(SETTINGS_API, {
        method,
        headers,
        signal: controller.signal,
        cache: "no-store",
        ...(payload !== undefined
          ? { body: JSON.stringify(payload) }
          : {})
      });

      if (response.status === 401) {
        accessBlocked = true;

        throw new Error(
          "Your admin session has expired. Log out and log in again."
        );
      }

      if (response.status === 403) {
        accessBlocked = true;

        throw new Error(
          "Your account does not have permission to manage settings."
        );
      }

      if (response.status === 404) {
        throw new Error(
          "Settings API not found. Check /api/admin/settings in your backend."
        );
      }

      let data;

      try {
        data = await response.json();
      } catch (error) {
        if (error.name === "AbortError") throw error;

        throw new Error(
          `The server did not return valid JSON (HTTP ${response.status}).`
        );
      }

      if (!response.ok || data?.success !== true) {
        throw new Error(
          typeof data?.message === "string"
            ? data.message
            : `Settings request failed (HTTP ${response.status}).`
        );
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(
          "Request timed out. Reload Saved to check the server before retrying."
        );
      }

      if (error instanceof TypeError) {
        throw new Error(
          "Cannot reach the backend. Check the server address, connection, and CORS configuration."
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // LOAD
  async function loadSettings() {
    if (isBusy) return;

    if (
      (hasUnsavedChanges || saveUnconfirmed) &&
      !window.confirm(
        "Replace the current form with the settings saved on the server?"
      )
    ) {
      return;
    }

    setBusy(true);
    setStatus("Loading…");
    hideMessage();

    try {
      const data = await requestSettings();
      const settings = normalizeSettings(data.settings);

      fillForm(settings);
      savedSettings = { ...settings };

      accessBlocked = false;
      hasUnsavedChanges = false;
      saveUnconfirmed = false;

      setStatus("Settings loaded", "success");
    } catch (error) {
      setStatus("Load failed", "error");
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  // SAVE
  async function saveSettings(event) {
    event.preventDefault();

    if (!canEdit()) return;
    if (!elements.settingsForm.reportValidity()) return;

    let payload;

    try {
      payload = normalizeSettings(readForm(), true);
      validateForSave(payload);
    } catch (error) {
      showMessage(error.message, "error");
      return;
    }

    setBusy(true);
    setStatus("Saving…");
    hideMessage();

    try {
      const data = await requestSettings("PUT", payload);

      let confirmed = payload;

      if (data.settings != null) {
        if (
          typeof data.settings !== "object" ||
          Array.isArray(data.settings)
        ) {
          throw new Error("The server returned invalid saved settings.");
        }

        confirmed = normalizeSettings(
          { ...payload, ...data.settings },
          true
        );
      }

      savedSettings = { ...confirmed };
      fillForm(savedSettings);

      hasUnsavedChanges = false;
      saveUnconfirmed = false;

      setStatus("Settings saved", "success");
      showMessage("Settings saved successfully.", "success");

      window.dispatchEvent(
        new CustomEvent("jcn:settings-saved", {
          detail: { ...savedSettings }
        })
      );
    } catch (error) {
      // A failed connection can occur after the server has saved.
      saveUnconfirmed = true;
      hasUnsavedChanges = true;

      setStatus("Save not confirmed", "error");

      showMessage(
        `${error.message} Your edits remain on this page. ` +
        "Use Reload Saved to verify the stored settings.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  // RESET PREFERENCES
  function resetPreferences() {
    if (!canEdit()) return;

    if (
      !window.confirm(
        "Reset preferences in this form? Shop, admin, and payment " +
        "details will be kept. Click Save Changes afterward to apply."
      )
    ) {
      return;
    }

    const draft = { ...DEFAULT_SETTINGS };

    for (const key of PRESERVED_FIELDS) {
      draft[key] = elements[key].value;
    }

    fillForm(draft);
    updateDirtyState();

    showMessage(
      "Default preferences loaded for review. Click Save Changes to apply."
    );
  }

  // EXPORT CONFIRMED SAVED SETTINGS
  function exportSettings() {
    if (!canEdit()) return;

    if (saveUnconfirmed) {
      showMessage(
        "Reload Saved to confirm the stored settings before exporting.",
        "error"
      );
      return;
    }

    let url;
    let link;

    try {
      const backup = {
        type: "jcn-admin-settings",
        version: 1,
        exported_at: new Date().toISOString(),
        settings: { ...savedSettings }
      };

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json;charset=utf-8" }
      );

      url = URL.createObjectURL(blob);
      link = document.createElement("a");

      link.href = url;
      link.download =
        `jcn-settings-${new Date().toISOString().slice(0, 10)}.json`;

      document.body.appendChild(link);
      link.click();

      showMessage(
        "Settings download started. It includes the last confirmed saved " +
        "settings, without unsaved edits, orders, products, or users.",
        "success"
      );
    } catch (error) {
      showMessage(`Export failed: ${error.message}`, "error");
    } finally {
      link?.remove();

      if (url) {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }
  }

  // IMPORT INTO FORM ONLY
  async function importSettings(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !canEdit()) return;

    setBusy(true);

    try {
      if (file.size > 1024 * 1024) {
        throw new Error("Choose a settings JSON file no larger than 1 MB.");
      }

      let backup;

      try {
        backup = JSON.parse(await file.text());
      } catch {
        throw new Error("The selected file does not contain valid JSON.");
      }

      if (
        !backup ||
        typeof backup !== "object" ||
        Array.isArray(backup) ||
        backup.type !== "jcn-admin-settings" ||
        backup.version !== 1
      ) {
        throw new Error("Choose a JCN settings export with version 1.");
      }

      // Validate all fields before modifying the form.
      const draft = normalizeSettings(backup.settings, true);

      if (
        !window.confirm(
          "Load this backup into the form and replace current edits? " +
          "Nothing will be saved until you click Save Changes."
        )
      ) {
        return;
      }

      fillForm(draft);
      updateDirtyState();

      showMessage(
        "Backup loaded into the form. Review it, then click Save Changes."
      );
    } catch (error) {
      showMessage(`Import failed: ${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  // LOGOUT MODAL
  function setupLogout() {
    const overlay = elements.adminLogoutModal;
    const openButton = elements.adminLogoutBtn;
    const confirmButton = elements.adminConfirmLogout;
    const cancelButton = elements.adminCancelLogout;
    const page = document.querySelector(
      "body.dashboard-body > .container-fluid"
    );

    let previousOverflow = "";
    let previousInert = false;

    function openModal() {
      if (overlay.classList.contains("show")) return;

      previousOverflow = document.body.style.overflow;
      previousInert = page ? page.inert : false;

      overlay.classList.add("show");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      cancelButton.focus();

      if (page) page.inert = true;
    }

    function closeModal() {
      if (page) page.inert = previousInert;
      document.body.style.overflow = previousOverflow;

      openButton.focus();
      overlay.classList.remove("show");
      overlay.setAttribute("aria-hidden", "true");
    }

    openButton.addEventListener("click", openModal);
    cancelButton.addEventListener("click", closeModal);

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeModal();
    });

    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

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

    confirmButton.addEventListener("click", () => {
      if (isBusy) {
        closeModal();
        showMessage("Wait for the current operation to finish before logging out.");
        return;
      }

      if (
        (hasUnsavedChanges || saveUnconfirmed) &&
        !window.confirm("Log out and leave your current settings edits?")
      ) {
        return;
      }

      try {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
      } catch {
        closeModal();
        showMessage(
          "Unable to clear the local session. Check your browser storage settings.",
          "error"
        );
        return;
      }

      hasUnsavedChanges = false;
      saveUnconfirmed = false;
      window.location.replace(LOGIN_URL);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();