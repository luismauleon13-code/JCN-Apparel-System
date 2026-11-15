/* =========================================
   JCN CUSTOMER NOTIFICATIONS
   Responsive sidebar + announcements
========================================= */

const API_URL = "";
let announcements = [];
let readAnnouncements = [];
let selectedAnnouncementId = null;

function getNotificationUser() {
  try {
    return JSON.parse(localStorage.getItem("customerUser") || "null");
  } catch (error) {
    console.warn("Invalid stored customer user", error);
    return null;
  }
}

function notificationReadKey() {
  const user = getNotificationUser();
  return `readAnnouncements_${user?.id || user?.email || "guest"}`;
}

function loadReadAnnouncements() {
  try {
    const stored = JSON.parse(localStorage.getItem(notificationReadKey()) || "[]");
    readAnnouncements = Array.isArray(stored) ? stored.map(String) : [];
  } catch (error) {
    readAnnouncements = [];
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!checkLogin()) return;
  loadReadAnnouncements();
  setupNotificationsMobileMenu();
  setupNotificationLogout();
  loadAnnouncements();
});

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = getNotificationUser();
  if (!token || !user) {
    window.location.replace("user-login.html");
    return false;
  }
  return true;
}

async function loadAnnouncements() {
  const list = document.getElementById("announcementList");
  if (!list) return;

  list.innerHTML = '<p class="empty">Loading announcements...</p>';

  try {
    const res = await fetch(`${API_URL}/api/announcements`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Could not load announcements.");

    announcements = Array.isArray(data.announcements) ? data.announcements : [];
    displayAnnouncements();

    if (selectedAnnouncementId !== null) {
      const index = announcements.findIndex(a => String(a.id) === String(selectedAnnouncementId));
      if (index >= 0) openAnnouncement(index);
    }
  } catch (error) {
    console.error("Notifications load error:", error);
    list.innerHTML = '<p class="empty">Cannot load announcements right now. Please try again.</p>';
    updateAnnouncementCount();
  }
}

function updateAnnouncementCount() {
  const count = document.getElementById("announcementCount");
  if (count) count.textContent = String(announcements.length);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  if (!date) return "N/A";
  const value = new Date(date);
  return Number.isNaN(value.getTime())
    ? "N/A"
    : value.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function displayAnnouncements() {
  const list = document.getElementById("announcementList");
  if (!list) return;
  updateAnnouncementCount();
  list.replaceChildren();

  if (!announcements.length) {
    list.innerHTML = '<p class="empty">No announcements yet.</p>';
    return;
  }

  announcements.forEach((item, index) => {
    const id = String(item.id);
    const read = readAnnouncements.includes(id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `announcement-card${read ? "" : " unread"}${id === String(selectedAnnouncementId) ? " selected" : ""}`;
    const message = String(item.message || "");
    const excerpt = message.length > 80 ? `${message.slice(0, 80)}…` : message;
    button.innerHTML = `
      <h3>${escapeHtml(item.title || "Announcement")}</h3>
      <p>${escapeHtml(excerpt)}</p>
      <small>${escapeHtml(formatDate(item.created_at))}</small>
    `;
    button.addEventListener("click", () => openAnnouncement(index));
    list.appendChild(button);
  });
}

function openAnnouncement(index) {
  const item = announcements[index];
  const details = document.getElementById("announcementDetails");
  if (!item || !details) return;

  selectedAnnouncementId = String(item.id);
  const read = readAnnouncements.includes(selectedAnnouncementId);
  details.innerHTML = `
    <h2 class="detail-title">${escapeHtml(item.title || "Announcement")}</h2>
    <p class="detail-date">${escapeHtml(formatDate(item.created_at))}</p>
    <div class="detail-message">${escapeHtml(item.message || "").replace(/\r?\n/g, "<br>")}</div>
    <button type="button" class="mark-btn${read ? " read" : ""}" ${read ? "disabled" : ""}>
      ${read ? "Already Read" : "Mark as Read"}
    </button>
  `;
  const markButton = details.querySelector(".mark-btn");
  if (markButton && !read) markButton.addEventListener("click", () => markAsRead(item.id));
  displayAnnouncements();

  if (window.innerWidth <= 800) {
    details.closest(".details-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function markAsRead(id) {
  const normalized = String(id);
  if (!readAnnouncements.includes(normalized)) {
    readAnnouncements.push(normalized);
    localStorage.setItem(notificationReadKey(), JSON.stringify(readAnnouncements));
  }
  const index = announcements.findIndex(a => String(a.id) === normalized);
  if (index >= 0) openAnnouncement(index);
}

function setupNotificationsMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const main = document.querySelector(".main");
  if (!sidebar || !main || sidebar.dataset.notificationsMenuInitialized === "true") return;
  sidebar.dataset.notificationsMenuInitialized = "true";

  let bar = document.querySelector(".jcn-notifications-mobile-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "jcn-notifications-mobile-bar";
    bar.innerHTML = `
      <button type="button" class="jcn-notifications-menu-toggle" aria-label="Open navigation menu" aria-expanded="false">
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
      </button>
      <span class="jcn-notifications-mobile-logo">J</span>
      <span class="jcn-notifications-mobile-name">JCN Apparel</span>
    `;
    main.prepend(bar);
  }

  let toggle = bar.querySelector(".jcn-notifications-menu-toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "jcn-notifications-menu-toggle";
    toggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    toggle.setAttribute("aria-label", "Open navigation menu");
    bar.prepend(toggle);
  }
  if (!sidebar.id) sidebar.id = "jcnNotificationsSidebar";
  toggle.setAttribute("aria-controls", sidebar.id);

  let closeButton = sidebar.querySelector(".jcn-notifications-sidebar-close");
  if (!closeButton) {
    closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "jcn-notifications-sidebar-close";
    closeButton.setAttribute("aria-label", "Close navigation menu");
    closeButton.innerHTML = "&times;";
    sidebar.prepend(closeButton);
  }

  let overlay = document.querySelector(".jcn-notifications-menu-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "jcn-notifications-menu-overlay";
    document.body.appendChild(overlay);
  }

  function setOpen(open) {
    const shouldOpen = open && window.innerWidth <= 800;
    document.body.classList.toggle("jcn-notifications-menu-open", shouldOpen);
    toggle.setAttribute("aria-expanded", String(shouldOpen));
    toggle.setAttribute("aria-label", shouldOpen ? "Close navigation menu" : "Open navigation menu");
    overlay.setAttribute("aria-hidden", String(!shouldOpen));
  }

  toggle.addEventListener("click", event => {
    event.preventDefault();
    setOpen(!document.body.classList.contains("jcn-notifications-menu-open"));
  });
  closeButton.addEventListener("click", () => setOpen(false));
  overlay.addEventListener("click", () => setOpen(false));
  sidebar.querySelectorAll(".menu a").forEach(link => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") setOpen(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 800) setOpen(false);
  });
}

function setupNotificationLogout() {
  const btn = document.getElementById("logoutBtn");
  if (!btn || btn.dataset.notificationsLogoutInitialized === "true") return;
  btn.dataset.notificationsLogoutInitialized = "true";
  btn.addEventListener("click", logoutCustomer);
}

async function logoutCustomer(event) {
  event?.preventDefault();
  const modal = document.querySelector(".customer-logout-modal");
  if (modal) {
    modal.classList.remove("hidden");
    const cancel = modal.querySelector(".modal-cancel-btn");
    const confirm = modal.querySelector(".modal-confirm-btn");
    const overlay = modal.querySelector(".modal-overlay");
    if (!modal.dataset.notificationsLogoutInitialized) {
      modal.dataset.notificationsLogoutInitialized = "true";
      const hide = () => modal.classList.add("hidden");
      cancel?.addEventListener("click", hide);
      overlay?.addEventListener("click", hide);
      confirm?.addEventListener("click", performNotificationLogout);
    }
    return;
  }

  if (typeof Swal !== "undefined") {
    const answer = await Swal.fire({
      title: "Logout?",
      text: "Are you sure you want to logout?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Logout"
    });
    if (!answer.isConfirmed) return;
  } else if (!window.confirm("Are you sure you want to logout?")) {
    return;
  }
  performNotificationLogout();
}

function performNotificationLogout() {
  localStorage.removeItem("customerToken");
  localStorage.removeItem("customerUser");
  window.location.href = "user-login.html";
}
