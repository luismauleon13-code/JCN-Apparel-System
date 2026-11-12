"use strict";

(() => {
  const API_BASE = "http://localhost:5000";
  const LOGIN_PAGE = "admin-login.html";

  const $ = id => document.getElementById(id);

  let announcements = [];
  let selectedAnnouncement = null;

  let loading = false;
  let posting = false;
  let deleting = false;

  // Used to ignore an older list response after a successful change.
  let loadVersion = 0;

  function logout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("admin");

    window.location.replace(LOGIN_PAGE);
  }

  async function request(path, method = "GET", body) {
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
        "Cannot reach the server. Make sure Node.js is running on port 5000."
      );
    }

    if (response.status === 401) {
      logout();
      throw new Error("Session expired. Please log in again.");
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The server returned an unexpected response. Check the announcements API."
      );
    }

    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.message || "The announcement request failed."
      );
    }

    return data;
  }

  function notice(message) {
    $("pageNotice").textContent = message;
  }

  function updateControls() {
    const mutationBusy = posting || deleting;

    $("postAnnouncementBtn").disabled = mutationBusy;
    $("announcementTitle").disabled = mutationBusy;
    $("announcementMessage").disabled = mutationBusy;

    $("refreshAnnouncements").disabled = loading || mutationBusy;
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

  function showHistoryMessage(message, isError = false) {
    const paragraph = document.createElement("p");

    paragraph.className = isError ? "empty error" : "empty";
    paragraph.textContent = message;

    $("announcementHistory").replaceChildren(paragraph);
  }

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
      const article = document.createElement("article");
      article.className = "announcement-item";

      const icon = document.createElement("div");
      icon.className = "announcement-icon";

      // Static markup only; database content uses textContent.
      icon.innerHTML =
        '<i class="fa-solid fa-bullhorn" aria-hidden="true"></i>';

      const content = document.createElement("div");
      content.className = "announcement-content";

      const header = document.createElement("div");
      header.className = "announcement-header";

      const headingGroup = document.createElement("div");

      const title = document.createElement("h3");
      title.className = "announcement-title";
      title.textContent = item.title || "Untitled announcement";

      const date = document.createElement("time");
      date.className = "announcement-date";

      const createdAt = item.created_at
        ? new Date(item.created_at)
        : null;

      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        date.dateTime = createdAt.toISOString();
        date.textContent = createdAt.toLocaleString("en-PH", {
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

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-announcement-btn";
      deleteButton.dataset.id = String(item.id);
      deleteButton.title = "Delete announcement";
      deleteButton.setAttribute(
        "aria-label",
        `Delete announcement: ${item.title || "Untitled announcement"}`
      );
      deleteButton.innerHTML =
        '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';

      header.append(headingGroup, deleteButton);

      const message = document.createElement("p");
      message.className = "announcement-message";
      message.textContent = item.message || "";

      content.append(header, message);
      article.append(icon, content);
      fragment.append(article);
    });

    history.append(fragment);
    updateControls();
  }

  async function loadAnnouncements() {
    const version = ++loadVersion;

    loading = true;
    updateControls();

    $("announcementHistory").setAttribute("aria-busy", "true");
    $("historyCount").textContent = "";
    showHistoryMessage("Loading announcements…");

    try {
      const data = await request("/api/announcements");

      if (version !== loadVersion) return;

      if (!Array.isArray(data.announcements)) {
        throw new Error(
          "The server did not return an announcement list."
        );
      }

      announcements = [...data.announcements].sort((a, b) => {
        const aTime = Date.parse(a.created_at) || 0;
        const bTime = Date.parse(b.created_at) || 0;

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
        $("announcementHistory").setAttribute("aria-busy", "false");
        updateControls();
      }
    }
  }

  async function postAnnouncement(event) {
    event.preventDefault();

    if (posting || deleting) return;

    const title = $("announcementTitle").value.trim();
    const message = $("announcementMessage").value.trim();

    $("formError").textContent = "";

    if (!title || !message) {
      $("formError").textContent =
        "Please enter both a title and a message.";
      return;
    }

    if (title.length > 150 || message.length > 5000) {
      $("formError").textContent =
        "Use up to 150 characters for the title and 5000 for the message.";
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
        data.message || "Announcement posted successfully."
      );

      await loadAnnouncements();
    } catch (error) {
      // Keep the draft so the user does not lose their text.
      $("formError").textContent = error.message;
    } finally {
      posting = false;
      updateControls();
    }
  }

  function openDelete(id) {
    if (posting || deleting) return;

    const item = announcements.find(
      announcement => String(announcement.id) === id
    );

    if (!item) return;

    selectedAnnouncement = item;

    $("deleteAnnouncementTitle").textContent =
      item.title || "Untitled announcement";

    $("deleteError").textContent = "";
    $("deleteModal").showModal();
    $("cancelDelete").focus();
  }

  async function confirmDelete() {
    if (!selectedAnnouncement || deleting || posting) return;

    const id = selectedAnnouncement.id;

    deleting = true;
    $("deleteError").textContent = "";
    notice("");
    updateControls();

    try {
      const data = await request(
        `/api/admin/announcements/${encodeURIComponent(id)}`,
        "DELETE"
      );

      $("deleteModal").close();

      notice(
        data.message || "Announcement deleted successfully."
      );

      await loadAnnouncements();
    } catch (error) {
      $("deleteError").textContent = error.message;
    } finally {
      deleting = false;
      updateControls();
    }
  }

  function init() {
    if (!localStorage.getItem("adminToken")) {
      logout();
      return;
    }

    $("announcementForm").addEventListener(
      "submit",
      postAnnouncement
    );

    $("refreshAnnouncements").addEventListener("click", () => {
      if (!loading && !posting && !deleting) {
        loadAnnouncements();
      }
    });

    $("announcementHistory").addEventListener("click", event => {
      const button = event.target.closest(
        ".delete-announcement-btn"
      );

      if (button) openDelete(button.dataset.id);
    });

    $("confirmDelete").addEventListener("click", confirmDelete);

    $("cancelDelete").addEventListener("click", () => {
      if (!deleting) $("deleteModal").close();
    });

    $("deleteModal").addEventListener("cancel", event => {
      if (deleting) event.preventDefault();
    });

    $("deleteModal").addEventListener("close", () => {
      selectedAnnouncement = null;
    });

    $("adminLogoutBtn").addEventListener("click", () => {
      $("adminLogoutModal").showModal();
      $("adminCancelLogout").focus();
    });

    $("adminCancelLogout").addEventListener("click", () => {
      $("adminLogoutModal").close();
    });

    $("adminConfirmLogout").addEventListener("click", logout);

    loadAnnouncements();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();