/* =========================================================
   JCN APPAREL PRINTING SERVICES
   CASHIER DASHBOARD - COMPLETE JAVASCRIPT

   Features:
   - Orders and Payments
   - Payment Records
   - Order Verification
   - Confirm Order Release
   - Shipping Address
   - Delivery Status
   - Print Waybill
   - Logout Confirmation
========================================================= */

(() => {

  const API_BASE = "/api/cashier";
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

  const actionKeys = new Map();

  let token = "";


  /* =====================================================
     01. STAFF SESSION
  ===================================================== */

  function signOut() {
    localStorage.removeItem("staffToken");
    localStorage.removeItem("staffUser");

    window.location.replace(STAFF_LOGIN);
  }

  function readSession() {

    token = localStorage.getItem("staffToken") || "";

    let user;

    try {

      user = JSON.parse(
        localStorage.getItem("staffUser") || "null"
      );

    } catch {

      signOut();
      return null;

    }

    const role = String(user?.role || "")
      .trim()
      .toLowerCase();

    const status = String(user?.status || "")
      .trim()
      .toLowerCase();

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


  /* =====================================================
     02. HTML SECURITY
  ===================================================== */

  function escapeHTML(value) {

    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]
    );

  }


  /* =====================================================
     03. MONEY FORMAT
  ===================================================== */

  function money(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
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


  /* =====================================================
     04. DATE AND TIME FORMAT
  ===================================================== */

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


  /* =====================================================
     05. NORMALIZE VALUES
  ===================================================== */

  function normalize(value) {

    return String(value ?? "")
      .trim()
      .toLowerCase();

  }


  /* =====================================================
     06. STATUS BADGES
  ===================================================== */

  function badge(value) {

    const text = String(value || "Unknown");
    const normalized = text.toLowerCase();

    const className = [
      "paid",
      "pending",
      "unpaid"
    ].includes(normalized)
      ? normalized
      : "";

    return `
      <span class="badge ${className}">
        ${escapeHTML(text)}
      </span>
    `;

  }


  /* =====================================================
     07. DELIVERY STATUS
  ===================================================== */

  function getDeliveryStatus(order) {

    const status = normalize(order.status);

    const delivery = String(
      order.delivery_status ?? ""
    ).trim();

    const preparation = normalize(
      order.inventory_preparation
    );

    // Cancelled order

    if (
      status === "cancelled" ||
      status === "canceled"
    ) {
      return "Cancelled";
    }

    // Actual delivery status from the backend

    if (
      delivery &&
      ![
        "—",
        "-",
        "unknown",
        "null",
        "undefined"
      ].includes(normalize(delivery))
    ) {
      return delivery;
    }

    // Released or shipped order
    // Waiting for actual logistics information

    if (
      [
        "completed",
        "delivered",
        "to receive",
        "to deliver",
        "shipped",
        "in transit",
        "out for delivery"
      ].includes(status) ||
      order.released_at
    ) {
      return "Awaiting delivery update";
    }

    // Inventory preparation completed

    if (
      order.inventory_prepared_at &&
      !["queued", "preparing"].includes(preparation)
    ) {
      return "Ready for shipment";
    }

    // Order has not been shipped

    if (
      [
        "pending",
        "pending payment",
        "preparing",
        "processing",
        "to ship"
      ].includes(status)
    ) {
      return "Not yet shipped";
    }

    return "No delivery update";

  }


  /* =====================================================
     08. SHIPPING ADDRESS
  ===================================================== */

  function getShippingAddress(order) {

    const address = String(
      order.shipping_address ?? ""
    ).trim();

    return address || "No shipping address saved";

  }


  /* =====================================================
     09. NOTIFICATIONS
  ===================================================== */

  function showNotice(
    message,
    error = false,
    detail = false
  ) {

    const element = $(
      detail ? "detailNotice" : "notice"
    );

    element.textContent = message;
    element.classList.toggle("error", error);
    element.hidden = !message;

  }


  /* =====================================================
     10. CASHIER API
  ===================================================== */

  async function api(path, options = {}) {

    let response;

    try {

      response = await fetch(`${API_BASE}${path}`, {

        ...options,

        cache: "no-store",

        headers: {

          Accept: "application/json",

          Authorization: `Bearer ${token}`,

          ...(options.body
            ? { "Content-Type": "application/json" }
            : {}),

          ...options.headers

        }

      });

    } catch {

      throw new Error(
        "Hindi makakonekta sa server. Check your internet connection and backend."
      );

    }

    if (response.status === 401) {

      signOut();

      throw new Error(
        "Expired ang staff session. Mag-login muli."
      );

    }

    const data = await response.json().catch(
      () => null
    );

    if (!response.ok || data?.success === false) {

      if (response.status === 403) {

        throw new Error(
          "Walang cashier permission ang account na ito."
        );

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

      throw new Error(
        "Walang valid JSON response mula sa cashier API."
      );

    }

    return data;

  }


  /* =====================================================
     11. PAGINATION
  ===================================================== */

  function updatePagination() {

    const totalPages = Math.max(
      1,
      Math.ceil(state.total / PAGE_SIZE)
    );

    $("pageInfo").textContent =
      `Page ${state.page} of ${totalPages} · ${state.total} records`;

    $("previousButton").disabled =
      state.loading ||
      state.page <= 1;

    $("nextButton").disabled =
      state.loading ||
      state.page >= totalPages;

    $("refreshButton").disabled =
      state.loading;

  }


  /* =====================================================
     12. DASHBOARD SUMMARY
  ===================================================== */

  function renderSummary() {

    const isOrders = state.view === "orders";

    document.querySelector(".stats").hidden =
      !isOrders;

    if (!isOrders) return;

    $("orderCount").textContent =
      state.rows.length;

    $("paidCount").textContent =
      state.rows.filter(
        (order) =>
          String(order.payment_status)
            .toLowerCase() === "paid"
      ).length;

    const amounts = state.rows.map((order) => {

      const value = order.amount_due;

      return (
        value === null ||
        value === undefined ||
        value === ""
      )
        ? NaN
        : Number(value);

    });

    $("dueTotal").textContent = amounts.every(
      (amount) =>
        Number.isFinite(amount) &&
        amount >= 0
    )
      ? money(
          amounts.reduce(
            (sum, amount) => sum + amount,
            0
          )
        )
      : "—";

  }


  /* =====================================================
     13. RENDER ORDERS AND PAYMENT RECORDS
  ===================================================== */

  function renderRows() {

    const isOrders = state.view === "orders";

    $("tableCaption").textContent =
      isOrders
        ? "Cashier orders"
        : "Payment records";

    $("tableHead").innerHTML = isOrders

      ? `
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Total / Due</th>
          <th>Method</th>
          <th>Payment</th>
          <th>Order status</th>
          <th>Action</th>
        </tr>
      `

      : `
        <tr>
          <th>Date</th>
          <th>Order</th>
          <th>Reference</th>
          <th>Method</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Verified by</th>
        </tr>
      `;

    if (!state.rows.length) {

      $("tableBody").innerHTML = `
        <tr>
          <td class="empty" colspan="7">
            No records found.
          </td>
        </tr>
      `;

      renderSummary();
      return;

    }

    $("tableBody").innerHTML =
      state.rows.map((row, index) => {

        if (isOrders) {

          return `
            <tr>

              <td>
                <strong>
                  ${escapeHTML(row.order_number)}
                </strong>

                <small>
                  ${escapeHTML(dateTime(row.created_at))}
                </small>
              </td>

              <td>
                ${escapeHTML(row.customer_name)}

                <small>
                  ${escapeHTML(row.customer_email)}
                </small>
              </td>

              <td>
                ${money(row.total_amount)}

                <small>
                  Due: ${money(row.amount_due)}
                </small>
              </td>

              <td>
                ${escapeHTML(row.payment_method)}
              </td>

              <td>
                ${badge(row.payment_status)}
              </td>

              <td>
                ${badge(row.status)}
              </td>

              <td>
                <button
                  class="secondary"
                  data-order-index="${index}"
                >
                  Review
                </button>
              </td>

            </tr>
          `;

        }

        return `
          <tr>

            <td>
              ${escapeHTML(dateTime(row.created_at))}
            </td>

            <td>
              ${escapeHTML(row.order_number)}
            </td>

            <td>
              ${escapeHTML(row.reference || "—")}
            </td>

            <td>
              ${escapeHTML(row.payment_method)}
            </td>

            <td>
              ${money(row.amount)}
            </td>

            <td>
              ${badge(row.status)}
            </td>

            <td>
              ${escapeHTML(row.verified_by || "—")}
            </td>

          </tr>
        `;

      }).join("");

    renderSummary();

  }


  /* =====================================================
     14. LOAD TABLE RECORDS
  ===================================================== */

  async function loadRows() {

    const requestId = ++state.listRequest;

    state.loading = true;
    state.rows = [];
    state.total = 0;

    showNotice("");

    renderRows();

    $("tableBody").innerHTML = `
      <tr>
        <td class="empty" colspan="7">
          Loading records…
        </td>
      </tr>
    `;

    updatePagination();

    const parameters = new URLSearchParams({

      page: String(state.page),
      limit: String(PAGE_SIZE),
      search: state.query

    });

    if (
      state.view === "orders" &&
      state.paymentStatus
    ) {

      parameters.set(
        "payment_status",
        state.paymentStatus
      );

    }

    const endpoint =
      state.view === "orders"
        ? "/orders"
        : "/payments";

    try {

      const data = await api(
        `${endpoint}?${parameters}`
      );

      if (requestId !== state.listRequest) {
        return;
      }

      const rows =
        state.view === "orders"
          ? data.orders
          : data.payments;

      const total = Number(data.total);

      if (
        !Array.isArray(rows) ||
        !Number.isInteger(total) ||
        total < 0
      ) {

        throw new Error(
          "Hindi tugma ang API response. Kailangan ng records array at total."
        );

      }

      state.rows = rows;
      state.total = total;

      renderRows();

    } catch (error) {

      if (requestId !== state.listRequest) {
        return;
      }

      $("tableBody").innerHTML = `
        <tr>
          <td class="empty" colspan="7">
            Unable to load records. Use Refresh to retry.
          </td>
        </tr>
      `;

      showNotice(error.message, true);

    } finally {

      if (requestId === state.listRequest) {

        state.loading = false;

        updatePagination();

      }

    }

  }


  /* =====================================================
     15. ORDER DETAILS FIELD
  ===================================================== */

  function detailField(label, value) {

    return `
      <div>

        <dt>
          ${escapeHTML(label)}
        </dt>

        <dd>
          ${escapeHTML(value ?? "—")}
        </dd>

      </div>
    `;

  }


  /* =====================================================
     16. WAYBILL ELIGIBILITY
     NEW FUNCTION
  ===================================================== */

  function getWaybillEligibility(order) {

    if (!order) {

      return {
        allowed: false,
        reason: "Select an order first."
      };

    }

    const status = normalize(order.status);

    const paymentMethod = normalize(
      order.payment_method
    );

    const paymentStatus = normalize(
      order.payment_status
    );

    const address = String(
      order.shipping_address ?? ""
    ).trim();

    // Cancelled orders are not allowed

    if (["cancelled", "canceled"].includes(status)) {

      return {
        allowed: false,
        reason: "Cancelled orders cannot be printed."
      };

    }

    // Require permission from the backend

    if (order.actions?.can_print_waybill !== true) {

      return {
        allowed: false,

        reason:
          order.actions?.waybill_reason ||
          "Verify the order before printing."
      };

    }

    // Require shipping address

    if (!address) {

      return {
        allowed: false,
        reason: "Shipping address is missing."
      };

    }

    // Require customer information

    if (
      !String(order.customer_name ?? "").trim() ||
      !String(order.customer_phone ?? "").trim()
    ) {

      return {
        allowed: false,
        reason: "Customer information is incomplete."
      };

    }

    // Require saved order items

    if (
      !Array.isArray(order.items) ||
      !order.items.length
    ) {

      return {
        allowed: false,
        reason: "Order items are missing."
      };

    }

    // Validate supported payment methods

    if (!["cod", "paypal"].includes(paymentMethod)) {

      return {
        allowed: false,
        reason: "Unsupported payment method."
      };

    }

    // PayPal must be paid before printing

    if (
      paymentMethod === "paypal" &&
      paymentStatus !== "paid"
    ) {

      return {
        allowed: false,
        reason: "Waiting for successful PayPal payment."
      };

    }

    // Calculate COD collection amount

    if (
      paymentMethod === "cod" &&
      paymentStatus !== "paid"
    ) {

      if (!["pending", "unpaid"].includes(paymentStatus)) {

        return {
          allowed: false,
          reason: "Unknown COD payment status."
        };

      }

      const rawDue = order.amount_due;

      const amountDue =
        rawDue === null ||
        rawDue === undefined ||
        rawDue === ""
          ? NaN
          : Number(rawDue);

      if (
        !Number.isFinite(amountDue) ||
        amountDue < 0
      ) {

        return {
          allowed: false,
          reason: "Invalid COD collection amount."
        };

      }

    }

    return {
      allowed: true,
      reason: "Waybill is ready for printing."
    };

  }


  /* =====================================================
     17. UPDATE CASHIER ACTION BUTTONS
  ===================================================== */

  function updateActionButtons() {

    const order = state.selected;

    const actions = order?.actions || {};

    // Verify order

    $("verifyOrderButton").disabled =
      state.busy ||
      actions.can_verify_order !== true;

    // Payment verification

    $("paymentForm").hidden =
      actions.can_verify_payment !== true;

    $("paymentButton").disabled =
      state.busy;

    $("paymentReference").disabled =
      state.busy;

    $("paymentNote").disabled =
      state.busy;

    // Confirm order release

    $("releaseButton").disabled =
      state.busy ||
      actions.can_release !== true;

    // Close order details

    $("closeDialog").disabled =
      state.busy;

    /* ===============================================
       PRINT WAYBILL BUTTON
       NEW FUNCTIONALITY
    =============================================== */

    const printButton = $("printWaybillBtn");

    if (printButton) {

      const eligibility = getWaybillEligibility(order);

      printButton.disabled =
        state.busy ||
        !eligibility.allowed;

      printButton.title =
        eligibility.reason;

      printButton.setAttribute(
        "aria-disabled",
        String(printButton.disabled)
      );

    }

  }


  /* =====================================================
     18. RENDER ORDER DETAILS
  ===================================================== */

  function renderOrder() {

    const order = state.selected;

    if (!order) return;

    $("dialogTitle").textContent =
      order.order_number || "Order";

    const items = Array.isArray(order.items)
      ? order.items
      : [];

    const payments = Array.isArray(order.payments)
      ? order.payments
      : [];

    $("detailContent").innerHTML = `

      <dl class="detail-grid">

        ${detailField(
          "Customer",
          order.customer_name
        )}

        ${detailField(
          "Email",
          order.customer_email
        )}

        ${detailField(
          "Phone",
          order.customer_phone
        )}

        ${detailField(
          "Total amount",
          money(order.total_amount)
        )}

        ${detailField(
          "Amount due",
          money(order.amount_due)
        )}

        ${detailField(
          "Payment method",
          order.payment_method
        )}

        ${detailField(
          "Payment status",
          order.payment_status
        )}

        ${detailField(
          "Order status",
          order.status
        )}

        ${detailField(
          "Delivery status",
          getDeliveryStatus(order)
        )}

        ${detailField(
          "Shipping address",
          getShippingAddress(order)
        )}

        ${detailField(
          "Tracking number",
          order.tracking_number ||
          "Not yet assigned"
        )}

        ${detailField(
          "Order verification",
          order.verified_at
            ? dateTime(order.verified_at)
            : "Not verified"
        )}

        ${detailField(
          "Order release",
          order.released_at
            ? dateTime(order.released_at)
            : "Not released"
        )}

      </dl>


      <!-- ORDERED ITEMS -->

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

            ${
              items.length

                ? items.map((item) => `

                  <tr>

                    <td>
                      ${escapeHTML(item.title)}
                    </td>

                    <td>
                      ${escapeHTML(item.size)}
                    </td>

                    <td>
                      ${escapeHTML(item.color)}
                    </td>

                    <td>
                      ${escapeHTML(item.quantity)}
                    </td>

                    <td>
                      ${money(item.unit_price)}
                    </td>

                  </tr>

                `).join("")

                : `

                  <tr>

                    <td colspan="5" class="empty">
                      No item details available.
                    </td>

                  </tr>

                `
            }

          </tbody>

        </table>

      </div>


      <!-- PAYMENT HISTORY -->

      <h3 style="margin-top:24px">
        Payment history
      </h3>

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

            ${
              payments.length

                ? payments.map((payment) => `

                  <tr>

                    <td>
                      ${escapeHTML(
                        dateTime(payment.created_at)
                      )}
                    </td>

                    <td>
                      ${escapeHTML(payment.reference)}
                    </td>

                    <td>
                      ${money(payment.amount)}
                    </td>

                    <td>
                      ${badge(payment.status)}
                    </td>

                  </tr>

                `).join("")

                : `

                  <tr>

                    <td colspan="4" class="empty">
                      No payment records.
                    </td>

                  </tr>

                `
            }

          </tbody>

        </table>

      </div>


      <!-- RELEASE STATUS MESSAGE -->

      <p class="muted">

        ${escapeHTML(
          order.actions?.release_reason ||
          "Release eligibility is determined by the server."
        )}

      </p>


      <!-- PRINT WAYBILL STATUS -->

      <p
        class="muted"
        style="margin-top:10px"
      >

        ${escapeHTML(
          getWaybillEligibility(order).reason
        )}

      </p>

    `;

    updateActionButtons();

  }


  /* =====================================================
     19. VALIDATE ORDER RESPONSE
  ===================================================== */

  function validateOrder(order) {

    if (
      !order ||
      order.id === undefined ||
      order.revision === undefined
    ) {

      throw new Error(
        "Missing order ID or revision in the API response."
      );

    }

    return order;

  }


  /* =====================================================
     20. OPEN ORDER DETAILS
  ===================================================== */

  async function openOrder(id) {

    if (state.busy) return;

    const requestId = ++state.detailRequest;

    state.selected = null;

    $("dialogTitle").textContent =
      "Loading order…";

    $("detailContent").textContent =
      "Loading details…";

    $("paymentForm").reset();

    showNotice("", false, true);

    updateActionButtons();

    if (!$("orderDialog").open) {

      $("orderDialog").showModal();

    }

    try {

      const data = await api(
        `/orders/${encodeURIComponent(id)}`
      );

      if (requestId !== state.detailRequest) {
        return;
      }

      state.selected = validateOrder(data.order);

      renderOrder();

    } catch (error) {

      if (requestId !== state.detailRequest) {
        return;
      }

      $("detailContent").textContent =
        "Unable to load this order.";

      showNotice(error.message, true, true);

    }

  }


  /* =====================================================
     21. REQUEST KEY
     IDEMPOTENCY PROTECTION
  ===================================================== */

  function createRequestKey() {

    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);

    return Array.from(
      bytes,
      (byte) => byte.toString(16).padStart(2, "0")
    ).join("");

  }


  /* =====================================================
     22. CASHIER TRANSACTIONS
     VERIFY ORDER / VERIFY PAYMENT / RELEASE
  ===================================================== */

  /* =====================================================
     CUSTOM CASHIER CONFIRMATION AND RESULT MODALS
  ===================================================== */

  const confirmationOptions = {
    "verify-order": {
      permission: "can_verify_order",
      title: "Verify Order",
      description: "Are you sure that the customer information and ordered items are correct?",
      hint: "Once verified, this order will be available for inventory preparation.",
      button: "Confirm Verify",
      icon: "fa-clipboard-check",
      success: "Order Verified"
    },
    "verify-payment": {
      permission: "can_verify_payment",
      title: "Verify Payment",
      description: "Submit this payment reference for server verification?",
      hint: "Please check the payment reference before continuing.",
      button: "Confirm Payment",
      icon: "fa-receipt",
      success: "Payment Verified"
    },
    "release": {
      permission: "can_release",
      title: "Confirm Order Release",
      description: "Are you sure this order has actually been released?",
      hint: "Confirm only after the actual release of the order.",
      button: "Confirm Release",
      icon: "fa-box-open",
      success: "Order Released"
    }
  };

  let pendingConfirmation = null;
  let confirmationRunning = false;

  function openCashierConfirmation(action, extra = {}) {
    const order = state.selected;
    const config = confirmationOptions[action];
    const dialog = $("cashierConfirmDialog");
    if (!order || state.busy || confirmationRunning || dialog.open ||
        !config || order.actions?.[config.permission] !== true) return;

    pendingConfirmation = { action, extra, orderId: order.id, revision: order.revision,
      orderNumber: order.order_number || String(order.id) };
    $("cashierConfirmTitle").textContent = config.title;
    $("cashierConfirmDescription").textContent = config.description;
    $("cashierConfirmHint").textContent = config.hint;
    $("cashierConfirmOrderNumber").textContent = pendingConfirmation.orderNumber;
    $("cashierConfirmIcon").className = `fa-solid ${config.icon}`;
    $("cashierConfirmButtonText").textContent = config.button;
    $("cashierConfirmButtonIcon").className = "fa-solid fa-check";
    $("cashierConfirmError").hidden = true;
    $("cashierConfirmLoading").hidden = true;
    $("confirmCashierAction").disabled = false;
    $("cancelCashierAction").disabled = false;
    dialog.showModal();
    $("cancelCashierAction").focus();
  }

  function closeCashierConfirmation() {
    if (confirmationRunning) return;
    pendingConfirmation = null;
    $("cashierConfirmDialog").close();
  }

  function showCashierResult(success, title, message, orderNumber) {
    $("cashierResultTitle").textContent = title;
    $("cashierResultMessage").textContent = message;
    $("cashierResultOrderNumber").textContent = orderNumber;
    $("cashierResultIconWrap").className = `cashier-result-icon ${success ? "success" : "error"}`;
    $("cashierResultIcon").className = `fa-solid ${success ? "fa-circle-check" : "fa-circle-exclamation"}`;
    const dialog = $("cashierResultDialog");
    if (!dialog.open) dialog.showModal();
    $("closeCashierResult").focus();
  }

  function bindCashierConfirmation() {
    const dialog = $("cashierConfirmDialog");
    $("cancelCashierAction").addEventListener("click", closeCashierConfirmation);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      closeCashierConfirmation();
    });
    $("closeCashierResult").addEventListener("click", () => $("cashierResultDialog").close());
    $("confirmCashierAction").addEventListener("click", async () => {
      if (confirmationRunning || state.busy || !pendingConfirmation) return;
      const pending = pendingConfirmation;
      const config = confirmationOptions[pending.action];
      if (state.selected?.id !== pending.orderId || state.selected?.revision !== pending.revision ||
          state.selected?.actions?.[config.permission] !== true) {
        closeCashierConfirmation();
        showCashierResult(false, "Order Changed", "Please reopen the order before continuing.", pending.orderNumber);
        return;
      }
      confirmationRunning = true;
      $("confirmCashierAction").disabled = true;
      $("cancelCashierAction").disabled = true;
      $("cashierConfirmLoading").hidden = false;
      $("cashierConfirmButtonText").textContent = "Processing…";
      $("cashierConfirmButtonIcon").className = "fa-solid fa-spinner fa-spin";
      let result;
      try {
        result = await performAction(pending.action, pending.extra);
      } catch (error) {
        result = { success: false, message: error.message };
      } finally {
        confirmationRunning = false;
        $("cashierConfirmLoading").hidden = true;
        $("confirmCashierAction").disabled = false;
        $("cancelCashierAction").disabled = false;
        closeCashierConfirmation();
      }
      showCashierResult(result?.success === true,
        result?.success === true ? config.success : "Unable to Complete Action",
        result?.message || "Please refresh the order before trying again.", pending.orderNumber);
    });
  }

  async function performAction(
    action,
    extra = {}
  ) {

    if (
      state.busy ||
      !state.selected
    ) {
      return;
    }

    const order = state.selected;

    const requiredPermission = {

      "verify-order":
        "can_verify_order",

      "verify-payment":
        "can_verify_payment",

      "release":
        "can_release"

    }[action];

    if (
      order.actions?.[requiredPermission] !== true
    ) {

      showNotice(
        "Hindi available ang action na ito.",
        true,
        true
      );

      return;

    }

    const payload = {
      revision: order.revision,
      ...extra
    };

    const operation = JSON.stringify([
      order.id,
      action,
      payload
    ]);

    if (!actionKeys.has(operation)) {

      actionKeys.set(
        operation,
        createRequestKey()
      );

    }

    state.busy = true;

    updateActionButtons();

    showNotice(
      "Processing…",
      false,
      true
    );

    try {

      const data = await api(

        `/orders/${encodeURIComponent(order.id)}/${action}`,

        {

          method: "POST",

          headers: {

            "Idempotency-Key":
              actionKeys.get(operation)

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

      return { success: true, message: data.message || "Saved successfully." };

    } catch (error) {

      showNotice(

        `${error.message} Kung naputol ang connection, i-refresh muna ang order para makita ang pinakabagong status.`,

        true,

        true

      );

      return { success: false, message: `${error.message} Please refresh the order before trying again.` };

    } finally {

      state.busy = false;

      updateActionButtons();

    }

  }


  /* =====================================================
     23. PRINT WAYBILL
     COMPLETE SHIPPING LABEL GENERATOR
  ===================================================== */

  async function printWaybill() {

    if (
      state.busy ||
      !state.selected
    ) {
      return;
    }

    const selectedOrder = state.selected;

    const initialEligibility =
      getWaybillEligibility(selectedOrder);

    if (!initialEligibility.allowed) {

      showNotice(
        initialEligibility.reason,
        true,
        true
      );

      return;

    }


    /* ===============================================
       OPEN PRINT PREVIEW WINDOW
    =============================================== */

    const printWindow = window.open(

      "",

      "_blank",

      "width=650,height=850"

    );

    if (!printWindow) {

      showNotice(
        "Please allow pop-ups to print the waybill.",
        true,
        true
      );

      return;

    }

    printWindow.opener = null;

    state.busy = true;

    updateActionButtons();

    showNotice(
      "Preparing waybill…",
      false,
      true
    );

    try {

      printWindow.document.open();

      printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="en">

        <head>

          <meta charset="UTF-8">

          <title>Preparing Waybill</title>

        </head>

        <body style="
          font-family:Arial,sans-serif;
          padding:30px;
          text-align:center;
        ">

          Preparing shipping waybill…

        </body>

        </html>

      `);

      printWindow.document.close();


      /* =============================================
         REFRESH ORDER BEFORE PRINTING

         Prevent printing outdated order details.
      ============================================= */

      const data = await api(
        `/orders/${encodeURIComponent(selectedOrder.id)}`
      );

      const order = validateOrder(data.order);

      state.selected = order;

      renderOrder();

      const eligibility =
        getWaybillEligibility(order);

      if (!eligibility.allowed) {

        throw new Error(eligibility.reason);

      }

      if (printWindow.closed) {

        throw new Error(
          "The print preview was closed."
        );

      }


      /* =============================================
         ORDER INFORMATION
      ============================================= */

      const orderNumber =
        order.waybill_order_number ||
        order.order_number ||
        order.id;

      const address = String(
        order.shipping_address ?? ""
      ).trim();

      const paymentMethod = String(
        order.payment_method || "Unknown"
      );

      const paymentStatus = String(
        order.payment_status || "Unknown"
      );

      const isCOD =
        normalize(paymentMethod) === "cod";

      const isPaid =
        normalize(paymentStatus) === "paid";

      const amountToCollect =
        isCOD && !isPaid
          ? Number(order.amount_due)
          : 0;

      const items = order.items;

      const quantities = items.map(
        (item) => Number(item.quantity)
      );

      const totalQuantity = quantities.every(
        (quantity) =>
          Number.isSafeInteger(quantity) &&
          quantity > 0
      )
        ? quantities.reduce(
            (sum, quantity) => sum + quantity,
            0
          )
        : "—";


      /* =============================================
         PARCEL ITEMS
      ============================================= */

      const itemHTML = items.map((item) => `

        <div class="parcel-item">

          <strong>

            ${escapeHTML(item.quantity ?? "—")} ×

            ${escapeHTML(
              item.title || "Unnamed item"
            )}

          </strong>

          <div class="small">

            Size: ${escapeHTML(item.size || "—")}

            |

            Color: ${escapeHTML(item.color || "—")}

          </div>

        </div>

      `).join("");


      /* =============================================
         GENERATE WAYBILL HTML
      ============================================= */

      printWindow.document.open();

      printWindow.document.write(`

        <!DOCTYPE html>

        <html lang="en">

        <head>

          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >

          <title>
            Waybill - ${escapeHTML(orderNumber)}
          </title>

          <style>

            /* =====================================
               PAGE SIZE - 4 x 6 INCHES
            ===================================== */

            @page {

              size: 4in 6in;
              margin: 4mm;

            }

            * {
              box-sizing: border-box;
            }

            html,
            body {

              margin: 0;
              padding: 0;

              background: #ffffff;
              color: #000000;

              font-family:
                Arial,
                Helvetica,
                sans-serif;

              font-size: 11px;

            }

            body {

              padding: 18px 12px;

              background: #eeeeee;

            }


            /* =====================================
               MAIN WAYBILL
            ===================================== */

            .waybill {

              width: 100%;
              max-width: 93mm;

              margin: 0 auto;

              background: #ffffff;

              border: 2px solid #000000;

            }


            /* =====================================
               WAYBILL HEADER
            ===================================== */

            .waybill-header {

              display: flex;

              align-items: center;
              justify-content: space-between;

              gap: 8px;

              padding: 10px;

              border-bottom: 2px solid #000000;

            }

            .brand {

              display: flex;

              align-items: center;

              gap: 7px;

              min-width: 0;

            }

            .logo {

              display: flex;

              align-items: center;
              justify-content: center;

              flex-shrink: 0;

              width: 36px;
              height: 36px;

              border: 2px solid #000000;
              border-radius: 50%;

              font-size: 12px;
              font-weight: 900;

            }

            .brand-name {

              font-size: 12px;
              font-weight: 900;

            }

            .brand-subtitle {

              margin-top: 3px;

              font-size: 8px;
              letter-spacing: 0.5px;

            }

            .payment-type {

              font-size: 19px;
              font-weight: 900;

              text-transform: uppercase;

            }


            /* =====================================
               WAYBILL TITLE
            ===================================== */

            .waybill-title {

              padding: 8px;

              text-align: center;

              font-size: 15px;
              font-weight: 900;

              border-bottom: 1px solid #000000;

            }


            /* =====================================
               INFORMATION SECTIONS
            ===================================== */

            .section {

              padding: 8px 10px;

              border-bottom: 1px solid #000000;

              overflow-wrap: anywhere;

            }

            .label {

              margin-bottom: 5px;

              font-size: 9px;
              font-weight: 900;

              letter-spacing: 0.6px;

              text-transform: uppercase;

            }

            .order-number {

              font-size: 14px;
              font-weight: 900;

              text-align: center;

              overflow-wrap: anywhere;

            }

            .order-date {

              margin-top: 5px;

              text-align: center;

              font-size: 9px;

            }


            /* =====================================
               RECIPIENT INFORMATION
            ===================================== */

            .recipient-name {

              margin-bottom: 5px;

              font-size: 16px;
              font-weight: 900;

            }

            .phone {

              margin-bottom: 5px;

              font-size: 12px;
              font-weight: 700;

            }

            .address {

              font-size: 12px;

              line-height: 1.45;

              white-space: pre-wrap;

              overflow-wrap: anywhere;

            }


            /* =====================================
               PAYMENT INFORMATION
            ===================================== */

            .payment-grid {

              display: grid;

              grid-template-columns: 1fr 1fr;

              border-bottom: 2px solid #000000;

            }

            .payment-cell {

              min-width: 0;

              padding: 9px;

              overflow-wrap: anywhere;

            }

            .payment-cell:first-child {

              border-right: 1px solid #000000;

            }

            .payment-value {

              font-size: 15px;
              font-weight: 900;

            }

            .cod-amount {

              font-size: 22px;
              font-weight: 900;

            }


            /* =====================================
               PARCEL DETAILS
            ===================================== */

            .parcel-item {

              padding: 5px 0;

              line-height: 1.4;

              overflow-wrap: anywhere;

            }

            .parcel-item + .parcel-item {

              border-top: 1px dashed #999999;

            }

            .small {

              font-size: 10px;

              line-height: 1.5;

            }

            .total-quantity {

              margin-top: 5px;

              font-weight: 700;

            }


            /* =====================================
               TRACKING INFORMATION
            ===================================== */

            .tracking-number {

              font-size: 13px;
              font-weight: 800;

              overflow-wrap: anywhere;

            }


            /* =====================================
               WAYBILL FOOTER
            ===================================== */

            .waybill-footer {

              padding: 8px;

              background: #000000;
              color: #ffffff;

              text-align: center;

              font-size: 11px;
              font-weight: 900;

              letter-spacing: 1px;

            }


            /* =====================================
               PRINT PREVIEW ACTIONS
            ===================================== */

            .print-controls {

              display: flex;

              justify-content: center;

              gap: 10px;

              max-width: 93mm;

              margin: 16px auto;

            }

            .print-controls button {

              flex: 1;

              padding: 12px 14px;

              border: 1px solid #000000;

              border-radius: 6px;

              background: #111111;
              color: #ffffff;

              font-family: inherit;

              font-size: 12px;
              font-weight: 700;

              cursor: pointer;

            }

            .print-controls button:hover {

              background: #333333;

            }

            .print-controls .close-button {

              background: #ffffff;
              color: #111111;

            }

            .print-controls .close-button:hover {

              background: #dddddd;

            }

            .print-description {

              max-width: 93mm;

              margin: 0 auto 15px;

              text-align: center;

              color: #555555;

              font-size: 11px;

              line-height: 1.5;

            }


            /* =====================================
               ACTUAL PRINT SETTINGS
            ===================================== */

            @media print {

              html,
              body {

                margin: 0;
                padding: 0;

                background: #ffffff;
                color: #000000;

              }

              .print-controls,
              .print-description {

                display: none !important;

              }

              .waybill {

                width: 100%;

                max-width: none;

                margin: 0;

                box-shadow: none;

              }

              .waybill-header,
              .payment-grid,
              .parcel-item,
              .recipient-section {

                break-inside: avoid;

              }

              .waybill-footer {

                background: #000000 !important;
                color: #ffffff !important;

                print-color-adjust: exact;

                -webkit-print-color-adjust: exact;

              }

            }

          </style>

        </head>


        <body>

          <div class="waybill">


            <!-- WAYBILL HEADER -->

            <header class="waybill-header">

              <div class="brand">

                <div class="logo">
                  JCN
                </div>

                <div>

                  <div class="brand-name">
                    JCN APPAREL
                  </div>

                  <div class="brand-subtitle">
                    PRINTING SERVICES
                  </div>

                </div>

              </div>

              <div class="payment-type">

                ${escapeHTML(paymentMethod)}

              </div>

            </header>


            <!-- WAYBILL TITLE -->

            <div class="waybill-title">

              SHIPPING WAYBILL

            </div>


            <!-- ORDER NUMBER -->

            <section class="section">

              <div class="label">
                Order Number
              </div>

              <div class="order-number">

                ${escapeHTML(orderNumber)}

              </div>

              <div class="order-date">

                ${escapeHTML(
                  dateTime(order.created_at)
                )}

              </div>

            </section>


            <!-- SENDER -->

            <section class="section">

              <div class="label">
                Sender
              </div>

              <strong>
                JCN Apparel Printing Services
              </strong>

            </section>


            <!-- RECIPIENT -->

            <section class="section recipient-section">

              <div class="label">
                Recipient
              </div>

              <div class="recipient-name">

                ${escapeHTML(order.customer_name)}

              </div>

              <div class="phone">

                ${escapeHTML(order.customer_phone)}

              </div>

              <div class="address">${escapeHTML(address)}</div>

            </section>


            <!-- PAYMENT INFORMATION -->

            <div class="payment-grid">

              <div class="payment-cell">

                <div class="label">
                  Payment Method
                </div>

                <div class="payment-value">

                  ${escapeHTML(paymentMethod)}

                </div>

                <div class="small">

                  ${escapeHTML(paymentStatus)}

                </div>

              </div>

              <div class="payment-cell">

                <div class="label">
                  Amount to Collect
                </div>

                <div class="cod-amount">

                  ${escapeHTML(
                    money(amountToCollect)
                  )}

                </div>

              </div>

            </div>


            <!-- PARCEL CONTENTS -->

            <section class="section">

              <div class="label">
                Parcel Contents
              </div>

              ${itemHTML}

              <div class="small total-quantity">

                Total quantity:

                ${escapeHTML(totalQuantity)}

              </div>

            </section>


            <!-- TRACKING INFORMATION -->

            <section class="section">

              <div class="label">
                Tracking Number
              </div>

              <div class="tracking-number">

                ${escapeHTML(
                  order.tracking_number ||
                  "Not yet assigned"
                )}

              </div>

              <div class="small">

                Internal JCN Shipping Label

              </div>

            </section>


            <!-- FOOTER -->

            <footer class="waybill-footer">

              HANDLE WITH CARE

            </footer>

          </div>


          <!-- PRINT PREVIEW CONTROLS -->

          <div class="print-controls">

            <button
              id="printLabelButton"
              type="button"
            >

              Print Waybill

            </button>

            <button
              id="closeLabelButton"
              type="button"
              class="close-button"
            >

              Close

            </button>

          </div>


          <p class="print-description">

            Recommended paper size: 4 × 6 inches.

            You can also choose Save as PDF from
            the browser print dialog.

          </p>

        </body>

        </html>

      `);

      printWindow.document.close();


      /* =============================================
         PRINT BUTTON
      ============================================= */

      const printLabelButton =
        printWindow.document.getElementById(
          "printLabelButton"
        );

      printLabelButton.addEventListener(
        "click",
        () => {

          printWindow.focus();

          printWindow.print();

        }
      );


      /* =============================================
         CLOSE PRINT PREVIEW
      ============================================= */

      const closeLabelButton =
        printWindow.document.getElementById(
          "closeLabelButton"
        );

      closeLabelButton.addEventListener(
        "click",
        () => {

          printWindow.close();

        }
      );

      printWindow.focus();

      showNotice(
        "Waybill preview is ready.",
        false,
        true
      );

    } catch (error) {

      if (!printWindow.closed) {

        printWindow.close();

      }

      showNotice(

        error.message ||
        "Unable to generate the shipping waybill.",

        true,

        true

      );

    } finally {

      state.busy = false;

      updateActionButtons();

    }

  }


  /* =====================================================
     24. CLOSE ORDER DETAILS
  ===================================================== */

  function closeOrder() {

    if (state.busy) return;

    ++state.detailRequest;

    state.selected = null;

    updateActionButtons();

    $("orderDialog").close();

  }


  /* =====================================================
     25. BIND DASHBOARD EVENTS
  ===================================================== */

  function bindEvents() {


    /* ===============================================
       SIDEBAR NAVIGATION
    =============================================== */

    document.querySelectorAll("[data-view]")
      .forEach((button) => {

        button.addEventListener("click", () => {

          if (state.busy) return;

          state.view = button.dataset.view;

          state.page = 1;

          document.querySelectorAll("[data-view]")
            .forEach((item) => {

              item.classList.toggle(
                "active",
                item === button
              );

            });

          $("pageTitle").textContent =

            state.view === "orders"

              ? "Orders & Payments"

              : "Payment Records";

          $("statusFilter").hidden =
            state.view !== "orders";

          loadRows();

        });

      });


    /* ===============================================
       SEARCH AND PAYMENT FILTER
    =============================================== */

    $("filterForm").addEventListener(
      "submit",
      (event) => {

        event.preventDefault();

        state.query =
          $("searchInput").value.trim();

        state.paymentStatus =
          $("paymentFilter").value;

        state.page = 1;

        loadRows();

      }
    );


    /* ===============================================
       REFRESH BUTTON
    =============================================== */

    $("refreshButton").addEventListener(
      "click",
      loadRows
    );


    /* ===============================================
       PREVIOUS PAGE
    =============================================== */

    $("previousButton").addEventListener(
      "click",
      () => {

        if (
          state.loading ||
          state.page <= 1
        ) {
          return;
        }

        state.page--;

        loadRows();

      }
    );


    /* ===============================================
       NEXT PAGE
    =============================================== */

    $("nextButton").addEventListener(
      "click",
      () => {

        if (
          state.loading ||
          state.page * PAGE_SIZE >= state.total
        ) {
          return;
        }

        state.page++;

        loadRows();

      }
    );


    /* ===============================================
       REVIEW ORDER BUTTON
    =============================================== */

    $("tableBody").addEventListener(
      "click",
      (event) => {

        const button = event.target.closest(
          "[data-order-index]"
        );

        if (
          !button ||
          state.loading
        ) {
          return;
        }

        const row = state.rows[
          Number(button.dataset.orderIndex)
        ];

        if (row?.id !== undefined) {

          openOrder(row.id);

        }

      }
    );


    /* ===============================================
       CLOSE ORDER DETAILS
    =============================================== */

    $("closeDialog").addEventListener(
      "click",
      closeOrder
    );

    $("orderDialog").addEventListener(
      "cancel",
      (event) => {

        event.preventDefault();

        closeOrder();

      }
    );


    /* ===============================================
       VERIFY ORDER
       EXISTING FUNCTIONALITY PRESERVED
    =============================================== */

    $("verifyOrderButton").addEventListener(
      "click",
      () => {

        if (
          !state.selected ||
          state.busy
        ) {
          return;
        }

        openCashierConfirmation("verify-order");

      }
    );


    /* ===============================================
       VERIFY PAYMENT
    =============================================== */

    $("paymentForm").addEventListener(
      "submit",
      (event) => {

        event.preventDefault();

        const reference =
          $("paymentReference").value.trim();

        const notes =
          $("paymentNote").value.trim();

        if (!reference) {

          showNotice(
            "Ilagay ang payment reference.",
            true,
            true
          );

          $("paymentReference").focus();

          return;

        }

        openCashierConfirmation("verify-payment", { reference, notes });

      }
    );


    /* ===============================================
       PRINT WAYBILL BUTTON
       NEW EVENT
    =============================================== */

    const printWaybillButton =
      $("printWaybillBtn");

    if (printWaybillButton) {

      printWaybillButton.addEventListener(

        "click",

        printWaybill

      );

    }


    /* ===============================================
       CONFIRM ORDER RELEASE
       EXISTING FUNCTIONALITY PRESERVED
    =============================================== */

    $("releaseButton").addEventListener(
      "click",
      () => {

        if (
          !state.selected ||
          state.busy
        ) {
          return;
        }

        openCashierConfirmation("release");

      }
    );


    /* ===============================================
       CASHIER LOGOUT CONFIRMATION
       SAME DESIGN AS ADMIN
    =============================================== */

    const cashierLogoutModal =
      document.getElementById(
        "cashierLogoutModal"
      );

    const confirmCashierLogout =
      document.getElementById(
        "confirmCashierLogout"
      );

    const cancelCashierLogout =
      document.getElementById(
        "cancelCashierLogout"
      );


    /* ===============================================
       OPEN LOGOUT MODAL
    =============================================== */

    $("logoutButton").addEventListener(
      "click",
      () => {

        if (state.busy) return;

        cashierLogoutModal.hidden = false;

        cancelCashierLogout.focus();

      }
    );


    /* ===============================================
       CANCEL LOGOUT
    =============================================== */

    cancelCashierLogout.addEventListener(
      "click",
      () => {

        cashierLogoutModal.hidden = true;

      }
    );


    /* ===============================================
       CONFIRM LOGOUT
    =============================================== */

    confirmCashierLogout.addEventListener(
      "click",
      () => {

        if (state.busy) return;

        cashierLogoutModal.hidden = true;

        signOut();

      }
    );


    /* ===============================================
       CLOSE WHEN CLICKING OUTSIDE
    =============================================== */

    cashierLogoutModal.addEventListener(
      "click",
      (event) => {

        if (
          event.target === cashierLogoutModal
        ) {

          cashierLogoutModal.hidden = true;

        }

      }
    );


    /* ===============================================
       CLOSE USING ESC KEY
    =============================================== */

    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "Escape" &&
          !cashierLogoutModal.hidden
        ) {

          cashierLogoutModal.hidden = true;

        }

      }
    );


    /* ===============================================
       SESSION STORAGE CHANGE
    =============================================== */

    window.addEventListener(
      "storage",
      (event) => {

        if (
          event.key === null ||
          event.key === "staffToken" ||
          event.key === "staffUser"
        ) {

          location.reload();

        }

      }
    );

  }


  /* =====================================================
     26. INITIALIZE CASHIER DASHBOARD
  ===================================================== */

  function init() {

    const user = readSession();

    if (!user) return;

    $("staffName").textContent =

      user.full_name ||

      user.username ||

      "Cashier";

    bindCashierConfirmation();
    bindEvents();

    updateActionButtons();

    loadRows();

  }

  init();

})();