const API_URL = "http://localhost:5000";

let announcements = [];
let readAnnouncements =
  JSON.parse(localStorage.getItem("readAnnouncements")) || [];

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  loadAnnouncements();

  document.getElementById("logoutBtn")
    .addEventListener("click", logoutCustomer);
});

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    alert("Please login first.");
    window.location.href = "user-login.html";
  }
}

async function loadAnnouncements() {
  const announcementList =
    document.getElementById("announcementList");

  try {

    const res = await fetch(
      `${API_URL}/api/announcements`
    );

    const data = await res.json();

    if (!data.success) {
      announcementList.innerHTML =
        `<p class="empty">${data.message}</p>`;
      return;
    }

    announcements = data.announcements || [];

    document.getElementById("announcementCount")
      .textContent = announcements.length;

    displayAnnouncements();

  } catch (error) {

    console.error(error);

    announcementList.innerHTML =
      `<p class="empty">Cannot connect to server.</p>`;
  }
}

function displayAnnouncements() {

  const announcementList =
    document.getElementById("announcementList");

  if (!announcements.length) {
    announcementList.innerHTML =
      `<p class="empty">No announcements yet.</p>`;
    return;
  }

  announcementList.innerHTML = "";

  announcements.forEach((item, index) => {

    const isRead =
      readAnnouncements.includes(item.id);

    announcementList.innerHTML += `
      <div class="announcement-card ${!isRead ? "unread" : ""}"
           onclick="openAnnouncement(${index})">

        <h3>${item.title}</h3>

        <p>
          ${(item.message || "")
            .substring(0, 80)}...
        </p>

        <small>
          ${formatDate(item.created_at)}
        </small>

      </div>
    `;
  });
}

function openAnnouncement(index) {

  const item = announcements[index];

  const isRead =
    readAnnouncements.includes(item.id);

  document.getElementById("announcementDetails")
    .innerHTML = `

      <h2 class="detail-title">
        ${item.title}
      </h2>

      <p class="detail-date">
        ${formatDate(item.created_at)}
      </p>

      <div class="detail-message">
        ${item.message}
      </div>

      <button
        class="mark-btn ${isRead ? "read" : ""}"
        onclick="markAsRead('${item.id}')"
        ${isRead ? "disabled" : ""}
      >
        ${isRead ? "Already Read" : "Mark as Read"}
      </button>
    `;
}

function markAsRead(id) {

  if (!readAnnouncements.includes(id)) {

    readAnnouncements.push(id);

    localStorage.setItem(
      "readAnnouncements",
      JSON.stringify(readAnnouncements)
    );
  }

  displayAnnouncements();

  const item =
    announcements.find(a => a.id == id);

  if (item) {

    document.getElementById("announcementDetails")
      .innerHTML = `

      <h2 class="detail-title">
        ${item.title}
      </h2>

      <p class="detail-date">
        ${formatDate(item.created_at)}
      </p>

      <div class="detail-message">
        ${item.message}
      </div>

      <button class="mark-btn read" disabled>
        Already Read
      </button>
    `;
  }
}

function formatDate(date) {

  if (!date) return "N/A";

  return new Date(date)
    .toLocaleString();
}

function logoutCustomer() {

  if (!confirm(
    "Are you sure you want to logout?"
  )) return;

  localStorage.removeItem("customerToken");
  localStorage.removeItem("customerUser");
  localStorage.removeItem("customerCart");

  window.location.href =
    "user-login.html";
}