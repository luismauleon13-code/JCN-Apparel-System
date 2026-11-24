/* =========================================================
   JCN APPAREL PRINTING SERVICES
   ADMIN - MANAGE STAFF
   WITH UNIFIED ADMIN LOGOUT MODAL
========================================================= */

/* =========================================================
   01. API CONFIGURATION
========================================================= */

const API_BASE_URL = "";
const STAFF_API = `${API_BASE_URL}/api/admin/staff`;

let allStaff = [];


/* =========================================================
   02. ADMIN AUTHENTICATION
========================================================= */

function getAdminToken() {
  return localStorage.getItem("adminToken");
}

function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAdminToken()}`
  };
}

function checkAdminSession() {
  if (!getAdminToken()) {
    window.location.replace("admin-login.html");
    return false;
  }

  return true;
}


/* =========================================================
   03. HELPER FUNCTIONS
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

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

function formatDate(dateValue) {
  if (!dateValue) return "Never";

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

function findStaffById(id) {
  return allStaff.find(
    staff => String(staff.id) === String(id)
  );
}


/* =========================================================
   04. LOAD STAFF ACCOUNTS
========================================================= */

async function loadStaff() {
  if (!checkAdminSession()) return;

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
      cache: "no-store",

      headers: {
        Authorization: `Bearer ${getAdminToken()}`
      }
    });

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    const data = await response.json();

    if (response.status === 403) {
      throw new Error(
        data.message ||
        "You do not have permission to manage staff."
      );
    }

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Unable to load staff accounts."
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

    updateStaffCounts(calculateCounts([]));

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
   05. CALCULATE STAFF COUNTS
========================================================= */

function calculateCounts(staffList) {
  return {
    total: staffList.length,

    inventory: staffList.filter(
      staff => staff.role === "inventory_staff"
    ).length,

    designers: staffList.filter(
      staff => staff.role === "graphic_designer"
    ).length,

    cashiers: staffList.filter(
      staff => staff.role === "cashier"
    ).length
  };
}


/* =========================================================
   06. UPDATE SUMMARY CARDS
========================================================= */

function updateStaffCounts(counts) {
  const totalStaff = getElement("totalStaffCount");

  const inventoryStaff = getElement(
    "inventoryStaffCount"
  );

  const designerStaff = getElement(
    "designerStaffCount",
    "graphicDesignerCount"
  );

  const cashierStaff = getElement(
    "cashierStaffCount"
  );

  if (totalStaff) {
    totalStaff.textContent = Number(counts?.total || 0);
  }

  if (inventoryStaff) {
    inventoryStaff.textContent = Number(
      counts?.inventory || 0
    );
  }

  if (designerStaff) {
    designerStaff.textContent = Number(
      counts?.designers || 0
    );
  }

  if (cashierStaff) {
    cashierStaff.textContent = Number(
      counts?.cashiers || 0
    );
  }
}


/* =========================================================
   07. DISPLAY STAFF ACCOUNTS
========================================================= */

function displayStaff(staffList) {
  const tableBody = getElement(
    "staffTableBody",
    "staffTable"
  );

  if (!tableBody) {
    console.error("Staff table body was not found.");
    return;
  }

  tableBody.innerHTML = "";

  if (!staffList || staffList.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="staff-empty-state empty-table">

            <div class="empty-icon">
              <i class="fa-solid fa-users"></i>
            </div>

            <h5>No staff accounts found</h5>

            <p>
              Create an Inventory Staff,
              Graphic Designer, or Cashier account,
              or change your search filters.
            </p>

          </div>
        </td>
      </tr>
    `;

    return;
  }

  staffList.forEach(staff => {
    const row = document.createElement("tr");

    const fullName = escapeHTML(
      staff.full_name ||
      staff.username ||
      "Unnamed Staff"
    );

    const username = escapeHTML(
      staff.username || "-"
    );

    const email = escapeHTML(
      staff.email || "-"
    );

    const role = escapeHTML(
      formatRole(staff.role)
    );

    const status = String(
      staff.status || "inactive"
    ).toLowerCase();

    const statusText = escapeHTML(
      formatStatus(status)
    );

    const lastLogin = escapeHTML(
      formatDate(staff.last_login_at)
    );

    row.innerHTML = `
      <td>
        <div class="staff-profile">

          <div class="staff-avatar">
            <i class="fa-solid fa-user"></i>
          </div>

          <div class="staff-details">

            <strong class="staff-name">
              ${fullName}
            </strong>

            <small class="staff-email">
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
            class="staff-action-btn action-btn edit"
            title="Edit Staff"
            aria-label="Edit Staff"
            data-action="edit"
          >
            <i class="fa-solid fa-pen"></i>
          </button>

          <button
            type="button"
            class="staff-action-btn action-btn status"
            title="Change Status"
            aria-label="Change Status"
            data-action="status"
          >
            <i class="fa-solid fa-user-shield"></i>
          </button>

          <button
            type="button"
            class="staff-action-btn action-btn password"
            title="Reset Password"
            aria-label="Reset Password"
            data-action="password"
          >
            <i class="fa-solid fa-key"></i>
          </button>

          <button
            type="button"
            class="staff-action-btn action-btn delete"
            title="Delete Staff"
            aria-label="Delete Staff"
            data-action="delete"
          >
            <i class="fa-solid fa-trash"></i>
          </button>

        </div>
      </td>
    `;

    /* STAFF ACTION EVENTS */

    row.querySelector('[data-action="edit"]')
      .addEventListener("click", () => {
        editStaff(staff.id);
      });

    row.querySelector('[data-action="status"]')
      .addEventListener("click", () => {
        changeStaffStatus(staff.id);
      });

    row.querySelector('[data-action="password"]')
      .addEventListener("click", () => {
        resetStaffPassword(staff.id);
      });

    row.querySelector('[data-action="delete"]')
      .addEventListener("click", () => {
        deleteStaff(staff.id);
      });

    tableBody.appendChild(row);
  });
}


