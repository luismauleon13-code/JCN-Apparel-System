const USERS_API = "http://localhost:5000/api/admin/users";

let selectedUserId = null;
let selectedUnrestrictUserId = null;
let selectedDeleteUserId = null;

/* SUCCESS MODAL */
function showSuccess(message) {
  const modal = document.getElementById("successModal");
  const text = document.getElementById("successMessage");

  const icon = document.querySelector("#successModal i");
  const title = document.querySelector("#successModal h3");

  if (!modal || !text) return;

  text.textContent = message;

  if (icon) {
    icon.className = "fa-solid fa-circle-check";
    icon.style.color = "#22c55e";
  }

  if (title) {
    title.textContent = "Success";
    title.style.color = "#facc15";
  }

  modal.style.display = "flex";
}

function closeSuccessModal() {
  const modal = document.getElementById("successModal");
  if (modal) modal.style.display = "none";
}

/* ERROR */
function showError(message) {
  const modal = document.getElementById("successModal");
  const text = document.getElementById("successMessage");

  const icon = document.querySelector("#successModal i");
  const title = document.querySelector("#successModal h3");

  if (!modal || !text) return;

  text.textContent = message;

  if (icon) {
    icon.className = "fa-solid fa-circle-xmark";
    icon.style.color = "#ef4444";
  }

  if (title) {
    title.textContent = "Delete Failed";
    title.style.color = "#ef4444";
  }

  modal.style.display = "flex";
}

/* GET REMAINING RESTRICTION DAYS */
function getRestrictionDays(user) {
  if (user.status !== "restricted" || !user.restriction_until) return "";

  const now = new Date();
  const until = new Date(user.restriction_until);
  const diff = until - now;

  const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) return "Restriction expired";

  return `${daysLeft} day(s) left`;
}

