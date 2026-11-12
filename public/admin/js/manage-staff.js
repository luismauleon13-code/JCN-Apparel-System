/* =========================================================
   JCN ADMIN - MANAGE STAFF
   manage-staff.js
========================================================= */

const API_BASE_URL = "http://localhost:5000";
const STAFF_API = `${API_BASE_URL}/api/admin/staff`;

let allStaff = [];

/* =========================================================
   AUTH
========================================================= */

function getAdminToken() {
  return localStorage.getItem("adminToken");
}

function getAuthHeaders() {
  const token = getAdminToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

function checkAdminSession() {
  const token = getAdminToken();

  if (!token) {
    window.location.href = "admin-login.html";
    return false;
  }

  return true;
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   FORMAT ROLE
========================================================= */

function formatRole(role) {
  switch (role) {
    case "inventory_staff":
      return "Inventory Staff";

    case "graphic_designer":
      return "Graphic Designer";

    case "cashier":
      return "Cashier";

    case "admin":
      return "Admin";

    default:
      return role || "Unknown";
  }
}

/* =========================================================
   FORMAT STATUS
========================================================= */

function formatStatus(status) {
  switch (status) {
    case "active":
      return "Active";

    case "inactive":
      return "Inactive";

    case "restricted":
      return "Restricted";

    default:
      return status || "Unknown";
  }
}

/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(dateValue) {
  if (!dateValue) {
    return "Never";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

/* =========================================================
   GET ELEMENT HELPER
========================================================= */

function getElement(...ids) {
  for (const id of ids) {
    const element = document.getElementById(id);

    if (element) {
      return element;
    }
  }

  return null;
}

/* =========================================================
   LOAD STAFF FROM NODE.JS
========================================================= */

async function loadStaff() {
  if (!checkAdminSession()) {
    return;
  }

  const tableBody = getElement(
    "staffTableBody",
    "staffTable"
  );

  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="staff-empty-state">
            <i class="fa-solid fa-spinner fa-spin"></i>

            <h5>Loading staff accounts...</h5>

            <p>
              Please wait while staff information is being loaded.
            </p>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const response = await fetch(STAFF_API, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${getAdminToken()}`
      }
    });

    const data = await response.json();

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    if (response.status === 403) {
      throw new Error(
        data.message ||
        "You do not have permission to manage staff."
      );
    }

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message ||
        "Unable to load staff accounts."
      );
    }

    allStaff = Array.isArray(data.staff)
      ? data.staff
      : [];

    updateStaffCounts(
      data.counts || calculateCounts(allStaff)
    );

    filterStaff();

  } catch (error) {
    console.error("LOAD STAFF ERROR:", error);

    allStaff = [];

    updateStaffCounts(
      calculateCounts([])
    );

    displayStaff([]);

    await Swal.fire({
      icon: "error",

      title: "Unable to Load Staff",

      text:
        error.message ||
        "Cannot connect to the server.",

      confirmButtonText: "OK"
    });
  }
}

/* =========================================================
   CALCULATE COUNTS
========================================================= */

function calculateCounts(staffList) {
  return {
    total: staffList.length,

    inventory: staffList.filter(
      staff =>
        staff.role === "inventory_staff"
    ).length,

    designers: staffList.filter(
      staff =>
        staff.role === "graphic_designer"
    ).length,

    cashiers: staffList.filter(
      staff =>
        staff.role === "cashier"
    ).length
  };
}

/* =========================================================
   UPDATE DASHBOARD COUNTS
========================================================= */

function updateStaffCounts(counts) {
  const totalStaff =
    getElement("totalStaffCount");

  const inventoryStaff =
    getElement("inventoryStaffCount");

  const designerStaff =
    getElement(
      "designerStaffCount",
      "graphicDesignerCount"
    );

  const cashierStaff =
    getElement("cashierStaffCount");

  if (totalStaff) {
    totalStaff.textContent =
      Number(counts?.total || 0);
  }

  if (inventoryStaff) {
    inventoryStaff.textContent =
      Number(counts?.inventory || 0);
  }

  if (designerStaff) {
    designerStaff.textContent =
      Number(counts?.designers || 0);
  }

  if (cashierStaff) {
    cashierStaff.textContent =
      Number(counts?.cashiers || 0);
  }
}

/* =========================================================
   DISPLAY STAFF
========================================================= */

function displayStaff(staffList) {
  const tableBody = getElement(
    "staffTableBody",
    "staffTable"
  );

  if (!tableBody) {
    console.error(
      "Staff table body was not found."
    );

    return;
  }

  tableBody.innerHTML = "";

  if (!staffList || staffList.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="staff-empty-state">

            <div class="empty-icon">
              <i class="fa-solid fa-users"></i>
            </div>

            <h5>
              No staff accounts yet
            </h5>

            <p>
              Create your first Inventory Staff,
              Graphic Designer, or Cashier account.
            </p>

          </div>
        </td>
      </tr>
    `;

    return;
  }

  staffList.forEach(staff => {
    const row =
      document.createElement("tr");

    const fullName =
      escapeHTML(
        staff.full_name ||
        staff.username ||
        "Unnamed Staff"
      );

    const username =
      escapeHTML(
        staff.username || "-"
      );

    const email =
      escapeHTML(
        staff.email || "-"
      );

    const role =
      escapeHTML(
        formatRole(staff.role)
      );

    const status =
      String(
        staff.status || "inactive"
      ).toLowerCase();

    const statusText =
      escapeHTML(
        formatStatus(status)
      );

    const lastLogin =
      escapeHTML(
        formatDate(staff.last_login_at)
      );

    row.innerHTML = `
      <td>

        <div class="staff-profile">

          <div class="staff-avatar">
            <i class="fa-solid fa-user"></i>
          </div>

          <div class="staff-details">

            <strong>
              ${fullName}
            </strong>

            <small>
              ${email}
            </small>

          </div>

        </div>

      </td>

      <td>
        <span class="staff-username">
          @${username}
        </span>
      </td>

      <td>
        <span class="role-badge role-${escapeHTML(staff.role)}">
          ${role}
        </span>
      </td>

      <td>
        <span class="status-badge status-${escapeHTML(status)}">
          <span class="status-dot"></span>
          ${statusText}
        </span>
      </td>

      <td>
        <span class="last-login">
          ${lastLogin}
        </span>
      </td>

      <td>

        <div class="staff-actions">

          <button
            type="button"
            class="staff-action-btn edit"
            title="Edit Staff"
            onclick="editStaff('${escapeHTML(staff.id)}')"
          >
            <i class="fa-solid fa-pen"></i>
          </button>

          <button
            type="button"
            class="staff-action-btn status"
            title="Change Status"
            onclick="changeStaffStatus('${escapeHTML(staff.id)}')"
          >
            <i class="fa-solid fa-user-shield"></i>
          </button>

          <button
            type="button"
            class="staff-action-btn password"
            title="Reset Password"
            onclick="resetStaffPassword('${escapeHTML(staff.id)}')"
          >
            <i class="fa-solid fa-key"></i>
          </button>

          <button
            type="button"
            class="staff-action-btn delete"
            title="Delete Staff"
            onclick="deleteStaff('${escapeHTML(staff.id)}')"
          >
            <i class="fa-solid fa-trash"></i>
          </button>

        </div>

      </td>
    `;

    tableBody.appendChild(row);
  });
}

/* =========================================================
   FILTER STAFF
========================================================= */

function filterStaff() {
  const searchInput =
    getElement(
      "staffSearch",
      "searchStaff"
    );

  const roleFilter =
    getElement(
      "roleFilter",
      "staffRoleFilter"
    );

  const statusFilter =
    getElement(
      "statusFilter",
      "staffStatusFilter"
    );

  const search =
    searchInput?.value
      ?.trim()
      .toLowerCase() || "";

  const role =
    roleFilter?.value || "all";

  const status =
    statusFilter?.value || "all";

  const filtered =
    allStaff.filter(staff => {
      const searchableText = `
        ${staff.full_name || ""}
        ${staff.username || ""}
        ${staff.email || ""}
        ${formatRole(staff.role)}
      `.toLowerCase();

      const matchesSearch =
        searchableText.includes(search);

      const matchesRole =
        role === "all" ||
        role === "" ||
        staff.role === role;

      const matchesStatus =
        status === "all" ||
        status === "" ||
        staff.status === status;

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });

  displayStaff(filtered);
}

/* =========================================================
   CREATE STAFF
========================================================= */

async function createStaff(event) {
  event.preventDefault();

  const fullName =
    getElement("staffFullName")
      ?.value
      .trim();

  const username =
    getElement("staffUsername")
      ?.value
      .trim();

  const email =
    getElement("staffEmail")
      ?.value
      .trim();

  const role =
    getElement("staffRole")
      ?.value;

  const password =
    getElement("staffPassword")
      ?.value;

  const confirmPassword =
    getElement(
      "staffConfirmPassword"
    )?.value;

  const status =
    getElement("staffStatus")
      ?.value || "active";

  if (
    !fullName ||
    !username ||
    !email ||
    !role ||
    !password ||
    !confirmPassword
  ) {
    await Swal.fire({
      icon: "warning",

      title: "Incomplete Information",

      text:
        "Please complete all required fields."
    });

    return;
  }

  const allowedRoles = [
    "inventory_staff",
    "graphic_designer",
    "cashier"
  ];

  if (!allowedRoles.includes(role)) {
    await Swal.fire({
      icon: "warning",

      title: "Invalid Role",

      text:
        "Please select a valid staff role."
    });

    return;
  }

  if (password !== confirmPassword) {
    await Swal.fire({
      icon: "warning",

      title: "Password Mismatch",

      text:
        "Password and confirm password do not match."
    });

    return;
  }

  if (password.length < 8) {
    await Swal.fire({
      icon: "warning",

      title: "Weak Password",

      text:
        "Password must contain at least 8 characters."
    });

    return;
  }

  const saveButton =
    getElement(
      "saveStaffBtn",
      "addStaffSubmitBtn"
    );

  const originalButton =
    saveButton?.innerHTML;

  try {
    if (saveButton) {
      saveButton.disabled = true;

      saveButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin me-2"></i>
        Creating...
      `;
    }

    const response =
      await fetch(
        STAFF_API,
        {
          method: "POST",

          headers:
            getAuthHeaders(),

          body:
            JSON.stringify({
              full_name: fullName,
              username,
              email,
              role,
              password,
              status
            })
        }
      );

    const data =
      await response.json();

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    if (
      !response.ok ||
      data.success === false
    ) {
      throw new Error(
        data.message ||
        "Unable to create staff account."
      );
    }

    await Swal.fire({
      icon: "success",

      title: "Staff Account Created",

      text:
        `${fullName} has been added successfully.`,

      confirmButtonText: "OK"
    });

    resetStaffForm();

    closeAddStaffModal();

    await loadStaff();

  } catch (error) {
    console.error(
      "CREATE STAFF ERROR:",
      error
    );

    await Swal.fire({
      icon: "error",

      title: "Unable to Create Staff",

      text:
        error.message ||
        "Server error."
    });

  } finally {
    if (saveButton) {
      saveButton.disabled = false;

      saveButton.innerHTML =
        originalButton ||
        "Create Staff";
    }
  }
}

/* =========================================================
   RESET STAFF FORM
========================================================= */

function resetStaffForm() {
  const form =
    getElement(
      "addStaffForm",
      "staffForm"
    );

  if (form) {
    form.reset();
  }

  const status =
    getElement("staffStatus");

  if (status) {
    status.value = "active";
  }
}

/* =========================================================
   CLOSE ADD STAFF MODAL
========================================================= */

function closeAddStaffModal() {
  const modalElement =
    getElement("addStaffModal");

  if (!modalElement) {
    return;
  }

  if (
    typeof bootstrap !== "undefined"
  ) {
    const modal =
      bootstrap.Modal.getInstance(
        modalElement
      );

    if (modal) {
      modal.hide();
    }
  }

  modalElement.classList.add("hidden");
}

/* =========================================================
   FIND STAFF
========================================================= */

function findStaffById(id) {
  return allStaff.find(
    staff =>
      String(staff.id) === String(id)
  );
}

/* =========================================================
   EDIT STAFF
========================================================= */

async function editStaff(id) {
  const staff =
    findStaffById(id);

  if (!staff) {
    await Swal.fire(
      "Staff Not Found",
      "Unable to find this staff account.",
      "error"
    );

    return;
  }

  const result =
    await Swal.fire({
      title: "Edit Staff",

      html: `
        <div style="text-align:left">

          <label class="mb-2">
            Full Name
          </label>

          <input
            id="editStaffFullName"
            class="swal2-input"
            value="${escapeHTML(staff.full_name || "")}"
            placeholder="Full name"
          >

          <label class="mb-2 mt-3">
            Email
          </label>

          <input
            id="editStaffEmail"
            class="swal2-input"
            value="${escapeHTML(staff.email || "")}"
            placeholder="Email"
            type="email"
          >

          <label class="mb-2 mt-3">
            Role
          </label>

          <select
            id="editStaffRole"
            class="swal2-select"
          >

            <option
              value="inventory_staff"
              ${staff.role === "inventory_staff" ? "selected" : ""}
            >
              Inventory Staff
            </option>

            <option
              value="graphic_designer"
              ${staff.role === "graphic_designer" ? "selected" : ""}
            >
              Graphic Designer
            </option>

            <option
              value="cashier"
              ${staff.role === "cashier" ? "selected" : ""}
            >
              Cashier
            </option>

          </select>

        </div>
      `,

      showCancelButton: true,

      confirmButtonText:
        "Save Changes",

      cancelButtonText:
        "Cancel",

      focusConfirm: false,

      preConfirm: () => {
        const fullName =
          document
            .getElementById(
              "editStaffFullName"
            )
            .value
            .trim();

        const email =
          document
            .getElementById(
              "editStaffEmail"
            )
            .value
            .trim();

        const role =
          document
            .getElementById(
              "editStaffRole"
            )
            .value;

        if (!fullName || !email || !role) {
          Swal.showValidationMessage(
            "Please complete all fields."
          );

          return false;
        }

        return {
          full_name: fullName,
          email,
          role
        };
      }
    });

  if (!result.isConfirmed) {
    return;
  }

  try {
    const response =
      await fetch(
        `${STAFF_API}/${id}`,
        {
          method: "PATCH",

          headers:
            getAuthHeaders(),

          body:
            JSON.stringify(
              result.value
            )
        }
      );

    const data =
      await response.json();

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    if (
      !response.ok ||
      data.success === false
    ) {
      throw new Error(
        data.message ||
        "Unable to update staff."
      );
    }

    await Swal.fire({
      icon: "success",

      title: "Staff Updated",

      text:
        "Staff information has been updated."
    });

    await loadStaff();

  } catch (error) {
    console.error(
      "EDIT STAFF ERROR:",
      error
    );

    await Swal.fire({
      icon: "error",

      title: "Update Failed",

      text: error.message
    });
  }
}

/* =========================================================
   CHANGE STAFF STATUS
========================================================= */

async function changeStaffStatus(id) {
  const staff =
    findStaffById(id);

  if (!staff) {
    return;
  }

  const result =
    await Swal.fire({
      title: "Change Staff Status",

      html: `
        <p>
          Select the new status for
          <strong>
            ${escapeHTML(staff.full_name || staff.username)}
          </strong>.
        </p>
      `,

      input: "select",

      inputOptions: {
        active: "Active",
        inactive: "Inactive",
        restricted: "Restricted"
      },

      inputValue:
        staff.status || "active",

      showCancelButton: true,

      confirmButtonText:
        "Update Status",

      cancelButtonText:
        "Cancel"
    });

  if (
    !result.isConfirmed ||
    !result.value
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `${STAFF_API}/${id}/status`,
        {
          method: "PATCH",

          headers:
            getAuthHeaders(),

          body:
            JSON.stringify({
              status:
                result.value
            })
        }
      );

    const data =
      await response.json();

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    if (
      !response.ok ||
      data.success === false
    ) {
      throw new Error(
        data.message ||
        "Unable to update status."
      );
    }

    await Swal.fire({
      icon: "success",

      title: "Status Updated",

      text:
        `${staff.full_name || staff.username} is now ${formatStatus(result.value)}.`
    });

    await loadStaff();

  } catch (error) {
    console.error(
      "STATUS UPDATE ERROR:",
      error
    );

    await Swal.fire({
      icon: "error",

      title: "Update Failed",

      text: error.message
    });
  }
}

/* =========================================================
   RESET STAFF PASSWORD
========================================================= */

async function resetStaffPassword(id) {
  const staff =
    findStaffById(id);

  if (!staff) {
    return;
  }

  const result =
    await Swal.fire({
      title: "Reset Staff Password",

      html: `
        <p>
          Enter a new password for
          <strong>
            ${escapeHTML(staff.full_name || staff.username)}
          </strong>.
        </p>
      `,

      input: "password",

      inputPlaceholder:
        "Enter new password",

      showCancelButton: true,

      confirmButtonText:
        "Update Password",

      cancelButtonText:
        "Cancel",

      inputValidator: value => {
        if (!value) {
          return "Please enter a password.";
        }

        if (value.length < 8) {
          return "Password must contain at least 8 characters.";
        }

        return undefined;
      }
    });

  if (
    !result.isConfirmed ||
    !result.value
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `${STAFF_API}/${id}/password`,
        {
          method: "PATCH",

          headers:
            getAuthHeaders(),

          body:
            JSON.stringify({
              password:
                result.value
            })
        }
      );

    const data =
      await response.json();

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    if (
      !response.ok ||
      data.success === false
    ) {
      throw new Error(
        data.message ||
        "Unable to reset password."
      );
    }

    await Swal.fire({
      icon: "success",

      title: "Password Updated",

      text:
        "The staff password has been changed successfully."
    });

  } catch (error) {
    console.error(
      "PASSWORD RESET ERROR:",
      error
    );

    await Swal.fire({
      icon: "error",

      title: "Password Update Failed",

      text: error.message
    });
  }
}

/* =========================================================
   DELETE STAFF
========================================================= */

async function deleteStaff(id) {
  const staff =
    findStaffById(id);

  if (!staff) {
    return;
  }

  const result =
    await Swal.fire({
      icon: "warning",

      title: "Delete Staff Account?",

      html: `
        <p>
          You are about to permanently delete
          <strong>
            ${escapeHTML(staff.full_name || staff.username)}
          </strong>.
        </p>

        <p>
          This action cannot be undone.
        </p>
      `,

      showCancelButton: true,

      confirmButtonText:
        "Yes, Delete",

      cancelButtonText:
        "Cancel",

      confirmButtonColor:
        "#dc3545"
    });

  if (!result.isConfirmed) {
    return;
  }

  try {
    const response =
      await fetch(
        `${STAFF_API}/${id}`,
        {
          method: "DELETE",

          headers: {
            Authorization:
              `Bearer ${getAdminToken()}`
          }
        }
      );

    const data =
      await response.json();

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    if (
      !response.ok ||
      data.success === false
    ) {
      throw new Error(
        data.message ||
        "Unable to delete staff."
      );
    }

    await Swal.fire({
      icon: "success",

      title: "Staff Deleted",

      text:
        "The staff account has been deleted."
    });

    await loadStaff();

  } catch (error) {
    console.error(
      "DELETE STAFF ERROR:",
      error
    );

    await Swal.fire({
      icon: "error",

      title: "Delete Failed",

      text: error.message
    });
  }
}

/* =========================================================
   PASSWORD VISIBILITY
========================================================= */

function setupPasswordToggle() {
  const passwordInput =
    getElement("staffPassword");

  const confirmPasswordInput =
    getElement(
      "staffConfirmPassword"
    );

  const passwordToggle =
    getElement(
      "toggleStaffPassword"
    );

  const confirmToggle =
    getElement(
      "toggleStaffConfirmPassword"
    );

  if (
    passwordToggle &&
    passwordInput
  ) {
    passwordToggle.addEventListener(
      "click",
      () => {
        togglePassword(
          passwordInput,
          passwordToggle
        );
      }
    );
  }

  if (
    confirmToggle &&
    confirmPasswordInput
  ) {
    confirmToggle.addEventListener(
      "click",
      () => {
        togglePassword(
          confirmPasswordInput,
          confirmToggle
        );
      }
    );
  }
}

function togglePassword(
  input,
  button
) {
  const showing =
    input.type === "text";

  input.type =
    showing
      ? "password"
      : "text";

  const icon =
    button.querySelector("i");

  if (icon) {
    icon.classList.toggle(
      "fa-eye",
      showing
    );

    icon.classList.toggle(
      "fa-eye-slash",
      !showing
    );
  }
}

/* =========================================================
   FILTER EVENTS
========================================================= */

function setupFilters() {
  const searchInput =
    getElement(
      "staffSearch",
      "searchStaff"
    );

  const roleFilter =
    getElement(
      "roleFilter",
      "staffRoleFilter"
    );

  const statusFilter =
    getElement(
      "statusFilter",
      "staffStatusFilter"
    );

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      filterStaff
    );
  }

  if (roleFilter) {
    roleFilter.addEventListener(
      "change",
      filterStaff
    );
  }

  if (statusFilter) {
    statusFilter.addEventListener(
      "change",
      filterStaff
    );
  }
}

/* =========================================================
   ADD STAFF FORM
========================================================= */

function setupStaffForm() {
  const form =
    getElement(
      "addStaffForm",
      "staffForm"
    );

  if (!form) {
    console.warn(
      "Add Staff form was not found."
    );

    return;
  }

  form.addEventListener(
    "submit",
    createStaff
  );
}

/* =========================================================
   MODAL RESET
========================================================= */

function setupStaffModal() {
  const modal =
    getElement("addStaffModal");

  if (!modal) {
    return;
  }

  modal.addEventListener(
    "hidden.bs.modal",
    () => {
      resetStaffForm();
    }
  );
}

/* =========================================================
   EXPIRED SESSION
========================================================= */

function handleExpiredSession() {
  localStorage.removeItem(
    "adminToken"
  );

  localStorage.removeItem(
    "adminUser"
  );

  Swal.fire({
    icon: "warning",

    title: "Session Expired",

    text:
      "Please login again.",

    confirmButtonText: "Login"
  }).then(() => {
    window.location.href =
      "admin-login.html";
  });
}

/* =========================================================
   ADMIN LOGOUT
========================================================= */

function setupAdminLogout() {
  const logoutButton =
    getElement(
      "adminLogoutBtn",
      "logoutBtn"
    );

  const logoutModal =
    getElement(
      "adminLogoutModal"
    );

  const confirmLogout =
    getElement(
      "adminConfirmLogout"
    );

  const cancelLogout =
    getElement(
      "adminCancelLogout"
    );

  const backdrop =
    logoutModal?.querySelector(
      ".logout-backdrop"
    );

  if (
    logoutButton &&
    logoutModal
  ) {
    logoutButton.addEventListener(
      "click",
      () => {
        logoutModal.classList.remove(
          "hidden"
        );
      }
    );
  }

  if (
    cancelLogout &&
    logoutModal
  ) {
    cancelLogout.addEventListener(
      "click",
      () => {
        logoutModal.classList.add(
          "hidden"
        );
      }
    );
  }

  if (
    backdrop &&
    logoutModal
  ) {
    backdrop.addEventListener(
      "click",
      () => {
        logoutModal.classList.add(
          "hidden"
        );
      }
    );
  }

  if (confirmLogout) {
    confirmLogout.addEventListener(
      "click",
      () => {
        localStorage.removeItem(
          "adminToken"
        );

        localStorage.removeItem(
          "adminUser"
        );

        window.location.href =
          "admin-login.html";
      }
    );
  }
}

/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    if (!checkAdminSession()) {
      return;
    }

    setupFilters();

    setupStaffForm();

    setupStaffModal();

    setupPasswordToggle();

    setupAdminLogout();

    loadStaff();
  }
);