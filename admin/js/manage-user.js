/* ==========================================================
   JCN APPAREL PRINTING SERVICES
   ADMIN - MANAGE CUSTOMERS
   WITH UNIFIED ADMIN LOGOUT MODAL
========================================================== */

(() => {

  /* ==========================================================
     01. API CONFIGURATION
  ========================================================== */

  const USERS_API = "/api/admin/users";
  const LOGIN_PAGE = "admin-login.html";

  const $ = id => document.getElementById(id);

  let users = [];
  let selected = null;
  let saving = false;
  let loading = false;


  /* ==========================================================
     02. HELPER FUNCTIONS
  ========================================================== */

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));


  /* ==========================================================
     03. ADMIN SESSION
  ========================================================== */

  function clearAdminSession() {

    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("admin");

    // Preserve admin and customer theme preferences.
    // Do not use localStorage.clear().

  }

  function redirectToLogin() {

    clearAdminSession();

    window.location.replace(LOGIN_PAGE);

  }

  function checkAdminSession() {

    if (!localStorage.getItem("adminToken")) {

      redirectToLogin();

      return false;

    }

    return true;

  }


  /* ==========================================================
     04. CUSTOMER STATUS
  ========================================================== */

  function statusOf(user) {

    return String(
      user.status || "unknown"
    ).trim().toLowerCase();

  }


  /* ==========================================================
     05. CUSTOMER NAME
  ========================================================== */

  function nameOf(user) {

    return String(

      user.full_name ||

      [
        user.first_name,
        user.middle_name,
        user.last_name
      ]
        .filter(Boolean)
        .join(" ") ||

      user.username ||

      "Unnamed customer"

    ).trim();

  }


  /* ==========================================================
     06. CUSTOMER AVATAR INITIALS
  ========================================================== */

  function initialsOf(name) {

    return name

      .split(/\s+/)

      .filter(Boolean)

      .slice(0, 2)

      .map(word => word[0])

      .join("")

      .toUpperCase() || "?";

  }


  /* ==========================================================
     07. RESTRICTION DETAILS
  ========================================================== */

  function restrictionDetails(user) {

    if (!user.restriction_until) {

      return "No expiry recorded";

    }

    const until = new Date(
      user.restriction_until
    );

    if (Number.isNaN(until.getTime())) {

      return "Invalid expiry date";

    }

    const remaining =
      until.getTime() - Date.now();

    if (remaining <= 0) {

      return "Expiry passed — refresh or unrestrict";

    }

    const days = Math.ceil(
      remaining / 86400000
    );

    return `${days} day(s) left · Until ${
      until.toLocaleDateString("en-PH")
    }`;

  }


  /* ==========================================================
     08. API REQUEST
  ========================================================== */

  async function request(
    path = "",
    method = "GET",
    body
  ) {

    const token = localStorage.getItem(
      "adminToken"
    );

    if (!token) {

      redirectToLogin();

      throw new Error(
        "Please log in again."
      );

    }

    let response;

    try {

      response = await fetch(
        USERS_API + path,
        {

          method,

          cache: "no-store",

          headers: {

            Authorization: `Bearer ${token}`,

            ...(body !== undefined
              ? {
                  "Content-Type": "application/json"
                }
              : {})

          },

          ...(body !== undefined
            ? {
                body: JSON.stringify(body)
              }
            : {})

        }
      );

    } catch {

      throw new Error(

        "Cannot reach the server. " +
        "Check your backend connection."

      );

    }


    /* EXPIRED ADMIN SESSION */

    if (response.status === 401) {

      redirectToLogin();

      throw new Error(
        "Your session expired. Please log in again."
      );

    }


    /* SERVER RESPONSE */

    let data;

    try {

      data = await response.json();

    } catch {

      throw new Error(

        "The server returned an unexpected response. " +
        "Check the users API."

      );

    }


    /* VALIDATE RESPONSE */

    if (
      !response.ok ||
      data?.success === false
    ) {

      throw new Error(

        data?.message ||
        "The request failed."

      );

    }

    return data;

  }


  /* ==========================================================
     09. DISPLAY CUSTOMER ACCOUNTS
  ========================================================== */

  function renderUsers() {

    const query = $("customerSearch")
      .value
      .trim()
      .toLowerCase();

    const filter = $("statusFilter").value;


    /* SEARCH AND FILTER */

    const visible = users.filter(user => {

      const searchable = [

        nameOf(user),

        user.username,

        user.email,

        user.phone

      ].join(" ").toLowerCase();

      return (

        searchable.includes(query) &&

        (
          filter === "all" ||
          statusOf(user) === filter
        )

      );

    });


    /* CUSTOMER COUNT */

    $("customerCount").textContent =

      `Showing ${visible.length} of ` +
      `${users.length} loaded customer(s)`;


    /* CUSTOMER TABLE */

    $("usersTableBody").innerHTML = visible.map(user => {

      const name = nameOf(user);

      const status = statusOf(user);


      /* VALID CUSTOMER STATUS */

      const knownStatus = [

        "active",
        "restricted",
        "inactive"

      ].includes(status);

      const statusClass = knownStatus

        ? status

        : "unknown";

      const statusLabel = knownStatus

        ? status[0].toUpperCase() + status.slice(1)

        : "Unknown";


      /* CUSTOMER ACTION */

      const isRestricted =
        status === "restricted";

      const action = isRestricted

        ? "unrestrict"

        : "restrict";

      const actionLabel = isRestricted

        ? "Unrestrict customer"

        : "Restrict customer";

      const actionIcon = isRestricted

        ? "fa-unlock"

        : "fa-ban";

      const id = escapeHTML(user.id);


      /* GENERATE CUSTOMER ROW */

      return `

        <tr>

          <!-- CUSTOMER NAME AND AVATAR -->

          <td>

            <div class="customer-cell">

              <div
                class="user-avatar"
                aria-hidden="true"
              >
                ${escapeHTML(initialsOf(name))}
              </div>

              <span class="customer-name">
                ${escapeHTML(name)}
              </span>

            </div>

          </td>


          <!-- EMAIL ADDRESS -->

          <td class="contact-cell">

            ${escapeHTML(
              user.email || "Not provided"
            )}

          </td>


          <!-- PHONE NUMBER -->

          <td class="contact-cell phone-cell">

            ${escapeHTML(
              user.phone || "Not provided"
            )}

          </td>


          <!-- CUSTOMER ROLE -->

          <td>

            <span class="badge-role">
              Customer
            </span>

          </td>


          <!-- ACCOUNT STATUS -->

          <td>

            <span class="status status-${statusClass}">

              ${statusLabel}

            </span>

            ${isRestricted ? `

              <small class="restriction-detail">

                ${escapeHTML(
                  restrictionDetails(user)
                )}

              </small>

              <small class="restriction-detail">

                ${escapeHTML(
                  user.restriction_reason ||
                  "No reason provided"
                )}

              </small>

            ` : ""}

          </td>


          <!-- ACTION BUTTONS -->

          <td>

            <div class="action-buttons">


              <!-- RESTRICT / UNRESTRICT -->

              <button

                type="button"

                class="icon-button ${
                  isRestricted ? "restore" : ""
                }"

                data-action="${action}"

                data-id="${id}"

                title="${actionLabel}"

                aria-label="${actionLabel}: ${
                  escapeHTML(name)
                }"

              >

                <i
                  class="fa-solid ${actionIcon}"
                  aria-hidden="true"
                ></i>

              </button>


              <!-- DELETE CUSTOMER -->

              <button

                type="button"

                class="icon-button delete"

                data-action="delete"

                data-id="${id}"

                title="Delete customer"

                aria-label="Delete customer: ${
                  escapeHTML(name)
                }"

              >

                <i
                  class="fa-solid fa-trash-can"
                  aria-hidden="true"
                ></i>

              </button>

            </div>

          </td>

        </tr>

      `;

    }).join("") || `

      <tr>

        <td colspan="6" class="empty">

          ${users.length

            ? "No customers match your search."

            : "No registered customers yet."

          }

        </td>

      </tr>

    `;

  }


  /* ==========================================================
     10. LOAD CUSTOMER ACCOUNTS
  ========================================================== */

  async function loadUsers() {

    if (loading) return;

    loading = true;


    /* DISABLE CONTROLS WHILE LOADING */

    $("refreshUsers").disabled = true;

    $("customerSearch").disabled = true;

    $("statusFilter").disabled = true;

    $("customerCount").textContent = "";


    /* LOADING MESSAGE */

    $("usersTableBody").innerHTML = `

      <tr>

        <td colspan="6" class="empty">

          <i class="fa-solid fa-spinner fa-spin"></i>

          Loading customers...

        </td>

      </tr>

    `;

    try {

      const data = await request();

      if (!Array.isArray(data.users)) {

        throw new Error(

          "The server did not return a customer list."

        );

      }

      users = data.users;

      renderUsers();

    } catch (error) {

      console.error(
        "LOAD CUSTOMERS ERROR:",
        error
      );

      users = [];

      $("usersTableBody").innerHTML = `

        <tr>

          <td colspan="6" class="empty error">

            ${escapeHTML(error.message)}

            Use Refresh to try again.

          </td>

        </tr>

      `;

    } finally {

      loading = false;

      $("refreshUsers").disabled = false;

      $("customerSearch").disabled = false;

      $("statusFilter").disabled = false;

    }

  }


  /* ==========================================================
     11. OPEN CUSTOMER ACTION MODAL

     Restrict Customer
     Unrestrict Customer
     Delete Customer
  ========================================================== */

  function openAction(action, id) {

    if (saving || loading) return;

    const user = users.find(

      item => String(item.id) === String(id)

    );

    if (

      !user ||

      ![
        "restrict",
        "unrestrict",
        "delete"
      ].includes(action)

    ) {

      return;

    }


    /* SET SELECTED CUSTOMER */

    selected = {
      action,
      id
    };


    /* RESET MODAL FORM */

    $("actionForm").reset();

    $("actionError").textContent = "";


    /* RESTRICTION FORM FIELDS */

    const restrict =
      action === "restrict";

    $("restrictionFields").hidden = !restrict;

    $("restrictDays").disabled = !restrict;

    $("restrictReason").disabled = !restrict;

    $("restrictDays").required = restrict;

    $("restrictReason").required = restrict;


    /* MODAL TITLES */

    const labels = {

      restrict: "Restrict Customer",

      unrestrict: "Unrestrict Customer",

      delete: "Delete Customer"

    };

    $("actionTitle").textContent =
      labels[action];


    /* CUSTOMER DESCRIPTION */

    const name = nameOf(user);

    $("actionDescription").textContent =

      action === "restrict"

        ? `Set the restriction duration and reason for ${name}.`

        : action === "unrestrict"

          ? `Restore account access for ${name}?`

          : `Permanently delete ${name}'s account? ` +
            "Customers with existing orders cannot be deleted.";


    /* CONFIRM BUTTON TEXT */

    $("confirmAction").textContent =

      action === "restrict"

        ? "Restrict"

        : action === "unrestrict"

          ? "Unrestrict"

          : "Delete";


    /* CONFIRM BUTTON COLOR */

    $("confirmAction").className =

      action === "delete"

        ? "btn btn-danger"

        : "btn btn-gold";


    /* OPEN NATIVE DIALOG */

    const modal = $("actionModal");

    if (!modal.open) {

      modal.showModal();

    }


    /* FOCUS FIRST FIELD */

    if (restrict) {

      $("restrictDays").focus();

    } else {

      $("cancelAction").focus();

    }

  }


  /* ==========================================================
     12. CUSTOMER ACTION LOADING STATE
  ========================================================== */

  function setSaving(value) {

    saving = value;

    $("confirmAction").disabled = value;

    $("cancelAction").disabled = value;


    /* PREVENT LOGOUT DURING CUSTOMER UPDATE */

    const logoutButton = $("adminLogoutBtn");

    if (logoutButton) {

      logoutButton.disabled = value;

    }


    /* FORM ACCESSIBILITY */

    $("actionForm").setAttribute(

      "aria-busy",

      String(value)

    );


    /* RESTRICTION FIELD STATES */

    const restrict =
      selected?.action === "restrict";

    $("restrictDays").disabled =

      value || !restrict;

    $("restrictReason").disabled =

      value || !restrict;

  }


  /* ==========================================================
     13. SUBMIT CUSTOMER ACTION
  ========================================================== */

  async function submitAction(event) {

    event.preventDefault();

    if (!selected || saving) return;

    const { action, id } = selected;

    let body;


    /* VALIDATE CUSTOMER RESTRICTION */

    if (action === "restrict") {

      const days = Number(
        $("restrictDays").value
      );

      const reason = $("restrictReason")
        .value
        .trim();


      /* VALIDATE NUMBER OF DAYS */

      if (

        !Number.isInteger(days) ||

        days < 1 ||

        days > 3650

      ) {

        $("actionError").textContent =

          "Enter a whole number of days between 1 and 3650.";

        return;

      }


      /* VALIDATE REASON */

      if (!reason || reason.length > 300) {

        $("actionError").textContent =

          "Enter a reason of 1 to 300 characters.";

        return;

      }

      body = {
        days,
        reason
      };

    }


    /* RESET MESSAGES */

    $("actionError").textContent = "";

    $("pageNotice").textContent = "";

    setSaving(true);

    const encodedId =
      encodeURIComponent(id);

    try {


      /* CUSTOMER API ROUTE */

      const path = action === "delete"

        ? `/${encodedId}`

        : `/${encodedId}/${action}`;


      /* SEND REQUEST */

      const data = await request(

        path,

        action === "delete"
          ? "DELETE"
          : "PATCH",

        body

      );


      /* CLOSE ACTION MODAL */

      $("actionModal").close();


      /* SUCCESS MESSAGE */

      $("pageNotice").textContent =

        data.message ||

        "Customer account updated successfully.";


      /* REFRESH CUSTOMER TABLE */

      await loadUsers();

    } catch (error) {

      console.error(
        "CUSTOMER ACTION ERROR:",
        error
      );

      $("actionError").textContent =
        error.message;

    } finally {

      setSaving(false);

    }

  }


  /* ==========================================================
     14. UNIFIED ADMIN LOGOUT MODAL

     Same design as:
     - Manage Staff
     - Announcements
     - Global Admin Logout

     Uses admin-theme.css
  ========================================================== */

  function setupAdminLogout() {

    const logoutButton =

      $("adminLogoutBtn") ||

      $("logoutBtn");

    if (!logoutButton) {

      console.warn(

        "[JCN Admin] Logout button was not found."

      );

      return;

    }


    /* PREVENT DUPLICATE INITIALIZATION */

    if (
      logoutButton.dataset.jcnLogoutReady === "true"
    ) {

      return;

    }

    let modal = $("adminLogoutModal");


    /* ========================================================
       CREATE NATIVE HTML DIALOG
    ======================================================== */

    if (!(modal instanceof HTMLDialogElement)) {

      const newModal =
        document.createElement("dialog");

      newModal.id = "adminLogoutModal";

      if (modal) {

        modal.replaceWith(newModal);

      } else {

        document.body.appendChild(newModal);

      }

      modal = newModal;

    }


    /* ========================================================
       APPLY STANDARD LOGOUT CLASS
    ======================================================== */

    modal.id = "adminLogoutModal";

    modal.className = "jcn-unified-logout";

    modal.removeAttribute("hidden");

    modal.removeAttribute("aria-hidden");

    modal.removeAttribute("style");

    modal.setAttribute(

      "aria-labelledby",

      "adminLogoutTitle"

    );

    modal.setAttribute(

      "aria-describedby",

      "adminLogoutDescription"

    );

    if (modal.open) {

      modal.close();

    }


    /* ========================================================
       STANDARD LOGOUT MODAL DESIGN
    ======================================================== */

    modal.innerHTML = `

      <div class="logout-icon">

        <i

          class="fa-solid fa-right-from-bracket"

          aria-hidden="true"

        ></i>

      </div>


      <h3 id="adminLogoutTitle">

        Confirm Admin Logout

      </h3>


      <p id="adminLogoutDescription">

        Are you sure you want to log out?

      </p>


      <div class="logout-actions">


        <!-- CONFIRM LOGOUT -->

        <button

          type="button"

          id="adminConfirmLogout"

          class="logout-confirm-btn"

        >

          Yes, Logout

        </button>


        <!-- CANCEL LOGOUT -->

        <button

          type="button"

          id="adminCancelLogout"

          class="logout-cancel-btn"

          autofocus

        >

          Cancel

        </button>

      </div>

    `;


    /* ========================================================
       LOGOUT ELEMENTS
    ======================================================== */

    const confirmButton =
      $("adminConfirmLogout");

    const cancelButton =
      $("adminCancelLogout");

    let previousOverflow = "";

    let loggingOut = false;

    let outsidePress = false;


    /* ========================================================
       OPEN LOGOUT MODAL
    ======================================================== */

    function openLogoutModal(event) {

      event.preventDefault();

      if (

        modal.open ||

        loggingOut ||

        saving

      ) {

        return;

      }

      previousOverflow =
        document.body.style.overflow;

      modal.showModal();

      document.body.style.overflow =
        "hidden";

      cancelButton.focus();

    }


    /* ========================================================
       CLOSE LOGOUT MODAL
    ======================================================== */

    function closeLogoutModal() {

      if (loggingOut) return;

      if (modal.open) {

        modal.close();

      }

    }


    /* ========================================================
       DETECT OUTSIDE MODAL CLICK
    ======================================================== */

    function isOutsideModal(event) {

      const rect =
        modal.getBoundingClientRect();

      return (

        event.target === modal &&

        (

          event.clientX < rect.left ||

          event.clientX > rect.right ||

          event.clientY < rect.top ||

          event.clientY > rect.bottom

        )

      );

    }


    /* ========================================================
       OPEN LOGOUT EVENT
    ======================================================== */

    logoutButton.addEventListener(

      "click",

      openLogoutModal

    );


    /* ========================================================
       CANCEL LOGOUT EVENT
    ======================================================== */

    cancelButton.addEventListener(

      "click",

      closeLogoutModal

    );


    /* ========================================================
       ESCAPE KEY SUPPORT
    ======================================================== */

    modal.addEventListener(

      "cancel",

      event => {

        event.preventDefault();

        closeLogoutModal();

      }

    );


    /* ========================================================
       OUTSIDE CLICK SUPPORT
    ======================================================== */

    modal.addEventListener(

      "pointerdown",

      event => {

        outsidePress =
          isOutsideModal(event);

      }

    );

    modal.addEventListener(

      "click",

      event => {

        if (

          outsidePress &&

          isOutsideModal(event)

        ) {

          closeLogoutModal();

        }

        outsidePress = false;

      }

    );


    /* ========================================================
       RESTORE PAGE AFTER CLOSING
    ======================================================== */

    modal.addEventListener(

      "close",

      () => {

        document.body.style.overflow =

          previousOverflow;

        outsidePress = false;

        if (!loggingOut) {

          confirmButton.disabled = false;

          cancelButton.disabled = false;

          logoutButton.focus();

        }

      }

    );


    /* ========================================================
       CONFIRM ADMIN LOGOUT
    ======================================================== */

    confirmButton.addEventListener(

      "click",

      () => {

        if (loggingOut || saving) return;

        loggingOut = true;

        confirmButton.disabled = true;

        cancelButton.disabled = true;

        try {


          /* CLEAR ADMIN SESSION ONLY */

          clearAdminSession();


          /* PRESERVE SAVED THEME */

          // jcnAdminAccountTheme remains saved.
          // jcnCustomerTheme remains saved.


          /* REDIRECT TO LOGIN */

          window.location.replace(
            LOGIN_PAGE
          );

        } catch (error) {

          loggingOut = false;

          confirmButton.disabled = false;

          cancelButton.disabled = false;

          console.error(

            "ADMIN LOGOUT ERROR:",

            error

          );

          window.alert(

            "Unable to clear the admin session. " +
            "Please try again."

          );

        }

      }

    );


    /* ========================================================
       MARK LOGOUT AS INITIALIZED
    ======================================================== */

    logoutButton.dataset.jcnLogoutReady =
      "true";

    console.log(

      "[JCN Admin] Unified logout initialized."

    );

  }


  /* ==========================================================
     15. CUSTOMER MANAGEMENT EVENTS
  ========================================================== */

  function setupCustomerEvents() {


    /* REFRESH CUSTOMER LIST */

    $("refreshUsers").addEventListener(

      "click",

      loadUsers

    );


    /* CUSTOMER SEARCH */

    $("customerSearch").addEventListener(

      "input",

      renderUsers

    );


    /* CUSTOMER STATUS FILTER */

    $("statusFilter").addEventListener(

      "change",

      renderUsers

    );


    /* CUSTOMER ACTION BUTTONS */

    $("usersTableBody").addEventListener(

      "click",

      event => {

        const button = event.target.closest(

          "button[data-action]"

        );

        if (button) {

          openAction(

            button.dataset.action,

            button.dataset.id

          );

        }

      }

    );


    /* SUBMIT CUSTOMER ACTION */

    $("actionForm").addEventListener(

      "submit",

      submitAction

    );


    /* CANCEL CUSTOMER ACTION */

    $("cancelAction").addEventListener(

      "click",

      () => {

        if (!saving) {

          $("actionModal").close();

        }

      }

    );


    /* PREVENT CLOSING WHILE SAVING */

    $("actionModal").addEventListener(

      "cancel",

      event => {

        if (saving) {

          event.preventDefault();

        }

      }

    );


    /* RESET SELECTED CUSTOMER */

    $("actionModal").addEventListener(

      "close",

      () => {

        selected = null;

      }

    );

  }


  /* ==========================================================
     16. INITIALIZE MANAGE CUSTOMERS
  ========================================================== */

  let initialized = false;

  function init() {

    if (initialized) return;


    /* CHECK ADMIN AUTHENTICATION */

    if (!checkAdminSession()) {

      return;

    }

    initialized = true;


    /* INITIALIZE CUSTOMER EVENTS */

    setupCustomerEvents();


    /* INITIALIZE UNIFIED LOGOUT */

    setupAdminLogout();


    /* LOAD CUSTOMER ACCOUNTS */

    loadUsers();

    console.log(

      "[JCN Admin] Manage Customers initialized."

    );

  }


  /* ==========================================================
     17. DOM READY
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