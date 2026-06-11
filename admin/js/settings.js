const SETTINGS_API = "http://localhost:5000/api/admin/settings";

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  document.getElementById("settingsForm")?.addEventListener("submit", saveSettings);
  document.getElementById("cancelSettingsBtn")?.addEventListener("click", loadSettings);
  document.getElementById("resetSettingsBtn")?.addEventListener("click", resetDefaultSettings);

  document.getElementById("backupBtn")?.addEventListener("click", () => {
    showMessage("Backup feature can be added later.", "success");
  });

  document.getElementById("restoreBtn")?.addEventListener("click", () => {
    showMessage("Restore feature can be added later.", "success");
  });
});

async function loadSettings() {
  try {
    const res = await fetch(SETTINGS_API);
    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || "Failed to load settings.", "error");
      return;
    }

    const s = data.settings;

    setValue("shop_name", s.shop_name);
    setValue("shop_email", s.shop_email);
    setValue("shop_phone", s.shop_phone);
    setValue("shop_address", s.shop_address);
    setValue("business_hours", s.business_hours);

    setValue("admin_name", s.admin_name);
    setValue("admin_username", s.admin_username);
    setValue("admin_email", s.admin_email);

    setValue("delivery_fee", s.delivery_fee);
    setValue("free_shipping_min", s.free_shipping_min);
    setValue("delivery_days", s.delivery_days);

    setValue("paypal_client_id", s.paypal_client_id);
    setValue("paypal_mode", s.paypal_mode || "Sandbox");

    setChecked("email_order_confirmation", s.email_order_confirmation);
    setChecked("email_tracking_updates", s.email_tracking_updates);
    setChecked("email_delivery_updates", s.email_delivery_updates);

    setChecked("ai_enabled", s.ai_enabled);
    setValue("ai_style", s.ai_style || "Friendly");
    setChecked("ai_design_suggestions", s.ai_design_suggestions);

    setValue("announcement_title", s.announcement_title);
    setValue("announcement_message", s.announcement_message);
    setChecked("announcement_enabled", s.announcement_enabled);

    setValue("session_timeout", s.session_timeout);
    setChecked("strong_password_required", s.strong_password_required);

  } catch (error) {
    showMessage("Cannot connect to server.", "error");
  }
}

async function saveSettings(e) {
  e.preventDefault();

  const settings = {
    shop_name: getValue("shop_name"),
    shop_email: getValue("shop_email"),
    shop_phone: getValue("shop_phone"),
    shop_address: getValue("shop_address"),
    business_hours: getValue("business_hours"),

    admin_name: getValue("admin_name"),
    admin_username: getValue("admin_username"),
    admin_email: getValue("admin_email"),

    delivery_fee: Number(getValue("delivery_fee") || 0),
    free_shipping_min: Number(getValue("free_shipping_min") || 0),
    delivery_days: Number(getValue("delivery_days") || 0),

    paypal_client_id: getValue("paypal_client_id"),
    paypal_mode: getValue("paypal_mode"),

    email_order_confirmation: getChecked("email_order_confirmation"),
    email_tracking_updates: getChecked("email_tracking_updates"),
    email_delivery_updates: getChecked("email_delivery_updates"),

    ai_enabled: getChecked("ai_enabled"),
    ai_style: getValue("ai_style"),
    ai_design_suggestions: getChecked("ai_design_suggestions"),

    announcement_title: getValue("announcement_title"),
    announcement_message: getValue("announcement_message"),
    announcement_enabled: getChecked("announcement_enabled"),

    session_timeout: Number(getValue("session_timeout") || 30),
    strong_password_required: getChecked("strong_password_required")
  };

  try {
    const res = await fetch(SETTINGS_API, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(settings)
    });

    const data = await res.json();

    if (!data.success) {
      showMessage(data.message || "Failed to save settings.", "error");
      return;
    }

    showMessage("Settings saved successfully.", "success");

  } catch (error) {
    showMessage("Cannot save settings. Check your backend server.", "error");
  }
}

function resetDefaultSettings() {
  const confirmReset = confirm("Reset settings to default?");

  if (!confirmReset) return;

  setValue("shop_name", "JCN Apparel Printing Services");
  setValue("shop_email", "jcnapparel@gmail.com");
  setValue("shop_phone", "09123456789");
  setValue("shop_address", "Quezon City, Philippines");
  setValue("business_hours", "Monday - Saturday, 8:00 AM - 6:00 PM");

  setValue("admin_name", "Admin User");
  setValue("admin_username", "admin");
  setValue("admin_email", "admin@gmail.com");

  setValue("delivery_fee", 80);
  setValue("free_shipping_min", 1500);
  setValue("delivery_days", 3);

  setValue("paypal_client_id", "");
  setValue("paypal_mode", "Sandbox");

  setChecked("email_order_confirmation", true);
  setChecked("email_tracking_updates", true);
  setChecked("email_delivery_updates", true);

  setChecked("ai_enabled", true);
  setValue("ai_style", "Friendly");
  setChecked("ai_design_suggestions", true);

  setValue("announcement_title", "");
  setValue("announcement_message", "");
  setChecked("announcement_enabled", false);

  setValue("session_timeout", 30);
  setChecked("strong_password_required", true);

  showMessage("Default settings loaded. Click Save Changes to save.", "success");
}

function getValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

function getChecked(id) {
  return document.getElementById(id)?.checked || false;
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(value);
}

function showMessage(message, type) {
  const box = document.getElementById("settingsMessage");
  if (!box) return;

  box.textContent = message;
  box.className = `settings-message ${type}`;
  box.classList.remove("d-none");

  setTimeout(() => {
    box.classList.add("d-none");
  }, 3500);
}