/* ==========================================================
   JCN APPAREL PRINTING SERVICES
   CUSTOMER DARK / LIGHT THEME
   Toggle visible ONLY where manually placed (Customer Settings).
   Saved preference applies to EVERY customer page loading this file.
========================================================== */

const JCN_THEME_KEY = "jcnCustomerTheme";
const JCN_DEFAULT_THEME = "dark";

let jcnCurrentTheme = JCN_DEFAULT_THEME;
let jcnThemeEventsInitialized = false;

function jcnValidateTheme(theme) {
  return theme === "light" || theme === "dark"
    ? theme
    : JCN_DEFAULT_THEME;
}

function jcnGetSavedTheme() {
  try {
    return jcnValidateTheme(localStorage.getItem(JCN_THEME_KEY));
  } catch (error) {
    console.warn("JCN theme preference unavailable:", error);
    return JCN_DEFAULT_THEME;
  }
}

function jcnSaveTheme(theme) {
  try {
    localStorage.setItem(JCN_THEME_KEY, jcnValidateTheme(theme));
  } catch (error) {
    console.warn("Unable to save JCN theme preference:", error);
  }
}

function jcnUpdateThemeControls() {
  const isLight = jcnCurrentTheme === "light";

  // Only updates switches that actually exist in the HTML.
  // Does NOT create a toggle on any page.
  document.querySelectorAll(".jcn-theme-switch").forEach(button => {
    button.setAttribute("role", "switch");
    button.setAttribute("aria-checked", String(isLight));
    button.setAttribute(
      "aria-label",
      isLight ? "Switch to Dark Mode" : "Switch to Light Mode"
    );
    button.title = isLight ? "Switch to Dark Mode" : "Switch to Light Mode";
  });

  document.querySelectorAll("[data-jcn-theme-choice]").forEach(button => {
    const selected = button.dataset.jcnThemeChoice === jcnCurrentTheme;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  document.querySelectorAll("[data-jcn-theme-toggle]").forEach(button => {
    if (!button.classList.contains("jcn-theme-switch")) {
      button.setAttribute(
        "aria-label",
        isLight ? "Switch to Dark Mode" : "Switch to Light Mode"
      );
    }

    const label = button.querySelector("[data-jcn-theme-label]");
    if (label) label.textContent = isLight ? "Dark Mode" : "Light Mode";

    const icon = button.querySelector("[data-jcn-theme-icon]");
    if (icon) {
      icon.className = isLight ? "fa-solid fa-moon" : "fa-solid fa-sun";
    }
  });

  document.querySelectorAll("[data-jcn-current-theme]").forEach(element => {
    element.textContent = isLight ? "Light Mode" : "Dark Mode";
  });
}

function jcnSetTheme(theme, save = true) {
  const validTheme = jcnValidateTheme(theme);
  const changed = validTheme !== jcnCurrentTheme;

  jcnCurrentTheme = validTheme;
  document.documentElement.setAttribute("data-theme", validTheme);
  document.documentElement.style.colorScheme = validTheme;

  if (save) jcnSaveTheme(validTheme);
  jcnUpdateThemeControls();

  if (changed) {
    document.dispatchEvent(new CustomEvent("jcn:themechange", {
      detail: { theme: validTheme }
    }));
  }

  return validTheme;
}

function jcnToggleTheme() {
  return jcnSetTheme(jcnCurrentTheme === "dark" ? "light" : "dark");
}

function jcnGetTheme() {
  return jcnCurrentTheme;
}

// Apply saved theme immediately when loaded in <head>.
(function jcnLoadInitialTheme() {
  jcnCurrentTheme = jcnGetSavedTheme();
  document.documentElement.setAttribute("data-theme", jcnCurrentTheme);
  document.documentElement.style.colorScheme = jcnCurrentTheme;
})();

/* ==========================================================
   EVENTS: No automatic global toggle creation.
   Put the switch HTML ONLY in customer-settings.html.
========================================================== */

function jcnInitializeThemeButtons() {
  if (jcnThemeEventsInitialized) return;
  jcnThemeEventsInitialized = true;

  // Delegated listener supports an existing or dynamically inserted
  // switch without duplicate click handlers.
  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;

    const choice = event.target.closest("[data-jcn-theme-choice]");
    if (choice) {
      jcnSetTheme(choice.dataset.jcnThemeChoice);
      return;
    }

    const toggle = event.target.closest("[data-jcn-theme-toggle]");
    if (toggle) jcnToggleTheme();
  });

  jcnUpdateThemeControls();
}

// Synchronize preferences across tabs on the same origin.
window.addEventListener("storage", event => {
  if (event.key === JCN_THEME_KEY) {
    jcnSetTheme(jcnValidateTheme(event.newValue), false);
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", jcnInitializeThemeButtons, {
    once: true
  });
} else {
  jcnInitializeThemeButtons();
}

window.JCNTheme = {
  set: jcnSetTheme,
  toggle: jcnToggleTheme,
  get: jcnGetTheme,
  refresh: jcnUpdateThemeControls
};
