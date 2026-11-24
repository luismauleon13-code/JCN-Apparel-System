/* ==========================================================
   JCN APPAREL PRINTING SERVICES
   ADMIN DARK / LIGHT THEME

   Theme selection is available ONLY in Admin Preferences.
   Saved preference applies to every connected Admin page.
========================================================== */

(() => {

  /* ==========================================================
     01. THEME CONFIGURATION
  ========================================================== */

  const JCN_ADMIN_THEME_KEY = "jcnAdminAccountTheme";
  const JCN_ADMIN_DEFAULT_THEME = "dark";

  let jcnAdminCurrentTheme = JCN_ADMIN_DEFAULT_THEME;
  let jcnAdminThemeEventsInitialized = false;


  /* ==========================================================
     02. VALIDATE THEME
  ========================================================== */

  function jcnAdminValidateTheme(theme) {

    return theme === "light" || theme === "dark"
      ? theme
      : JCN_ADMIN_DEFAULT_THEME;

  }


  /* ==========================================================
     03. GET SAVED THEME
  ========================================================== */

  function jcnAdminGetSavedTheme() {

    try {

      return jcnAdminValidateTheme(
        localStorage.getItem(JCN_ADMIN_THEME_KEY)
      );

    } catch (error) {

      console.warn(
        "JCN Admin theme preference unavailable:",
        error
      );

      return JCN_ADMIN_DEFAULT_THEME;

    }

  }


  /* ==========================================================
     04. SAVE THEME PREFERENCE
  ========================================================== */

  function jcnAdminSaveTheme(theme) {

    localStorage.setItem(
      JCN_ADMIN_THEME_KEY,
      jcnAdminValidateTheme(theme)
    );

  }


  /* ==========================================================
     05. UPDATE THEME CONTROLS
  ========================================================== */

  function jcnAdminUpdateThemeControls() {

    const isLight =
      jcnAdminCurrentTheme === "light";


    /* EXISTING ADMIN PREFERENCES BUTTONS */

    document.querySelectorAll(
      "[data-theme-value]"
    ).forEach(button => {

      const selected =
        button.dataset.themeValue === jcnAdminCurrentTheme;

      button.classList.toggle(
        "active",
        selected
      );

      button.setAttribute(
        "aria-pressed",
        String(selected)
      );

    });


    /* OPTIONAL ADMIN THEME CHOICE BUTTONS */

    document.querySelectorAll(
      "[data-jcn-admin-theme-choice]"
    ).forEach(button => {

      const selected =
        button.dataset.jcnAdminThemeChoice ===
        jcnAdminCurrentTheme;

      button.classList.toggle(
        "active",
        selected
      );

      button.setAttribute(
        "aria-pressed",
        String(selected)
      );

    });


    /* OPTIONAL SLIDING SWITCH */

    document.querySelectorAll(
      ".jcn-admin-theme-switch"
    ).forEach(button => {

      button.setAttribute(
        "role",
        "switch"
      );

      button.setAttribute(
        "aria-checked",
        String(isLight)
      );

      button.setAttribute(
        "aria-label",
        isLight
          ? "Switch to Dark Mode"
          : "Switch to Light Mode"
      );

      button.title = isLight
        ? "Switch to Dark Mode"
        : "Switch to Light Mode";

    });


    /* CURRENT THEME LABEL */

    document.querySelectorAll(
      "[data-jcn-admin-current-theme]"
    ).forEach(element => {

      element.textContent = isLight
        ? "Light Mode"
        : "Dark Mode";

    });


    /* EXISTING HIDDEN THEME SELECT */

    const themeSelect =
      document.getElementById("accountTheme");

    if (themeSelect) {

      themeSelect.value =
        jcnAdminCurrentTheme;

    }

  }


  /* ==========================================================
     06. APPLY GLOBAL ADMIN THEME
  ========================================================== */

  function jcnAdminSetTheme(theme, save = true) {

    const validTheme =
      jcnAdminValidateTheme(theme);

    const changed =
      validTheme !== jcnAdminCurrentTheme;


    /* SAVE BEFORE APPLYING */

    if (save) {

      jcnAdminSaveTheme(validTheme);

    }


    /* UPDATE CURRENT THEME */

    jcnAdminCurrentTheme = validTheme;

    const root = document.documentElement;


    /* CUSTOMER-STYLE THEME ATTRIBUTE */

    root.setAttribute(
      "data-theme",
      validTheme
    );


    /* EXISTING ADMIN CSS COMPATIBILITY */

    root.setAttribute(
      "data-account-theme",
      validTheme
    );


    /* BOOTSTRAP THEME SUPPORT */

    root.setAttribute(
      "data-bs-theme",
      validTheme
    );


    /* BROWSER COLOR SCHEME */

    root.style.colorScheme = validTheme;


    /* UPDATE THEME BUTTONS */

    jcnAdminUpdateThemeControls();


    /* NOTIFY OTHER ADMIN COMPONENTS */

    if (changed) {

      document.dispatchEvent(

        new CustomEvent("jcn:admin-themechange", {

          detail: {
            theme: validTheme
          }

        })

      );

      window.dispatchEvent(

        new CustomEvent("jcn:admin-theme-changed", {

          detail: {
            theme: validTheme
          }

        })

      );

    }

    return validTheme;

  }


  /* ==========================================================
     07. TOGGLE THEME
  ========================================================== */

  function jcnAdminToggleTheme() {

    const nextTheme =
      jcnAdminCurrentTheme === "dark"
        ? "light"
        : "dark";

    return jcnAdminSetTheme(nextTheme);

  }


  /* ==========================================================
     08. GET CURRENT THEME
  ========================================================== */

  function jcnAdminGetTheme() {

    return jcnAdminCurrentTheme;

  }


  /* ==========================================================
     09. THEME PREFERENCE MESSAGE
  ========================================================== */

  function jcnAdminShowThemeMessage(
    message,
    type = "success"
  ) {

    const messageBox =
      document.getElementById("settingsMessage");

    if (!messageBox) return;

    messageBox.textContent = message;

    messageBox.className =
      `settings-message ${type}`;

  }


  /* ==========================================================
     10. CHANGE THEME FROM PREFERENCES
  ========================================================== */

  function jcnAdminChangeTheme(theme) {

    if (theme !== "dark" && theme !== "light") {
      return;
    }

    try {

      const activeTheme =
        jcnAdminSetTheme(theme);

      jcnAdminShowThemeMessage(

        `${activeTheme === "light"
          ? "Light"
          : "Dark"} mode activated.`

      );

    } catch (error) {

      jcnAdminSetTheme(
        jcnAdminCurrentTheme,
        false
      );

      jcnAdminShowThemeMessage(
        "Unable to save theme preference.",
        "error"
      );

      console.error(
        "JCN Admin theme error:",
        error
      );

    }

  }


  /* ==========================================================
     11. LOAD INITIAL THEME

     Applies immediately when loaded inside <head>.
  ========================================================== */

  function jcnAdminLoadInitialTheme() {

    const savedTheme =
      jcnAdminGetSavedTheme();

    jcnAdminSetTheme(
      savedTheme,
      false
    );

  }

  jcnAdminLoadInitialTheme();


  /* ==========================================================
     12. INITIALIZE THEME BUTTON EVENTS

     Similar to Customer Theme:
     - Delegated event listeners
     - No automatic toggle creation
     - Supports dynamically inserted theme buttons
  ========================================================== */

  function jcnAdminInitializeThemeButtons() {

    if (jcnAdminThemeEventsInitialized) {
      return;
    }

    jcnAdminThemeEventsInitialized = true;


    /* GLOBAL CLICK EVENT */

    document.addEventListener("click", event => {

      if (!(event.target instanceof Element)) {
        return;
      }


      /* EXISTING ADMIN THEME CARDS */

      const themeChoice = event.target.closest(
        "#panel-preferences [data-theme-value]"
      );

      if (themeChoice) {

        jcnAdminChangeTheme(
          themeChoice.dataset.themeValue
        );

        return;

      }


      /* OPTIONAL THEME CHOICE */

      const choice = event.target.closest(
        "[data-jcn-admin-theme-choice]"
      );

      if (choice) {

        jcnAdminChangeTheme(
          choice.dataset.jcnAdminThemeChoice
        );

        return;

      }


      /* OPTIONAL SLIDING SWITCH */

      const toggle = event.target.closest(
        "[data-jcn-admin-theme-toggle]"
      );

      if (toggle) {

        jcnAdminChangeTheme(

          jcnAdminCurrentTheme === "dark"
            ? "light"
            : "dark"

        );

      }

    });


    /* DROPDOWN COMPATIBILITY */

    document.addEventListener("change", event => {

      if (
        event.target instanceof Element &&
        event.target.id === "accountTheme"
      ) {

        jcnAdminChangeTheme(
          event.target.value
        );

      }

    });


    /* UPDATE INITIAL BUTTON INDICATORS */

    jcnAdminUpdateThemeControls();

    console.log(
      "[JCN Admin Theme] Initialized:",
      jcnAdminCurrentTheme
    );

  }


  /* ==========================================================
     13. SYNCHRONIZE MULTIPLE BROWSER TABS
  ========================================================== */

  window.addEventListener("storage", event => {

    if (

      event.storageArea === localStorage &&

      (
        event.key === JCN_ADMIN_THEME_KEY ||
        event.key === null
      )

    ) {

      jcnAdminSetTheme(

        jcnAdminGetSavedTheme(),

        false

      );

    }

  });


  /* ==========================================================
     14. RESTORE THEME ON PAGE NAVIGATION
  ========================================================== */

  window.addEventListener("pageshow", () => {

    jcnAdminSetTheme(

      jcnAdminGetSavedTheme(),

      false

    );

  });


  /* ==========================================================
     15. GLOBAL ADMIN THEME ACCESS
  ========================================================== */

  window.JCNAdminTheme = {

    set: jcnAdminSetTheme,

    toggle: jcnAdminToggleTheme,

    get: jcnAdminGetTheme,

    refresh: jcnAdminUpdateThemeControls,


    /* BACKWARD COMPATIBILITY */

    setTheme: jcnAdminSetTheme,

    getTheme: jcnAdminGetTheme,

    applyTheme: theme => {

      return jcnAdminSetTheme(
        theme,
        false
      );

    },

    toggleTheme: jcnAdminToggleTheme,

    resetTheme: () => {

      return jcnAdminSetTheme(
        JCN_ADMIN_DEFAULT_THEME
      );

    }

  };


  /* ==========================================================
     16. DOM READY
  ========================================================== */

  if (document.readyState === "loading") {

    document.addEventListener(

      "DOMContentLoaded",

      jcnAdminInitializeThemeButtons,

      { once: true }

    );

  } else {

    jcnAdminInitializeThemeButtons();

  }

})();