/* =========================================================
   08. SEARCH AND FILTER STAFF
========================================================= */

function filterStaff() {
  const searchInput = getElement(
    "staffSearch",
    "searchStaff"
  );

  const roleFilter = getElement(
    "roleFilter",
    "staffRoleFilter"
  );

  const statusFilter = getElement(
    "statusFilter",
    "staffStatusFilter"
  );

  const search =
    searchInput?.value?.trim().toLowerCase() || "";

  const role = roleFilter?.value || "all";
  const status = statusFilter?.value || "all";

  const filtered = allStaff.filter(staff => {
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
   09. CREATE STAFF ACCOUNT
========================================================= */

async function createStaff(event) {
  event.preventDefault();

  const fullName = getElement(
    "staffFullName"
  )?.value.trim();

  const username = getElement(
    "staffUsername"
  )?.value.trim();

  const email = getElement(
    "staffEmail"
  )?.value.trim();

  const role = getElement(
    "staffRole"
  )?.value;

  const password = getElement(
    "staffPassword"
  )?.value;

  const confirmPassword = getElement(
    "staffConfirmPassword"
  )?.value;

  const status =
    getElement("staffStatus")?.value || "active";


  /* REQUIRED FIELDS */

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
      text: "Please complete all required fields."
    });

    return;
  }


  /* VALIDATE EMAIL */

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    await Swal.fire({
      icon: "warning",
      title: "Invalid Email",
      text: "Please enter a valid email address."
    });

    return;
  }


  /* VALIDATE STAFF ROLE */

  const allowedRoles = [
    "inventory_staff",
    "graphic_designer",
    "cashier"
  ];

  if (!allowedRoles.includes(role)) {
    await Swal.fire({
      icon: "warning",
      title: "Invalid Role",
      text: "Please select a valid staff role."
    });

    return;
  }


  /* VALIDATE PASSWORD */

  if (password !== confirmPassword) {
    await Swal.fire({
      icon: "warning",
      title: "Password Mismatch",
      text: "Password and confirm password do not match."
    });

    return;
  }

  if (password.length < 8) {
    await Swal.fire({
      icon: "warning",
      title: "Weak Password",
      text: "Password must contain at least 8 characters."
    });

    return;
  }


  /* CREATE BUTTON */

  const saveButton = getElement(
    "saveStaffBtn",
    "addStaffSubmitBtn"
  );

  const originalButton = saveButton?.innerHTML;

  if (saveButton?.disabled) return;

  try {
    if (saveButton) {
      saveButton.disabled = true;

      saveButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin me-2"></i>
        Creating...
      `;
    }

    const response = await fetch(STAFF_API, {
      method: "POST",

      headers: getAuthHeaders(),

      body: JSON.stringify({
        full_name: fullName,
        username,
        email,
        role,
        password,
        status
      })
    });

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Unable to create staff account."
      );
    }

    resetStaffForm();
    closeAddStaffModal();

    await Swal.fire({
      icon: "success",
      title: "Staff Account Created",
      text: `${fullName} has been added successfully.`,
      confirmButtonText: "OK"
    });

    await loadStaff();

  } catch (error) {
    console.error("CREATE STAFF ERROR:", error);

    await Swal.fire({
      icon: "error",
      title: "Unable to Create Staff",
      text: error.message || "Server error."
    });

  } finally {
    if (saveButton) {
      saveButton.disabled = false;

      saveButton.innerHTML =
        originalButton || "Create Staff Account";
    }
  }
}


/* =========================================================
   10. RESET ADD STAFF FORM
========================================================= */

function resetStaffForm() {
  const form = getElement(
    "addStaffForm",
    "staffForm"
  );

  if (form) {
    form.reset();
  }

  const status = getElement("staffStatus");

  if (status) {
    status.value = "active";
  }

  const password = getElement("staffPassword");

  const confirmPassword = getElement(
    "staffConfirmPassword"
  );

  if (password) {
    password.type = "password";
  }

  if (confirmPassword) {
    confirmPassword.type = "password";
  }

  [
    "toggleStaffPassword",
    "toggleStaffConfirmPassword"
  ].forEach(id => {
    const icon = getElement(id)?.querySelector("i");

    if (icon) {
      icon.classList.add("fa-eye");
      icon.classList.remove("fa-eye-slash");
    }
  });
}


/* =========================================================
   11. CLOSE ADD STAFF MODAL
========================================================= */

function closeAddStaffModal() {
  const modalElement = getElement("addStaffModal");

  if (!modalElement) return;

  if (
    typeof bootstrap !== "undefined" &&
    bootstrap.Modal
  ) {
    const modal = bootstrap.Modal.getInstance(
      modalElement
    );

    if (modal) {
      modal.hide();
      return;
    }
  }

  if (modalElement instanceof HTMLDialogElement) {
    if (modalElement.open) {
      modalElement.close();
    }

    return;
  }

  modalElement.classList.add("hidden");
}


/* =========================================================
   12. EDIT STAFF ACCOUNT
========================================================= */

async function editStaff(id) {
  const staff = findStaffById(id);

  if (!staff) {
    await Swal.fire(
      "Staff Not Found",
      "Unable to find this staff account.",
      "error"
    );

    return;
  }

  const result = await Swal.fire({
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

    confirmButtonText: "Save Changes",

    cancelButtonText: "Cancel",

    focusConfirm: false,

    preConfirm: () => {
      const fullName = getElement(
        "editStaffFullName"
      ).value.trim();

      const email = getElement(
        "editStaffEmail"
      ).value.trim();

      const role = getElement(
        "editStaffRole"
      ).value;

      if (!fullName || !email || !role) {
        Swal.showValidationMessage(
          "Please complete all fields."
        );

        return false;
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        Swal.showValidationMessage(
          "Please enter a valid email address."
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

  if (!result.isConfirmed) return;

  try {
    const response = await fetch(
      `${STAFF_API}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",

        headers: getAuthHeaders(),

        body: JSON.stringify(result.value)
      }
    );

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Unable to update staff."
      );
    }

    await Swal.fire({
      icon: "success",
      title: "Staff Updated",
      text: "Staff information has been updated."
    });

    await loadStaff();

  } catch (error) {
    console.error("EDIT STAFF ERROR:", error);

    await Swal.fire({
      icon: "error",
      title: "Update Failed",
      text: error.message
    });
  }
}