/* LOAD USERS */
async function loadUsers() {
  const tableBody = document.getElementById("usersTableBody");
  if (!tableBody) return;

  try {
    const res = await fetch(USERS_API);
    const data = await res.json();

    tableBody.innerHTML = "";

    if (!data.success || !data.users || data.users.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-secondary py-4">
            No registered users yet.
          </td>
        </tr>
      `;
      return;
    }

    data.users.forEach(user => {
      const name = user.full_name || user.username || "Unknown User";
      const email = user.email || "No Email";
      const status = user.status || "active";

      const initials = name
        .split(" ")
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      tableBody.innerHTML += `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-3">
              <div class="user-avatar">${initials}</div>
              <span class="text-light fw-semibold">${name}</span>
            </div>
          </td>

          <td class="text-secondary">${email}</td>

          <td class="text-secondary">${user.phone || "N/A"}</td>

          <td>
            <span class="badge-role role-user">Customer</span>
          </td>

          <td>
            ${
              status === "restricted"
                ? `
                  <span class="text-danger small fw-bold d-block">
                    <i class="fa-solid fa-circle status-indicator"></i>
                    Restricted
                  </span>

                  <small class="text-warning d-block mt-1">
                    ${getRestrictionDays(user)}
                  </small>

                  <small class="text-secondary d-block">
                    ${user.restriction_reason || "No reason provided"}
                  </small>
                `
                : `
                  <span class="text-success small fw-bold">
                    <i class="fa-solid fa-circle status-indicator"></i>
                    Active
                  </span>
                `
            }
          </td>

          <td class="text-end">
            ${
              status === "restricted"
                ? `
                  <button
                    onclick="openUnrestrictModal('${user.id}')"
                    class="btn btn-sm text-success"
                    title="Unrestrict User"
                  >
                    <i class="fa-solid fa-unlock"></i>
                  </button>
                `
                : `
                  <button
                    onclick="openRestrictModal('${user.id}')"
                    class="btn btn-sm text-gold"
                    title="Restrict User"
                  >
                    <i class="fa-solid fa-ban"></i>
                  </button>
                `
            }

            <button
              onclick="openDeleteModal('${user.id}')"
              class="btn btn-sm text-danger ms-2"
              title="Delete User"
            >
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    });

  } catch (error) {
    console.error("Load users error:", error);

    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-danger py-4">
          Cannot load users. Make sure backend is running.
        </td>
      </tr>
    `;
  }
}

/* RESTRICT MODAL */
function openRestrictModal(id) {
  selectedUserId = id;

  const input = document.getElementById("restrictDays");
  const modal = document.getElementById("restrictModal");

  if (input) input.value = "";
  if (modal) modal.style.display = "flex";
}

function closeRestrictModal() {
  selectedUserId = null;

  const modal = document.getElementById("restrictModal");
  if (modal) modal.style.display = "none";
}

document.getElementById("confirmRestrict")?.addEventListener("click", async () => {
  const input = document.getElementById("restrictDays");
  const days = input?.value.trim();

  if (!selectedUserId) {
    showError("No user selected.");
    return;
  }

  if (!days || Number(days) <= 0 || isNaN(Number(days))) {
    showError("Please enter a valid number of days.");
    input?.focus();
    return;
  }

  try {
    const res = await fetch(`${USERS_API}/${selectedUserId}/restrict`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        days: Number(days),
        reason: "Violation"
      })
    });

    const data = await res.json();

    closeRestrictModal();
    showSuccess(data.message || `User restricted for ${days} day(s).`);
    loadUsers();

  } catch (error) {
    console.error("Restrict user error:", error);
    showError("Cannot restrict user.");
  }
});

document.getElementById("cancelRestrict")?.addEventListener("click", closeRestrictModal);

document.getElementById("restrictModal")?.addEventListener("click", e => {
  if (e.target.id === "restrictModal") closeRestrictModal();
});

/* UNRESTRICT MODAL */
function openUnrestrictModal(id) {
  selectedUnrestrictUserId = id;

  const modal = document.getElementById("unrestrictModal");
  if (modal) modal.style.display = "flex";
}

function closeUnrestrictModal() {
  selectedUnrestrictUserId = null;

  const modal = document.getElementById("unrestrictModal");
  if (modal) modal.style.display = "none";
}

document.getElementById("confirmUnrestrict")?.addEventListener("click", async () => {
  if (!selectedUnrestrictUserId) {
    showError("No user selected.");
    return;
  }

  try {
    const res = await fetch(`${USERS_API}/${selectedUnrestrictUserId}/unrestrict`, {
      method: "PATCH"
    });

    const data = await res.json();

    closeUnrestrictModal();
    showSuccess(data.message || "User unrestricted successfully.");
    loadUsers();

  } catch (error) {
    console.error("Unrestrict user error:", error);
    showError("Cannot unrestrict user.");
  }
});

document.getElementById("cancelUnrestrict")?.addEventListener("click", closeUnrestrictModal);

document.getElementById("unrestrictModal")?.addEventListener("click", e => {
  if (e.target.id === "unrestrictModal") closeUnrestrictModal();
});

/* DELETE MODAL */
function openDeleteModal(id) {
  selectedDeleteUserId = id;

  const modal = document.getElementById("deleteModal");
  if (modal) modal.style.display = "flex";
}

function closeDeleteModal() {
  selectedDeleteUserId = null;

  const modal = document.getElementById("deleteModal");
  if (modal) modal.style.display = "none";
}

document.getElementById("confirmDelete")?.addEventListener("click", async () => {
  if (!selectedDeleteUserId) {
    showError("No user selected.");
    return;
  }

  try {
    const res = await fetch(`${USERS_API}/${selectedDeleteUserId}`, {
      method: "DELETE"
    });

    const data = await res.json();

    console.log("DELETE RESPONSE:", data);

    closeDeleteModal();

    if (!res.ok || data.success === false) {
      showError(data.message || "Delete failed.");
      return;
    }

    showSuccess(data.message || "User deleted successfully.");
    loadUsers();

  } catch (error) {
    console.error("Delete user error:", error);
    showError("Cannot delete user.");
  }
});

document.getElementById("cancelDelete")?.addEventListener("click", closeDeleteModal);

document.getElementById("deleteModal")?.addEventListener("click", e => {
  if (e.target.id === "deleteModal") closeDeleteModal();
});

/* SUCCESS BUTTON */
document.getElementById("closeSuccessModal")?.addEventListener("click", closeSuccessModal);

/* LOAD USERS */
loadUsers();

/* LOGOUT MODAL */
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminLogoutModal = document.getElementById("adminLogoutModal");
const adminConfirmLogout = document.getElementById("adminConfirmLogout");
const adminCancelLogout = document.getElementById("adminCancelLogout");

adminLogoutBtn?.addEventListener("click", () => {
  adminLogoutModal.classList.remove("hidden");
});

adminCancelLogout?.addEventListener("click", () => {
  adminLogoutModal.classList.add("hidden");
});

adminConfirmLogout?.addEventListener("click", () => {
  localStorage.removeItem("admin");
  localStorage.removeItem("adminToken");
  window.location.href = "index.html";
});