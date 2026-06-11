/* =============================
   ANNOUNCEMENTS
============================= */

const announcementTitle = document.getElementById("announcementTitle");
const announcementMessage = document.getElementById("announcementMessage");
const postAnnouncementBtn = document.getElementById("postAnnouncementBtn");
const announcementHistory = document.getElementById("announcementHistory");

async function loadAnnouncements() {
  if (!announcementHistory) return;

  const res = await fetch("http://localhost:5000/api/announcements");
  const data = await res.json();

  announcementHistory.innerHTML = "";

  if (!data.success || data.announcements.length === 0) {
    announcementHistory.innerHTML = `
      <p class="text-secondary">No announcements yet.</p>
    `;
    return;
  }
  

  data.announcements.forEach(item => {
  announcementHistory.innerHTML += `
  <div class="announcement-item">

    <div class="announcement-icon">
      <i class="fa-solid fa-bullhorn"></i>
    </div>

    <div class="announcement-content">
      <div class="announcement-header">

        <h6 class="announcement-title">
          ${item.title}
        </h6>

        <div class="announcement-actions">

          <span class="announcement-date">
            ${new Date(item.created_at).toLocaleString()}
          </span>

          <button
            class="delete-announcement-btn"
            onclick="deleteAnnouncement('${item.id}')"
            title="Delete Announcement">
            <i class="fa-solid fa-trash"></i>
          </button>

        </div>

      </div>

      <p class="announcement-message">
        ${item.message}
      </p>
    </div>

  </div>
`;
});
}

postAnnouncementBtn?.addEventListener("click", async () => {
  const title = announcementTitle.value.trim();
  const message = announcementMessage.value.trim();

  if (!title || !message) {
    alert("Please enter title and message.");
    return;
  }

  const res = await fetch("http://localhost:5000/api/admin/announcements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      message
    })
  });

  const data = await res.json();

  if (data.success) {
    alert("Announcement posted.");

    announcementTitle.value = "";
    announcementMessage.value = "";

    loadAnnouncements();
  } else {
    alert(data.message);
  }
});

async function deleteAnnouncement(id) {
  const result = await Swal.fire({
    title: "Delete Announcement",
    html: `
      <div class="delete-warning-icon">
        <i class="fa-solid fa-bullhorn"></i>
      </div>
      <p class="delete-warning-text">
        Are you sure you want to permanently delete this announcement?
      </p>
    `,
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
    customClass: {
      popup: "premium-delete-popup",
      title: "premium-delete-title",
      confirmButton: "premium-delete-confirm",
      cancelButton: "premium-delete-cancel"
    },
    buttonsStyling: false
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(
      `http://localhost:5000/api/admin/announcements/${id}`,
      {
        method: "DELETE"
      }
    );

    const data = await res.json();

    if (!res.ok || !data.success) {
      await Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: data.message || "Failed to delete announcement.",
        confirmButtonText: "OK",
        customClass: {
          popup: "jcn-alert-popup",
          title: "jcn-error-title",
          confirmButton: "jcn-alert-btn"
        },
        buttonsStyling: false
      });
      return;
    }

    await Swal.fire({
      icon: "success",
      title: "Deleted",
      text: "Announcement deleted successfully.",
      confirmButtonText: "OK",
      customClass: {
        popup: "jcn-alert-popup",
        title: "jcn-success-title",
        confirmButton: "jcn-alert-btn"
      },
      buttonsStyling: false
    });

    loadAnnouncements();

  } catch (error) {
    console.error(error);

    await Swal.fire({
      icon: "error",
      title: "Server Error",
      text: "Unable to delete announcement.",
      confirmButtonText: "OK",
      customClass: {
        popup: "jcn-alert-popup",
        title: "jcn-error-title",
        confirmButton: "jcn-alert-btn"
      },
      buttonsStyling: false
    });
  }
}

loadAnnouncements();


/*logout modal*/
document.addEventListener("DOMContentLoaded", () => {
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  const adminLogoutModal = document.getElementById("adminLogoutModal");
  const adminConfirmLogout = document.getElementById("adminConfirmLogout");
  const adminCancelLogout = document.getElementById("adminCancelLogout");

  adminLogoutBtn?.addEventListener("click", () => {
    adminLogoutModal?.classList.remove("hidden");
  });

  adminCancelLogout?.addEventListener("click", () => {
    adminLogoutModal?.classList.add("hidden");
  });

  adminConfirmLogout?.addEventListener("click", () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    window.location.href = "index.html";
  });
});