/* =========================================================
   13. CHANGE STAFF STATUS
========================================================= */

async function changeStaffStatus(id) {
  const staff = findStaffById(id);

  if (!staff) return;

  const result = await Swal.fire({
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

    inputValue: staff.status || "active",

    showCancelButton: true,

    confirmButtonText: "Update Status",

    cancelButtonText: "Cancel"
  });

  if (!result.isConfirmed || !result.value) {
    return;
  }

  try {
    const response = await fetch(
      `${STAFF_API}/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",

        headers: getAuthHeaders(),

        body: JSON.stringify({
          status: result.value
        })
      }
    );

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Unable to update status."
      );
    }

    await Swal.fire({
      icon: "success",
      title: "Status Updated",

      text:
        `${staff.full_name || staff.username} is now ` +
        `${formatStatus(result.value)}.`
    });

    await loadStaff();

  } catch (error) {
    console.error("STATUS UPDATE ERROR:", error);

    await Swal.fire({
      icon: "error",
      title: "Update Failed",
      text: error.message
    });
  }
}


/* =========================================================
   14. RESET STAFF PASSWORD
========================================================= */

async function resetStaffPassword(id) {
  const staff = findStaffById(id);

  if (!staff) return;

  const result = await Swal.fire({
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

    inputPlaceholder: "Enter new password",

    inputAttributes: {
      autocomplete: "new-password"
    },

    showCancelButton: true,

    confirmButtonText: "Update Password",

    cancelButtonText: "Cancel",

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

  if (!result.isConfirmed || !result.value) {
    return;
  }

  try {
    const response = await fetch(
      `${STAFF_API}/${encodeURIComponent(id)}/password`,
      {
        method: "PATCH",

        headers: getAuthHeaders(),

        body: JSON.stringify({
          password: result.value
        })
      }
    );

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Unable to reset password."
      );
    }

    await Swal.fire({
      icon: "success",
      title: "Password Updated",
      text: "The staff password has been changed successfully."
    });

  } catch (error) {
    console.error("PASSWORD RESET ERROR:", error);

    await Swal.fire({
      icon: "error",
      title: "Password Update Failed",
      text: error.message
    });
  }
}


/* =========================================================
   15. DELETE STAFF ACCOUNT
========================================================= */

async function deleteStaff(id) {
  const staff = findStaffById(id);

  if (!staff) return;

  const result = await Swal.fire({
    icon: "warning",

    title: "Delete Staff Account?",

    html: `
      <p>
        You are about to permanently delete
        <strong>
          ${escapeHTML(staff.full_name || staff.username)}
        </strong>.
      </p>

      <p>This action cannot be undone.</p>
    `,

    showCancelButton: true,

    confirmButtonText: "Yes, Delete",

    cancelButtonText: "Cancel",

    confirmButtonColor: "#dc3545"
  });

  if (!result.isConfirmed) return;

  try {
    const response = await fetch(
      `${STAFF_API}/${encodeURIComponent(id)}`,
      {
        method: "DELETE",

        headers: {
          Authorization: `Bearer ${getAdminToken()}`
        }
      }
    );

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Unable to delete staff."
      );
    }

    await Swal.fire({
      icon: "success",
      title: "Staff Deleted",
      text: "The staff account has been deleted."
    });

    await loadStaff();

  } catch (error) {
    console.error("DELETE STAFF ERROR:", error);

    await Swal.fire({
      icon: "error",
      title: "Delete Failed",
      text: error.message
    });
  }
}


/* =========================================================
   16. PASSWORD VISIBILITY
========================================================= */

function setupPasswordToggle() {
  const passwordInput = getElement(
    "staffPassword"
  );

  const confirmPasswordInput = getElement(
    "staffConfirmPassword"
  );

  const passwordToggle = getElement(
    "toggleStaffPassword"
  );

  const confirmToggle = getElement(
    "toggleStaffConfirmPassword"
  );

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener(
      "click",
      event => {
        event.preventDefault();

        togglePassword(
          passwordInput,
          passwordToggle
        );
      }
    );
  }

  if (confirmToggle && confirmPasswordInput) {
    confirmToggle.addEventListener(
      "click",
      event => {
        event.preventDefault();

        togglePassword(
          confirmPasswordInput,
          confirmToggle
        );
      }
    );
  }
}

function togglePassword(input, button) {
  const showing = input.type === "text";

  input.type = showing
    ? "password"
    : "text";

  const icon = button.querySelector("i");

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

  button.setAttribute(
    "aria-label",
    showing ? "Show password" : "Hide password"
  );
}


/* =========================================================
   17. SEARCH AND FILTER EVENTS
========================================================= */

function setupFilters() {
  const searchInput = getElement(
    "staffSearch",
    "searchStaff"
  );

  const roleFilter = getElement(
    "roleFilter",
    "staffRoleFilter"
  );

  const statusFilter = getElement(
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
   18. STAFF FORM EVENTS
========================================================= */

function setupStaffForm() {
  const form = getElement(
    "addStaffForm",
    "staffForm"
  );

  if (!form) {
    console.warn("Add Staff form was not found.");
    return;
  }

  form.addEventListener(
    "submit",
    createStaff
  );

  // Prevent the browser from reusing the admin password
  // as the password for a newly created staff account.

  getElement("staffPassword")
    ?.setAttribute("autocomplete", "new-password");

  getElement("staffConfirmPassword")
    ?.setAttribute("autocomplete", "new-password");
}


/* =========================================================
   19. STAFF MODAL RESET
========================================================= */

function setupStaffModal() {
  const modal = getElement("addStaffModal");

  if (!modal) return;

  modal.addEventListener(
    "hidden.bs.modal",
    resetStaffForm
  );

  modal.addEventListener(
    "show.bs.modal",
    () => {
      modal.classList.remove("hidden");
    }
  );
}


/* =========================================================
   20. CLEAR ADMIN SESSION

   Preserve:
   - Admin theme preference
   - Customer theme preference
   - Other user sessions
========================================================= */

function clearAdminSession() {
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
  localStorage.removeItem("admin");

  // Never use localStorage.clear().
}


/* =========================================================
   21. HANDLE EXPIRED SESSION
========================================================= */

let sessionExpired = false;

function handleExpiredSession() {
  if (sessionExpired) return;

  sessionExpired = true;

  clearAdminSession();

  if (window.Swal) {
    Swal.fire({
      icon: "warning",
      title: "Session Expired",
      text: "Please login again.",
      confirmButtonText: "Login",

      allowOutsideClick: false,
      allowEscapeKey: false

    }).then(() => {
      window.location.replace("admin-login.html");
    });

  } else {
    window.location.replace("admin-login.html");
  }
}


/* =========================================================
   22. UNIFIED ADMIN LOGOUT MODAL

   Same design as:
   - Announcements
   - Global Admin Logout

   Compatible with admin-theme.css.
========================================================= */

function setupAdminLogout() {
  const logoutButton = getElement(
    "adminLogoutBtn",
    "logoutBtn"
  );

  if (!logoutButton) {
    console.warn("Admin logout button was not found.");
    return;
  }

  if (logoutButton.dataset.jcnLogoutReady === "true") {
    return;
  }

  let modal = getElement("adminLogoutModal");


  /* =======================================================
     CREATE NATIVE DIALOG

     Replace the old custom logout modal.
  ======================================================= */

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


  /* STANDARD GLOBAL LOGOUT CLASS */

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


  /* =======================================================
     STANDARD LOGOUT HTML
  ======================================================= */

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
      Are you sure you want to end your current session?
    </p>

    <div class="logout-actions">

      <button
        type="button"
        id="adminConfirmLogout"
        class="logout-confirm-btn"
      >
        Yes, Logout
      </button>

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


  /* GET LOGOUT ELEMENTS */

  const confirmButton = getElement(
    "adminConfirmLogout"
  );

  const cancelButton = getElement(
    "adminCancelLogout"
  );

  let previousOverflow = "";
  let loggingOut = false;
  let outsidePress = false;


  /* =======================================================
     OPEN LOGOUT MODAL
  ======================================================= */

  function openLogoutModal(event) {
    event.preventDefault();

    if (modal.open || loggingOut) return;

    previousOverflow =
      document.body.style.overflow;

    modal.showModal();

    document.body.style.overflow = "hidden";

    cancelButton.focus();
  }


  /* =======================================================
     CLOSE LOGOUT MODAL
  ======================================================= */

  function closeLogoutModal() {
    if (loggingOut) return;

    if (modal.open) {
      modal.close();
    }
  }


  /* =======================================================
     CHECK OUTSIDE CLICK
  ======================================================= */

  function isOutsideModal(event) {
    const rect = modal.getBoundingClientRect();

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


  /* =======================================================
     OPEN AND CANCEL EVENTS
  ======================================================= */

  logoutButton.addEventListener(
    "click",
    openLogoutModal
  );

  cancelButton.addEventListener(
    "click",
    closeLogoutModal
  );


  /* =======================================================
     ESCAPE KEY SUPPORT
  ======================================================= */

  modal.addEventListener(
    "cancel",
    event => {
      event.preventDefault();

      closeLogoutModal();
    }
  );


  /* =======================================================
     CLICK OUTSIDE SUPPORT
  ======================================================= */

  modal.addEventListener(
    "pointerdown",
    event => {
      outsidePress = isOutsideModal(event);
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


  /* =======================================================
     RESTORE PAGE AFTER MODAL CLOSE
  ======================================================= */

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


  /* =======================================================
     CONFIRM ADMIN LOGOUT
  ======================================================= */

  confirmButton.addEventListener(
    "click",
    () => {
      if (loggingOut) return;

      loggingOut = true;

      confirmButton.disabled = true;
      cancelButton.disabled = true;

      try {

        /* REMOVE ADMIN LOGIN SESSION */

        clearAdminSession();


        /* KEEP DARK / LIGHT MODE PREFERENCE */

        // jcnAdminAccountTheme is preserved.
        // jcnCustomerTheme is preserved.


        /* REDIRECT TO ADMIN LOGIN */

        window.location.replace(
          "admin-login.html"
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
          "Unable to clear the admin session. Please try again."
        );
      }
    }
  );


  /* PREVENT DUPLICATE LOGOUT EVENTS */

  logoutButton.dataset.jcnLogoutReady = "true";

  console.log(
    "[JCN Admin] Unified logout initialized."
  );
}


/* =========================================================
   23. INITIALIZE MANAGE STAFF
========================================================= */

let manageStaffInitialized = false;

function initializeManageStaff() {
  if (manageStaffInitialized) return;

  if (!checkAdminSession()) return;

  manageStaffInitialized = true;


  /* INITIALIZE SEARCH AND FILTERS */

  setupFilters();


  /* INITIALIZE ADD STAFF FORM */

  setupStaffForm();


  /* INITIALIZE STAFF MODAL */

  setupStaffModal();


  /* INITIALIZE PASSWORD VISIBILITY */

  setupPasswordToggle();


  /* INITIALIZE GLOBAL LOGOUT MODAL */

  setupAdminLogout();


  /* LOAD STAFF ACCOUNTS */

  loadStaff();

  console.log(
    "[JCN Admin] Manage Staff initialized."
  );
}


/* =========================================================
   24. DOM READY
========================================================= */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeManageStaff,
    { once: true }
  );

} else {
  initializeManageStaff();
}