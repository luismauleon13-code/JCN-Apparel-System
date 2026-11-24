/* =========================================
   JCN GLOBAL ADMIN THEME CONTROLLER
========================================= */

(() => {

  /* =========================================
     01. THEME CONFIGURATION
  ========================================= */

  const THEME_KEY = "jcnAdminAccountTheme";

  const DEFAULT_THEME = "dark";

  const VALID_THEMES = [
    "dark",
    "light"
  ];


  /* =========================================
     02. VALIDATE THEME
  ========================================= */

  function normalizeTheme(value) {

    return VALID_THEMES.includes(value)
      ? value
      : DEFAULT_THEME;

  }


  /* =========================================
     03. GET SAVED THEME
  ========================================= */

  function getTheme() {

    try {

      const savedTheme =
        localStorage.getItem(THEME_KEY);

      return normalizeTheme(savedTheme);

    } catch (error) {

      console.error(
        "Unable to retrieve admin theme:",
        error
      );

      return DEFAULT_THEME;

    }

  }


  /* =========================================
     04. UPDATE THEME CONTROLS
  ========================================= */

  function updateThemeControls(theme) {

    /* UPDATE THEME SELECT */

    const themeSelect =
      document.getElementById("accountTheme");

    if (themeSelect) {

      themeSelect.value = theme;

    }


    /* UPDATE THEME BUTTONS */

    const themeButtons =
      document.querySelectorAll(
        ".theme-option[data-theme-value]"
      );

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

  }


  /* =========================================
     05. APPLY THEME
  ========================================= */

  function applyTheme(value) {

    const theme = normalizeTheme(value);

    const root = document.documentElement;


    /* GLOBAL JCN THEME ATTRIBUTE */

    root.setAttribute(
      "data-account-theme",
      theme
    );


    /* BOOTSTRAP 5.3 THEME SUPPORT */

    root.setAttribute(
      "data-bs-theme",
      theme
    );


    /* UPDATE SETTINGS CONTROLS */

    updateThemeControls(theme);


    /* RETURN ACTIVE THEME */

    return theme;

  }


  /* =========================================
     06. SAVE AND APPLY THEME
  ========================================= */

  function setTheme(value) {

    const theme = normalizeTheme(value);

    try {

      localStorage.setItem(
        THEME_KEY,
        theme
      );

    } catch (error) {

      console.error(
        "Unable to save admin theme:",
        error
      );

      throw error;

    }


    /* APPLY SELECTED THEME */

    applyTheme(theme);


    /* DISPATCH GLOBAL THEME EVENT */

    window.dispatchEvent(

      new CustomEvent("jcn:admin-theme-changed", {

        detail: {
          theme: theme
        }

      })

    );

    return theme;

  }


  /* =========================================
     07. TOGGLE THEME
  ========================================= */

  function toggleTheme() {

    const currentTheme = getTheme();

    const nextTheme =
      currentTheme === "dark"
        ? "light"
        : "dark";

    return setTheme(nextTheme);

  }


  /* =========================================
     08. RESET DEFAULT THEME
  ========================================= */

  function resetTheme() {

    return setTheme(DEFAULT_THEME);

  }


  /* =========================================
     09. GLOBAL THEME ACCESS
  ========================================= */

  window.JCNAdminTheme = {

    getTheme,

    applyTheme,

    setTheme,

    toggleTheme,

    resetTheme

  };


  /* =========================================
     10. APPLY THEME BEFORE PAGE RENDER
  ========================================= */

  applyTheme(getTheme());


  /* =========================================
     11. SYNCHRONIZE MULTIPLE BROWSER TABS
  ========================================= */

  window.addEventListener("storage", event => {

    if (

      event.key === THEME_KEY ||
      event.key === null

    ) {

      const theme = applyTheme(getTheme());

      window.dispatchEvent(

        new CustomEvent("jcn:admin-theme-changed", {

          detail: {
            theme: theme
          }

        })

      );

    }

  });


  /* =========================================
     12. RESTORE THEME ON PAGE NAVIGATION
  ========================================= */

  window.addEventListener("pageshow", () => {

    applyTheme(getTheme());

  });


  /* =========================================
     13. INITIALIZE GLOBAL THEME
  ========================================= */

  function initTheme() {

    const savedTheme = getTheme();

    applyTheme(savedTheme);

  }


  /* =========================================
     14. DOM READY
  ========================================= */

  if (document.readyState === "loading") {

    document.addEventListener(

      "DOMContentLoaded",

      initTheme,

      {
        once: true
      }

    );

  } else {

    initTheme();

  }

})();