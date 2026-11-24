/* ==========================================================
   JCN APPAREL PRINTING SERVICES
   ADMIN ANNOUNCEMENTS
   UNIFIED ADMIN LOGOUT MODAL
========================================================== */

(() => {

  /* 01. CONFIGURATION */

  const API_BASE = "";
  const LOGIN_PAGE = "admin-login.html";

  const $ = id => document.getElementById(id);

  let announcements = [];
  let selectedAnnouncement = null;

  let loading = false;
  let posting = false;
  let deleting = false;
  let loadVersion = 0;


  /* ==========================================================
     02. ADMIN LOGOUT
  ========================================================== */

  function logout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("admin");

    // Preserve global admin and customer theme preferences.
    window.location.replace(LOGIN_PAGE);
  }


  /* ==========================================================
     03. UNIFIED LOGOUT MODAL
  ========================================================== */

  function setupLogout() {

    const logoutButton = $("adminLogoutBtn");
    let modal = $("adminLogoutModal");

    if (!logoutButton) return;

    // Ensure that the logout modal uses a native HTML dialog.

    if (!(modal instanceof HTMLDialogElement)) {

      const newModal = document.createElement("dialog");

      newModal.id = "adminLogoutModal";

      if (modal) {
        modal.replaceWith(newModal);
      } else {
        document.body.appendChild(newModal);
      }

      modal = newModal;
    }

    modal.className = "jcn-unified-logout";

    modal.setAttribute(
      "aria-labelledby",
      "adminLogoutTitle"
    );

    modal.setAttribute(
      "aria-describedby",
      "adminLogoutDescription"
    );

    modal.removeAttribute("hidden");

    if (modal.open) {
      modal.close();
    }


    /* STANDARD LOGOUT DESIGN */

    modal.innerHTML = `
      <div class="logout-icon">
        <i
          class="fa-solid fa-right-from-bracket"
          aria-hidden="true">
        </i>
      </div>

      <h3 id="adminLogoutTitle">
        Confirm Admin Logout
      </h3>

      <p id="adminLogoutDescription">
        Are you sure you want to log out?
      </p>

      <div class="logout-actions">

        <button
          type="button"
          class="logout-confirm-btn"
          id="adminConfirmLogout">
          Yes, Logout
        </button>

        <button
          type="button"
          class="logout-cancel-btn"
          id="adminCancelLogout">
          Cancel
        </button>

      </div>
    `;

    const confirmButton = $("adminConfirmLogout");
    const cancelButton = $("adminCancelLogout");

    let previousOverflow = "";


    /* OPEN LOGOUT MODAL */

    function openLogoutModal() {

      if (posting || deleting || modal.open) return;

      previousOverflow = document.body.style.overflow;

      modal.showModal();

      document.body.style.overflow = "hidden";

      cancelButton.focus();
    }


    /* CLOSE LOGOUT MODAL */

    function closeLogoutModal() {

      if (modal.open) {
        modal.close();
      }
    }


    /* LOGOUT BUTTON EVENTS */

    logoutButton.addEventListener(
      "click",
      openLogoutModal
    );

    cancelButton.addEventListener(
      "click",
      closeLogoutModal
    );


    /* CONFIRM LOGOUT */

    confirmButton.addEventListener("click", () => {

      if (posting || deleting) return;

      confirmButton.disabled = true;
      cancelButton.disabled = true;

      logout();
    });


    /* ESCAPE KEY */

    modal.addEventListener("cancel", event => {

      event.preventDefault();

      closeLogoutModal();
    });


    /* CLICK OUTSIDE MODAL */

    modal.addEventListener("click", event => {

      if (event.target !== modal) return;

      const rect = modal.getBoundingClientRect();

      const outside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;

      if (outside) {
        closeLogoutModal();
      }
    });


    /* RESTORE PAGE AFTER CLOSING */

    modal.addEventListener("close", () => {

      document.body.style.overflow = previousOverflow;

      confirmButton.disabled = false;
      cancelButton.disabled = false;

      logoutButton.focus();
    });

  }


  /* ==========================================================
     04. API REQUEST
  ========================================================== */

  async function request(
    path,
    method = "GET",
    body
  ) {

    const token = localStorage.getItem("adminToken");

    if (!token) {

      logout();

      throw new Error("Please log in again.");
    }

    let response;

    try {

      response = await fetch(API_BASE + path, {

        method,

        cache: "no-store",

        headers: {

          Authorization: `Bearer ${token}`,

          ...(body !== undefined
            ? { "Content-Type": "application/json" }
            : {})

        },

        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {})

      });

    } catch {

      throw new Error(
        "Cannot reach the server. Check your backend connection."
      );
    }


    /* EXPIRED SESSION */

    if (response.status === 401) {

      logout();

      throw new Error(
        "Session expired. Please log in again."
      );
    }

    let data;

    try {

      data = await response.json();

    } catch {

      throw new Error(
        "The server returned an unexpected response. " +
        "Check the announcements API."
      );
    }


    /* VALIDATE RESPONSE */

    if (!response.ok || data?.success === false) {

      throw new Error(
        data?.message ||
        "The announcement request failed."
      );
    }

    return data;
  }


  /* ==========================================================
     05. PAGE NOTIFICATION
  ========================================================== */

  function notice(message) {

    $("pageNotice").textContent = message;
  }


  /* ==========================================================
     06. UPDATE BUTTON STATES
  ========================================================== */

  function updateControls() {

    const mutationBusy = posting || deleting;

    $("postAnnouncementBtn").disabled = mutationBusy;

    $("announcementTitle").disabled = mutationBusy;

    $("announcementMessage").disabled = mutationBusy;

    $("refreshAnnouncements").disabled =
      loading || mutationBusy;

    $("adminLogoutBtn").disabled = mutationBusy;

    $("confirmDelete").disabled = mutationBusy;

    $("cancelDelete").disabled = deleting;

    document
      .querySelectorAll(".delete-announcement-btn")
      .forEach(button => {

        button.disabled = mutationBusy;

      });

    $("announcementForm").setAttribute(
      "aria-busy",
      String(posting)
    );

  }


  /* ==========================================================
     07. HISTORY MESSAGE
  ========================================================== */

  function showHistoryMessage(
    message,
    isError = false
  ) {

    const paragraph = document.createElement("p");

    paragraph.className =
      isError ? "empty error" : "empty";

    paragraph.textContent = message;

    $("announcementHistory").replaceChildren(
      paragraph
    );

  }


  /* ==========================================================
     08. RENDER ANNOUNCEMENTS
  ========================================================== */

  function renderAnnouncements() {

    const history = $("announcementHistory");

    history.replaceChildren();

    $("historyCount").textContent =
      `${announcements.length} loaded announcement(s)`;

    if (!announcements.length) {

      showHistoryMessage("No announcements yet.");

      return;
    }

    const fragment = document.createDocumentFragment();

    announcements.forEach(item => {

      /* ANNOUNCEMENT CARD */

      const article = document.createElement("article");

      article.className = "announcement-item";


      /* ANNOUNCEMENT ICON */

      const icon = document.createElement("div");

      icon.className = "announcement-icon";

      icon.innerHTML = `
        <i
          class="fa-solid fa-bullhorn"
          aria-hidden="true">
        </i>
      `;


      /* ANNOUNCEMENT CONTENT */

      const content = document.createElement("div");

      content.className = "announcement-content";

      const header = document.createElement("div");

      header.className = "announcement-header";

      const headingGroup = document.createElement("div");


      /* ANNOUNCEMENT TITLE */

      const title = document.createElement("h3");

      title.className = "announcement-title";

      title.textContent =
        item.title || "Untitled announcement";


      /* ANNOUNCEMENT DATE */

      const date = document.createElement("time");

      date.className = "announcement-date";

      const createdAt = item.created_at
        ? new Date(item.created_at)
        : null;

      if (
        createdAt &&
        !Number.isNaN(createdAt.getTime())
      ) {

        date.dateTime = createdAt.toISOString();

        date.textContent =

          createdAt.toLocaleString("en-PH", {

            timeZone: "Asia/Manila",

            year: "numeric",
            month: "short",
            day: "numeric",

            hour: "numeric",
            minute: "2-digit"

          }) + " PHT";

      } else {

        date.textContent = "Date unavailable";

      }

      headingGroup.append(title, date);


      /* DELETE BUTTON */

      const deleteButton =
        document.createElement("button");

      deleteButton.type = "button";

      deleteButton.className =
        "delete-announcement-btn";

      deleteButton.dataset.id = String(item.id);

      deleteButton.title = "Delete announcement";

      deleteButton.setAttribute(

        "aria-label",

        `Delete announcement: ${
          item.title || "Untitled announcement"
        }`

      );

      deleteButton.innerHTML = `
        <i
          class="fa-solid fa-trash-can"
          aria-hidden="true">
        </i>
      `;

      header.append(
        headingGroup,
        deleteButton
      );


      /* ANNOUNCEMENT MESSAGE */

      const message = document.createElement("p");

      message.className = "announcement-message";

      message.textContent = item.message || "";


      /* APPEND ANNOUNCEMENT ELEMENTS */

      content.append(
        header,
        message
      );

      article.append(
        icon,
        content
      );

      fragment.append(article);

    });

    history.append(fragment);

    updateControls();

  }


  /* ==========================================================
     09. LOAD ANNOUNCEMENTS
  ========================================================== */

  async function loadAnnouncements() {

    const version = ++loadVersion;

    loading = true;

    updateControls();

    $("announcementHistory").setAttribute(
      "aria-busy",
      "true"
    );

    $("historyCount").textContent = "";

    showHistoryMessage("Loading announcements...");

    try {

      const data = await request(
        "/api/announcements"
      );

      if (version !== loadVersion) return;

      if (!Array.isArray(data.announcements)) {

        throw new Error(
          "The server did not return an announcement list."
        );
      }


      /* SORT NEWEST ANNOUNCEMENTS FIRST */

      announcements = [...data.announcements]

        .sort((a, b) => {

          const aTime =
            Date.parse(a.created_at) || 0;

          const bTime =
            Date.parse(b.created_at) || 0;

          return bTime - aTime;

        });

      renderAnnouncements();

    } catch (error) {

      if (version !== loadVersion) return;

      announcements = [];

      showHistoryMessage(

        `${error.message} Use Refresh to try again.`,

        true

      );

    } finally {

      if (version === loadVersion) {

        loading = false;

        $("announcementHistory").setAttribute(
          "aria-busy",
          "false"
        );

        updateControls();

      }
    }

  }


  /* ==========================================================
     10. POST ANNOUNCEMENT
  ========================================================== */

  async function postAnnouncement(event) {

    event.preventDefault();

    if (posting || deleting) return;

    const title =
      $("announcementTitle").value.trim();

    const message =
      $("announcementMessage").value.trim();

    $("formError").textContent = "";


    /* VALIDATE FORM */

    if (!title || !message) {

      $("formError").textContent =
        "Please enter both a title and a message.";

      return;
    }

    if (
      title.length > 150 ||
      message.length > 5000
    ) {

      $("formError").textContent =
        "Use up to 150 characters for the title " +
        "and 5000 for the message.";

      return;
    }

    posting = true;

    notice("");

    updateControls();

    try {

      const data = await request(

        "/api/admin/announcements",

        "POST",

        { title, message }

      );

      $("announcementForm").reset();

      notice(
        data.message ||
        "Announcement posted successfully."
      );

      await loadAnnouncements();

    } catch (error) {

      // Preserve the existing announcement draft.

      $("formError").textContent =
        error.message;

    } finally {

      posting = false;

      updateControls();

    }

  }


  /* ==========================================================
     11. OPEN DELETE ANNOUNCEMENT MODAL
  ========================================================== */

  function openDelete(id) {

    if (posting || deleting) return;

    const item = announcements.find(

      announcement =>
        String(announcement.id) === id

    );

    if (!item) return;

    selectedAnnouncement = item;

    $("deleteAnnouncementTitle").textContent =
      item.title || "Untitled announcement";

    $("deleteError").textContent = "";

    $("deleteModal").showModal();

    $("cancelDelete").focus();

  }


  /* ==========================================================
     12. CONFIRM DELETE ANNOUNCEMENT
  ========================================================== */

  async function confirmDelete() {

    if (
      !selectedAnnouncement ||
      deleting ||
      posting
    ) {
      return;
    }

    const id = selectedAnnouncement.id;

    deleting = true;

    $("deleteError").textContent = "";

    notice("");

    updateControls();

    try {

      const data = await request(

        `/api/admin/announcements/${
          encodeURIComponent(id)
        }`,

        "DELETE"

      );

      $("deleteModal").close();

      notice(

        data.message ||
        "Announcement deleted successfully."

      );

      await loadAnnouncements();

    } catch (error) {

      $("deleteError").textContent =
        error.message;

    } finally {

      deleting = false;

      updateControls();

    }

  }


  /* ==========================================================
     13. INITIALIZE ANNOUNCEMENT EVENTS
  ========================================================== */

  function init() {

    /* CHECK ADMIN SESSION */

    if (!localStorage.getItem("adminToken")) {

      logout();

      return;
    }


    /* INITIALIZE UNIFIED LOGOUT MODAL */

    setupLogout();


    /* POST ANNOUNCEMENT */

    $("announcementForm").addEventListener(

      "submit",

      postAnnouncement

    );


    /* REFRESH ANNOUNCEMENTS */

    $("refreshAnnouncements").addEventListener(
      "click",
      () => {

        if (!loading && !posting && !deleting) {

          loadAnnouncements();

        }
      }
    );


    /* DELETE ANNOUNCEMENT BUTTONS */

    $("announcementHistory").addEventListener(
      "click",
      event => {

        const button = event.target.closest(
          ".delete-announcement-btn"
        );

        if (button) {

          openDelete(button.dataset.id);

        }

      }
    );


    /* CONFIRM DELETE */

    $("confirmDelete").addEventListener(

      "click",

      confirmDelete

    );


    /* CANCEL DELETE */

    $("cancelDelete").addEventListener(
      "click",
      () => {

        if (!deleting) {

          $("deleteModal").close();

        }

      }
    );


    /* PREVENT CLOSING DURING DELETION */

    $("deleteModal").addEventListener(
      "cancel",
      event => {

        if (deleting) {

          event.preventDefault();

        }

      }
    );


    /* RESET SELECTED ANNOUNCEMENT */

    $("deleteModal").addEventListener(
      "close",
      () => {

        selectedAnnouncement = null;

      }
    );


    /* LOAD ANNOUNCEMENTS */

    loadAnnouncements();

  }


  /* ==========================================================
     14. DOM READY
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