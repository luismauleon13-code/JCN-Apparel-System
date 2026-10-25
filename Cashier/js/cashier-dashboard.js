
(() => {
  const API_BASE = "http://localhost:5000/api/cashier";

  const STAFF_LOGIN = "../../staff/html/staff-login.html";
  const PAGE_SIZE = 10;

  const $ = (id) => document.getElementById(id);

  const state = {
    view: "orders",
    page: 1,
    total: 0,
    rows: [],
    selected: null,
    loading: false,
    busy: false,
    listRequest: 0,
    detailRequest: 0,
    query: "",
    paymentStatus: ""
  };

  // Reuse the same key after an uncertain network result.
  // Backend must enforce idempotency for these keys.
  const actionKeys = new Map();

  let token = "";

  function signOut() {
    localStorage.removeItem("staffToken");
    localStorage.removeItem("staffUser");
    window.location.replace(STAFF_LOGIN);
  }

  function readSession() {
    token = localStorage.getItem("staffToken") || "";

    let user;

    try {
      user = JSON.parse(localStorage.getItem("staffUser") || "null");
    } catch {
      signOut();
      return null;
    }

    const role = String(user?.role || "").trim().toLowerCase();
    const status = String(user?.status || "").trim().toLowerCase();

    if (
      !token ||
      !user ||
      !["cashier", "admin"].includes(role) ||
      (status && status !== "active")
    ) {
      signOut();
      return null;
    }

    return user;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function money(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    const amount = Number(value);

    return Number.isFinite(amount)
      ? new Intl.NumberFormat("en-PH", {
          style: "currency",
          currency: "PHP"
        }).format(amount)
      : "—";
  }

  function dateTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Manila"
        }).format(date);
  }

  function badge(value) {
    const text = String(value || "Unknown");
    const normalized = text.toLowerCase();

    const className = ["paid", "pending", "unpaid"].includes(normalized)
      ? normalized
      : "";

    return `<span class="badge ${className}">${escapeHTML(text)}</span>`;
  }

  function showNotice(message, error = false, detail = false) {
    const element = $(detail ? "detailNotice" : "notice");

    element.textContent = message;
    element.classList.toggle("error", error);
    element.hidden = !message;
  }

  async function api(path, options = {}) {
    let response;

    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers
        }
      });
    } catch {
      throw new Error(
        "Hindi makakonekta sa server. Tingnan kung running ang backend sa port 5000."
      );
    }

    if (response.status === 401) {
      signOut();
      throw new Error("Expired ang staff session. Mag-login muli.");
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Walang cashier permission ang account na ito.");
      }

      if (response.status === 409) {
        throw new Error(
          "Nagbago na ang record. Isara at buksan muli ang order bago magpatuloy."
        );
      }

      throw new Error(
        data?.message ||
        data?.error ||
        `Request failed (${response.status}).`
      );
    }

    if (!data) {
      throw new Error("Walang valid JSON response mula sa cashier API.");
    }

    return data;
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));

    $("pageInfo").textContent =
      `Page ${state.page} of ${totalPages} · ${state.total} records`;

    $("previousButton").disabled =
      state.loading || state.page <= 1;

    $("nextButton").disabled =
      state.loading || state.page >= totalPages;

    $("refreshButton").disabled = state.loading;
  }

  function renderSummary() {
    const isOrders = state.view === "orders";

    document.querySelector(".stats").hidden = !isOrders;

    if (!isOrders) return;

    $("orderCount").textContent = state.rows.length;

    $("paidCount").textContent = state.rows.filter(
      (order) => String(order.payment_status).toLowerCase() === "paid"
    ).length;

    const amounts = state.rows.map((order) => {
      const value = order.amount_due;

      return value === null || value === undefined || value === ""
        ? NaN
        : Number(value);
    });

    $("dueTotal").textContent = amounts.every(
      (amount) => Number.isFinite(amount) && amount >= 0
    )
      ? money(amounts.reduce((sum, amount) => sum + amount, 0))
      : "—";
  }

  function renderRows() {
    const isOrders = state.view === "orders";

    $("tableCaption").textContent =
      isOrders ? "Cashier orders" : "Payment records";

    $("tableHead").innerHTML = isOrders
      ? `<tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Total / Due</th>
          <th>Method</th>
          <th>Payment</th>
          <th>Order status</th>
          <th>Action</th>
        </tr>`
      : `<tr>
          <th>Date</th>
          <th>Order</th>
          <th>Reference</th>
          <th>Method</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Verified by</th>
        </tr>`;

    if (!state.rows.length) {
      $("tableBody").innerHTML =
        '<tr><td class="empty" colspan="7">No records found.</td></tr>';

      renderSummary();
      return;
    }

    $("tableBody").innerHTML = state.rows.map((row, index) => {
      if (isOrders) {
        return `
          <tr>
            <td>
              <strong>${escapeHTML(row.order_number)}</strong>
              <small>${escapeHTML(dateTime(row.created_at))}</small>
            </td>
            <td>
              ${escapeHTML(row.customer_name)}
              <small>${escapeHTML(row.customer_email)}</small>
            </td>
            <td>
              ${money(row.total_amount)}
              <small>Due: ${money(row.amount_due)}</small>
            </td>
            <td>${escapeHTML(row.payment_method)}</td>
            <td>${badge(row.payment_status)}</td>
            <td>${badge(row.status)}</td>
            <td>
              <button
                class="secondary"
                data-order-index="${index}"
              >Review</button>
            </td>
          </tr>`;
      }

      return `
        <tr>
          <td>${escapeHTML(dateTime(row.created_at))}</td>
          <td>${escapeHTML(row.order_number)}</td>
          <td>${escapeHTML(row.reference || "—")}</td>
          <td>${escapeHTML(row.payment_method)}</td>
          <td>${money(row.amount)}</td>
          <td>${badge(row.status)}</td>
          <td>${escapeHTML(row.verified_by || "—")}</td>
        </tr>`;
    }).join("");

    renderSummary();
  }

  async function loadRows() {
    const requestId = ++state.listRequest;

    state.loading = true;
    state.rows = [];
    state.total = 0;

    showNotice("");
    renderRows();

    $("tableBody").innerHTML =
      '<tr><td class="empty" colspan="7">Loading records…</td></tr>';

    updatePagination();

    const parameters = new URLSearchParams({
      page: String(state.page),
      limit: String(PAGE_SIZE),
      search: state.query
    });

    if (state.view === "orders" && state.paymentStatus) {
      parameters.set("payment_status", state.paymentStatus);
    }

    const endpoint = state.view === "orders" ? "/orders" : "/payments";

    try {
      const data = await api(`${endpoint}?${parameters}`);

      if (requestId !== state.listRequest) return;

      const rows = state.view === "orders" ? data.orders : data.payments;
      const total = Number(data.total);

      if (!Array.isArray(rows) || !Number.isInteger(total) || total < 0) {
        throw new Error(
          "Hindi tugma ang API response. Kailangan ng records array at total."
        );
      }

      state.rows = rows;
      state.total = total;

      renderRows();
    } catch (error) {
      if (requestId !== state.listRequest) return;

      $("tableBody").innerHTML =
        '<tr><td class="empty" colspan="7">Unable to load records. Use Refresh to retry.</td></tr>';

      showNotice(error.message, true);
    } finally {
      if (requestId === state.listRequest) {
        state.loading = false;
        updatePagination();
      }
    }
  }

  function detailField(label, value) {
    return `
      <div>
        <dt>${escapeHTML(label)}</dt>
        <dd>${escapeHTML(value ?? "—")}</dd>
      </div>`;
  }

  function updateActionButtons() {
    const order = state.selected;
    const actions = order?.actions || {};

    // These permissions must come from the backend.
    $("verifyOrderButton").disabled =
      state.busy || actions.can_verify_order !== true;

    $("paymentForm").hidden =
      actions.can_verify_payment !== true;

    $("paymentButton").disabled = state.busy;
    $("paymentReference").disabled = state.busy;
    $("paymentNote").disabled = state.busy;

    $("releaseButton").disabled =
      state.busy || actions.can_release !== true;

    $("closeDialog").disabled = state.busy;
  }

  function renderOrder() {
    const order = state.selected;

    if (!order) return;

    $("dialogTitle").textContent = order.order_number || "Order";

    const items = Array.isArray(order.items) ? order.items : [];
    const payments = Array.isArray(order.payments) ? order.payments : [];

    $("detailContent").innerHTML = `
      <dl class="detail-grid">
        ${detailField("Customer", order.customer_name)}
        ${detailField("Email", order.customer_email)}
        ${detailField("Phone", order.customer_phone)}
        ${detailField("Total amount", money(order.total_amount))}
        ${detailField("Amount due", money(order.amount_due))}
        ${detailField("Payment method", order.payment_method)}
        ${detailField("Payment status", order.payment_status)}
        ${detailField("Order status", order.status)}
        ${detailField("Delivery status", order.delivery_status)}
        ${detailField("Courier", order.courier)}
        ${detailField("Tracking number", order.tracking_number)}
        ${detailField(
          "Order verification",
          order.verified_at ? dateTime(order.verified_at) : "Not verified"
        )}
        ${detailField(
          "Order release",
          order.released_at ? dateTime(order.released_at) : "Not released"
        )}
      </dl>

      <h3>Ordered items</h3>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Size</th>
              <th>Color</th>
              <th>Quantity</th>
              <th>Unit price</th>
            </tr>
          </thead>
          <tbody>
            ${items.length ? items.map((item) => `
              <tr>
                <td>${escapeHTML(item.title)}</td>
                <td>${escapeHTML(item.size)}</td>
                <td>${escapeHTML(item.color)}</td>
                <td>${escapeHTML(item.quantity)}</td>
                <td>${money(item.unit_price)}</td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="5" class="empty">No item details available.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <h3 style="margin-top:24px">Payment history</h3>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${payments.length ? payments.map((payment) => `
              <tr>
                <td>${escapeHTML(dateTime(payment.created_at))}</td>
                <td>${escapeHTML(payment.reference)}</td>
                <td>${money(payment.amount)}</td>
                <td>${badge(payment.status)}</td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="4" class="empty">No payment records.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <p class="muted">
        ${escapeHTML(
          order.actions?.release_reason ||
          "Release eligibility is determined by the server."
        )}
      </p>
    `;

    updateActionButtons();
  }

  function validateOrder(order) {
    if (!order || order.id === undefined || order.revision === undefined) {
      throw new Error("Missing order ID or revision in the API response.");
    }

    return order;
  }

  async function openOrder(id) {
    if (state.busy) return;

    const requestId = ++state.detailRequest;

    state.selected = null;
    $("dialogTitle").textContent = "Loading order…";
    $("detailContent").textContent = "Loading details…";
    $("paymentForm").reset();

    showNotice("", false, true);
    updateActionButtons();

    if (!$("orderDialog").open) {
      $("orderDialog").showModal();
    }

    try {
      const data = await api(`/orders/${encodeURIComponent(id)}`);

      if (requestId !== state.detailRequest) return;

      state.selected = validateOrder(data.order);
      renderOrder();
    } catch (error) {
      if (requestId !== state.detailRequest) return;

      $("detailContent").textContent = "Unable to load this order.";
      showNotice(error.message, true, true);
    }
  }

  function createRequestKey() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  }

  async function performAction(action, extra = {}) {
    if (state.busy || !state.selected) return;

    const order = state.selected;

    const requiredPermission = {
      "verify-order": "can_verify_order",
      "verify-payment": "can_verify_payment",
      "release": "can_release"
    }[action];

    if (order.actions?.[requiredPermission] !== true) {
      showNotice("Hindi available ang action na ito.", true, true);
      return;
    }

    const payload = {
      revision: order.revision,
      ...extra
    };

    const operation = JSON.stringify([order.id, action, payload]);

    if (!actionKeys.has(operation)) {
      actionKeys.set(operation, createRequestKey());
    }

    state.busy = true;
    updateActionButtons();
    showNotice("Processing…", false, true);

    try {
      const data = await api(
        `/orders/${encodeURIComponent(order.id)}/${action}`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": actionKeys.get(operation)
          },
          body: JSON.stringify(payload)
        }
      );

      state.selected = validateOrder(data.order);

      actionKeys.delete(operation);
      $("paymentForm").reset();
      renderOrder();

      showNotice(
        data.message || "Saved successfully.",
        false,
        true
      );

      await loadRows();
    } catch (error) {
      showNotice(
        `${error.message} Kung naputol ang connection, i-refresh muna ang order para makita ang pinakabagong status.`,
        true,
        true
      );
    } finally {
      state.busy = false;
      updateActionButtons();
    }
  }

  function closeOrder() {
    if (state.busy) return;

    ++state.detailRequest;
    state.selected = null;
    $("orderDialog").close();
  }

  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.busy) return;

        state.view = button.dataset.view;
        state.page = 1;

        document.querySelectorAll("[data-view]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        $("pageTitle").textContent =
          state.view === "orders" ? "Orders & Payments" : "Payment Records";

        $("statusFilter").hidden = state.view !== "orders";

        loadRows();
      });
    });

    $("filterForm").addEventListener("submit", (event) => {
      event.preventDefault();

      state.query = $("searchInput").value.trim();
      state.paymentStatus = $("paymentFilter").value;
      state.page = 1;

      loadRows();
    });

    $("refreshButton").addEventListener("click", loadRows);

    $("previousButton").addEventListener("click", () => {
      if (state.loading || state.page <= 1) return;

      state.page--;
      loadRows();
    });

    $("nextButton").addEventListener("click", () => {
      if (state.loading || state.page * PAGE_SIZE >= state.total) return;

      state.page++;
      loadRows();
    });

    $("tableBody").addEventListener("click", (event) => {
      const button = event.target.closest("[data-order-index]");

      if (!button || state.loading) return;

      const row = state.rows[Number(button.dataset.orderIndex)];

      if (row?.id !== undefined) {
        openOrder(row.id);
      }
    });

    $("closeDialog").addEventListener("click", closeOrder);

    $("orderDialog").addEventListener("cancel", (event) => {
      event.preventDefault();
      closeOrder();
    });

    $("verifyOrderButton").addEventListener("click", () => {
      if (!state.selected || state.busy) return;

      const approved = confirm(
        `Confirm na tama ang customer at items ng ${state.selected.order_number}?`
      );

      if (approved) performAction("verify-order");
    });

    $("paymentForm").addEventListener("submit", (event) => {
      event.preventDefault();

      const reference = $("paymentReference").value.trim();
      const notes = $("paymentNote").value.trim();

      if (!reference) {
        showNotice("Ilagay ang payment reference.", true, true);
        $("paymentReference").focus();
        return;
      }

      if (confirm("Submit this payment reference for verification?")) {
        performAction("verify-payment", { reference, notes });
      }
    });

    $("releaseButton").addEventListener("click", () => {
      if (!state.selected || state.busy) return;

      if (confirm(
        `Confirm actual release ng ${state.selected.order_number}?`
      )) {
        performAction("release");
      }
    });

    // Same one-click logout behavior as the Graphic Designer portal.
   $("logoutButton").addEventListener("click", () => {

  if (state.busy) return;

  const confirmLogout = window.confirm(
    "Are you sure you want to log out?"
  );

  if (confirmLogout) {
    signOut();
  }

});

    window.addEventListener("storage", (event) => {
      if (
        event.key === null ||
        event.key === "staffToken" ||
        event.key === "staffUser"
      ) {
        location.reload();
      }
    });
  }

  

  function init() {
    const user = readSession();

    if (!user) return;

    $("staffName").textContent =
      user.full_name || user.username || "Cashier";

    bindEvents();
    loadRows();
  }

  init();
})();