"use strict";

(() => {
  const USERS_API = "http://localhost:5000/api/admin/users";
  const LOGIN_PAGE = "admin-login.html";

  const $ = id => document.getElementById(id);

  let users = [];
  let selected = null;
  let saving = false;
  let loading = false;

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));

  function clearAdminSession() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("admin");
  }

  function redirectToLogin() {
    clearAdminSession();
    window.location.replace(LOGIN_PAGE);
  }

  function statusOf(user) {
    return String(user.status || "unknown").trim().toLowerCase();
  }

  function nameOf(user) {
    return String(
      user.full_name ||
      [user.first_name, user.middle_name, user.last_name]
        .filter(Boolean)
        .join(" ") ||
      user.username ||
      "Unnamed customer"
    ).trim();
  }

  function initialsOf(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0])
      .join("")
      .toUpperCase() || "?";
  }

  function restrictionDetails(user) {
    if (!user.restriction_until) {
      return "No expiry recorded";
    }

    const until = new Date(user.restriction_until);

    if (Number.isNaN(until.getTime())) {
      return "Invalid expiry date";
    }

    const remaining = until.getTime() - Date.now();

    if (remaining <= 0) {
      return "Expiry passed — refresh or unrestrict";
    }

    const days = Math.ceil(remaining / 86400000);

    return `${days} day(s) left · Until ${
      until.toLocaleDateString("en-PH")
    }`;
  }

  async function request(path = "", method = "GET", body) {
    const token = localStorage.getItem("adminToken");

    if (!token) {
      redirectToLogin();
      throw new Error("Please log in again.");
    }

    let response;

    try {
      response = await fetch(USERS_API + path, {
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
      redirectToLogin();
      throw new Error("Your session expired. Please log in again.");
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The server returned an unexpected response. Check the users API."
      );
    }

    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || "The request failed.");
    }

    return data;
  }

  function renderUsers() {
    const query = $("customerSearch").value.trim().toLowerCase();
    const filter = $("statusFilter").value;

    const visible = users.filter(user => {
      const searchable = [
        nameOf(user),
        user.username,
        user.email,
        user.phone
      ].join(" ").toLowerCase();

      return searchable.includes(query) &&
        (filter === "all" || statusOf(user) === filter);
    });

    $("customerCount").textContent =
      `Showing ${visible.length} of ${users.length} loaded customer(s)`;

    $("usersTableBody").innerHTML = visible.map(user => {
      const name = nameOf(user);
      const status = statusOf(user);

      const knownStatus = [
        "active",
        "restricted",
        "inactive"
      ].includes(status);

      const statusClass = knownStatus ? status : "unknown";
      const statusLabel = knownStatus
        ? status[0].toUpperCase() + status.slice(1)
        : "Unknown";

      const isRestricted = status === "restricted";
      const action = isRestricted ? "unrestrict" : "restrict";
      const actionLabel = isRestricted
        ? "Unrestrict customer"
        : "Restrict customer";

      const actionIcon = isRestricted ? "fa-unlock" : "fa-ban";
      const id = escapeHTML(user.id);

      return `
        <tr>
          <td>
            <div class="customer-cell">
              <div class="user-avatar" aria-hidden="true">
                ${escapeHTML(initialsOf(name))}
              </div>
              <span class="customer-name">${escapeHTML(name)}</span>
            </div>
          </td>

          <td class="contact-cell">
            ${escapeHTML(user.email || "Not provided")}
          </td>

          <td class="contact-cell phone-cell">
            ${escapeHTML(user.phone || "Not provided")}
          </td>

          <td>
            <span class="badge-role">Customer</span>
          </td>

          <td>
            <span class="status status-${statusClass}">
              ${statusLabel}
            </span>

            ${isRestricted ? `
              <small class="restriction-detail">
                ${escapeHTML(restrictionDetails(user))}
              </small>
              <small class="restriction-detail">
                ${escapeHTML(
                  user.restriction_reason || "No reason provided"
                )}
              </small>
            ` : ""}
          </td>

          <td>
            <div class="action-buttons">
              <button
                type="button"
                class="icon-button ${isRestricted ? "restore" : ""}"
                data-action="${action}"
                data-id="${id}"
                title="${actionLabel}"
                aria-label="${actionLabel}: ${escapeHTML(name)}"
              >
                <i class="fa-solid ${actionIcon}" aria-hidden="true"></i>
              </button>

              <button
                type="button"
                class="icon-button delete"
                data-action="delete"
                data-id="${id}"
                title="Delete customer"
                aria-label="Delete customer: ${escapeHTML(name)}"
              >
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
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
            : "No registered customers yet."}
        </td>
      </tr>
    `;
  }

  async function loadUsers() {
    if (loading) return;

    loading = true;
    $("refreshUsers").disabled = true;
    $("customerSearch").disabled = true;
    $("statusFilter").disabled = true;
    $("customerCount").textContent = "";

    $("usersTableBody").innerHTML = `
      <tr>
        <td colspan="6" class="empty">Loading customers…</td>
      </tr>
    `;

    try {
      const data = await request();

      if (!Array.isArray(data.users)) {
        throw new Error("The server did not return a customer list.");
      }

      users = data.users;
      renderUsers();
    } catch (error) {
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

  function openAction(action, id) {
    if (saving || loading) return;

    const user = users.find(item => String(item.id) === id);

    if (!user || !["restrict", "unrestrict", "delete"].includes(action)) {
      return;
    }

    selected = { action, id };
    $("actionForm").reset();
    $("actionError").textContent = "";

    const restrict = action === "restrict";

    $("restrictionFields").hidden = !restrict;
    $("restrictDays").disabled = !restrict;
    $("restrictReason").disabled = !restrict;
    $("restrictDays").required = restrict;
    $("restrictReason").required = restrict;

    const labels = {
      restrict: "Restrict Customer",
      unrestrict: "Unrestrict Customer",
      delete: "Delete Customer"
    };

    $("actionTitle").textContent = labels[action];

    const name = nameOf(user);

    $("actionDescription").textContent =
      action === "restrict"
        ? `Set the restriction duration and reason for ${name}.`
        : action === "unrestrict"
          ? `Restore account access for ${name}?`
          : `Permanently delete ${name}'s account? Customers with existing orders cannot be deleted.`;

    $("confirmAction").textContent =
      action === "restrict"
        ? "Restrict"
        : action === "unrestrict"
          ? "Unrestrict"
          : "Delete";

    $("confirmAction").className =
      action === "delete" ? "btn btn-danger" : "btn btn-gold";

    $("actionModal").showModal();

    if (restrict) {
      $("restrictDays").focus();
    } else {
      $("cancelAction").focus();
    }
  }

  function setSaving(value) {
    saving = value;

    $("confirmAction").disabled = value;
    $("cancelAction").disabled = value;
    $("actionForm").setAttribute("aria-busy", String(value));

    const restrict = selected?.action === "restrict";
    $("restrictDays").disabled = value || !restrict;
    $("restrictReason").disabled = value || !restrict;
  }

  async function submitAction(event) {
    event.preventDefault();

    if (!selected || saving) return;

    const { action, id } = selected;
    let body;

    if (action === "restrict") {
      const days = Number($("restrictDays").value);
      const reason = $("restrictReason").value.trim();

      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        $("actionError").textContent =
          "Enter a whole number of days between 1 and 3650.";
        return;
      }

      if (!reason || reason.length > 300) {
        $("actionError").textContent =
          "Enter a reason of 1 to 300 characters.";
        return;
      }

      body = { days, reason };
    }

    $("actionError").textContent = "";
    $("pageNotice").textContent = "";
    setSaving(true);

    const encodedId = encodeURIComponent(id);

    try {
      const path = action === "delete"
        ? `/${encodedId}`
        : `/${encodedId}/${action}`;

      const data = await request(
        path,
        action === "delete" ? "DELETE" : "PATCH",
        body
      );

      $("actionModal").close();

      $("pageNotice").textContent =
        data.message || "Customer account updated successfully.";

      await loadUsers();
    } catch (error) {
      $("actionError").textContent = error.message;
    } finally {
      setSaving(false);
    }
  }

  function init() {
    if (!localStorage.getItem("adminToken")) {
      redirectToLogin();
      return;
    }

    $("refreshUsers").addEventListener("click", loadUsers);
    $("customerSearch").addEventListener("input", renderUsers);
    $("statusFilter").addEventListener("change", renderUsers);

    $("usersTableBody").addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");

      if (button) {
        openAction(button.dataset.action, button.dataset.id);
      }
    });

    $("actionForm").addEventListener("submit", submitAction);

    $("cancelAction").addEventListener("click", () => {
      if (!saving) $("actionModal").close();
    });

    $("actionModal").addEventListener("cancel", event => {
      if (saving) event.preventDefault();
    });

    $("actionModal").addEventListener("close", () => {
      selected = null;
    });

    $("adminLogoutBtn").addEventListener("click", () => {
      $("adminLogoutModal").showModal();
      $("adminCancelLogout").focus();
    });

    $("adminCancelLogout").addEventListener("click", () => {
      $("adminLogoutModal").close();
    });

    $("adminConfirmLogout").addEventListener("click", redirectToLogin);

    loadUsers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();