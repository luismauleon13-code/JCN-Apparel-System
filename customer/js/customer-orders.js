
const API_URL = "http://localhost:5000";

let allOrders = [];
let myOrders = [];
let currentFilter = "All";
let selectedOrderId = null;
let trackingRequestId = 0;

/* ============================================
   PAGE INITIALIZATION
============================================ */

document.addEventListener("DOMContentLoaded", async () => {
  if (!checkLogin()) return;

  setupTabs();
  setupOrderEvents();

  await loadOrders();
});

/* ============================================
   CHECK CUSTOMER LOGIN
============================================ */

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    Swal.fire({
      icon: "warning",
      title: "Login Required",
      text: "Please login to view your orders.",
      confirmButtonText: "Login",
      customClass: {
        popup: "jcn-popup",
        confirmButton: "jcn-confirm-btn"
      },
      buttonsStyling: false
    }).then(() => {
      window.location.href = "user-login.html";
    });

    return false;
  }

  try {
    const customer = JSON.parse(user);

    if (!customer.id) {
      throw new Error("Customer ID missing");
    }

    return true;
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Invalid Session",
      text: "Please login again."
    }).then(() => {
      window.location.href = "user-login.html";
    });

    return false;
  }
}

/* ============================================
   SETUP STATUS TABS
============================================ */

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(tab => {
        tab.classList.remove("active");
      });

      button.classList.add("active");

      currentFilter = button.dataset.filter || "All";

      selectedOrderId = null;
      trackingRequestId++;

      displayOrders();
      showEmptyDetails();
    });
  });
}

/* ============================================
   SETUP ORDER EVENTS
============================================ */

function setupOrderEvents() {
  const ordersList = document.getElementById("ordersList");
  const details = document.getElementById("orderDetails");

  if (ordersList) {
    ordersList.addEventListener("click", event => {
      const card = event.target.closest(".order-card");

      if (!card) return;

      const orderId = card.dataset.orderId;

      if (orderId) {
        selectOrder(orderId);
      }
    });
  }

  if (details) {
    details.addEventListener("click", event => {
      const button = event.target.closest("button");

      if (!button) return;

      const action = button.dataset.action;
      const orderId = selectedOrderId;

      if (action === "refresh-tracking") {
        const order = getSelectedOrder();

        if (order) {
          loadLatestJntUpdate(order);
        }
      }

      if (action === "toggle-history") {
        toggleJntHistory();
      }

      if (!orderId) return;

      if (action === "cancel") {
        cancelOrder(orderId);
      }

      if (action === "complete") {
        completeOrder(orderId);
      }

      if (action === "pay") {
        continueToPay(orderId);
      }
    });
  }
}

/* ============================================
   GET CURRENT CUSTOMER
============================================ */

function getCurrentCustomer() {
  try {
    return JSON.parse(
      localStorage.getItem("customerUser") || "{}"
    );
  } catch {
    return {};
  }
}

/* ============================================
   LOAD CUSTOMER ORDERS
============================================ */

async function loadOrders() {
  const ordersList = document.getElementById("ordersList");
  const customer = getCurrentCustomer();

  if (!ordersList) return;

  if (!customer.id) {
    ordersList.innerHTML = `
      <p class="empty">
        Customer information is missing.
      </p>
    `;
    return;
  }

  ordersList.innerHTML = `
    <p class="empty">
      <i class="fa-solid fa-spinner fa-spin"></i>
      Loading orders...
    </p>
  `;

  try {
    const response = await fetch(
      `${API_URL}/api/customer/orders/${encodeURIComponent(customer.id)}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("customerToken")}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Unable to load customer orders."
      );
    }

    allOrders = (data.orders || [])
      .filter(order => {
        return String(order.user_id) === String(customer.id);
      })
      .sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

    displayOrders();

    if (selectedOrderId) {
      const selected = getSelectedOrder();

      if (selected && myOrders.some(order =>
        String(order.id) === String(selected.id)
      )) {
        selectOrder(selected.id);
      } else {
        selectedOrderId = null;
        showEmptyDetails();
      }
    }
  } catch (error) {
    console.error("LOAD ORDERS ERROR:", error);

    ordersList.innerHTML = `
      <p class="empty">
        ${escapeHtml(error.message)}
      </p>
    `;
  }
}

/* ============================================
   NORMALIZE ORDER STATUS
============================================ */

function normalizeStatus(status) {
  const value = String(status || "Pending")
    .trim()
    .toLowerCase();

  const statuses = {
    "pending": "Pending",
    "pending payment": "Pending",
    "to pay": "Pending",
    "preparing": "Processing",
    "processing": "Processing",
    "to ship": "To Ship",
    "ready to ship": "To Ship",
    "to deliver": "To Receive",
    "shipped": "To Receive",
    "to receive": "To Receive",
    "in transit": "To Receive",
    "out for delivery": "To Receive",
    "completed": "Completed",
    "delivered": "Completed",
    "cancelled": "Cancelled",
    "canceled": "Cancelled"
  };

  return statuses[value] || status || "Pending";
}

/* ============================================
   ORDER STATUS HELPERS
============================================ */

function isCancelledOrder(order) {
  return (
    normalizeStatus(order.status) === "Cancelled" ||
    String(order.payment_status).toLowerCase() === "cancelled"
  );
}

function isWaitingPayment(order) {
  if (isCancelledOrder(order)) return false;

  const method = String(order.payment_method || "").toLowerCase();
  const payment = String(order.payment_status || "").toLowerCase();
  const status = normalizeStatus(order.status);

  return (
    method === "paypal" &&
    payment !== "paid" &&
    (
      payment === "unpaid" ||
      payment === "pending" ||
      status === "Pending"
    )
  );
}

function getDisplayStatus(order) {
  if (isCancelledOrder(order)) return "Cancelled";

  if (isWaitingPayment(order)) return "Waiting Payment";

  return normalizeStatus(order.status);
}

function matchesFilter(order) {
  const status = normalizeStatus(order.status);
  const cancelled = isCancelledOrder(order);
  const waitingPayment = isWaitingPayment(order);

  switch (currentFilter) {
    case "Pending":
      return waitingPayment;

    case "Processing":
      return !cancelled && !waitingPayment && status === "Processing";

    case "ToShip":
      return !cancelled && !waitingPayment && status === "To Ship";

    case "ToReceive":
      return !cancelled && !waitingPayment && status === "To Receive";

    case "Completed":
      return !cancelled && !waitingPayment && status === "Completed";

    case "Cancelled":
      return cancelled;

    default:
      return true;
  }
}

/* ============================================
   DISPLAY ORDER LIST
============================================ */

function displayOrders() {
  const ordersList = document.getElementById("ordersList");

  if (!ordersList) return;

  myOrders = allOrders.filter(matchesFilter);

  if (!myOrders.length) {
    ordersList.innerHTML = `
      <p class="empty">
        <i class="fa-solid fa-box-open"></i>
        <span>No orders found.</span>
      </p>
    `;
    return;
  }

  ordersList.innerHTML = myOrders.map(order => {
    const status = getDisplayStatus(order);
    const orderNumber = order.order_number || `Order #${order.id}`;
    const isSelected = String(order.id) === String(selectedOrderId);

    const statusClass = status
      .toLowerCase()
      .replaceAll(" ", "-");

    return `
      <div
        class="order-card ${isSelected ? "selected" : ""}"
        data-order-id="${escapeHtml(order.id)}"
        role="button"
        tabindex="0"
      >

        <div class="order-card-header">
          <h3>${escapeHtml(orderNumber)}</h3>

          <span class="status ${statusClass}">
            ${escapeHtml(status)}
          </span>
        </div>

        <p>
          <i class="fa-regular fa-calendar"></i>
          ${escapeHtml(formatDate(order.created_at))}
        </p>

        <p>
          <i class="fa-solid fa-credit-card"></i>
          ${escapeHtml(order.payment_method || "N/A")}
          •
          ${escapeHtml(order.payment_status || "Pending")}
        </p>

        ${
          order.tracking_number
            ? `
              <p class="order-tracking-number">
                <i class="fa-solid fa-truck-fast"></i>
                J&T: ${escapeHtml(order.tracking_number)}
              </p>
            `
            : ""
        }

        <div class="order-card-footer">
          <span>Order Total</span>
          <strong>${formatCurrency(order.total_amount)}</strong>
        </div>

      </div>
    `;
  }).join("");

  ordersList.querySelectorAll(".order-card").forEach(card => {
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectOrder(card.dataset.orderId);
      }
    });
  });
}

/* ============================================
   GET SELECTED ORDER
============================================ */

function getSelectedOrder() {
  return allOrders.find(order =>
    String(order.id) === String(selectedOrderId)
  );
}

/* ============================================
   EMPTY ORDER DETAILS
============================================ */

function showEmptyDetails() {
  const details = document.getElementById("orderDetails");

  if (!details) return;

  details.innerHTML = `
    <div class="order-details-empty">

      <div class="empty-order-icon">
        <i class="fa-solid fa-box-open"></i>
      </div>

      <h3>Select an Order</h3>

      <p>
        Choose an order from the list to view
        payment details, delivery status,
        and J&T tracking information.
      </p>

    </div>
  `;
}

/* ============================================
   SELECT ORDER
============================================ */

function selectOrder(orderId) {
  const order = allOrders.find(item =>
    String(item.id) === String(orderId)
  );

  if (!order) return;

  selectedOrderId = String(order.id);
  trackingRequestId++;

  document.querySelectorAll(".order-card").forEach(card => {
    card.classList.toggle(
      "selected",
      card.dataset.orderId === selectedOrderId
    );
  });

  const details = document.getElementById("orderDetails");

  if (!details) return;

  const status = normalizeStatus(order.status);
  const displayStatus = getDisplayStatus(order);
  const cancelled = isCancelledOrder(order);
  const waitingPayment = isWaitingPayment(order);

  details.innerHTML = `

    <!-- ORDER SUMMARY -->
    <div class="jcn-order-summary">

      <div class="jcn-section-title">
        <i class="fa-solid fa-bag-shopping"></i>
        <span>ORDER INFORMATION</span>
      </div>

      ${detailRow(
        "Order Number",
        order.order_number || `Order #${order.id}`
      )}

      ${detailRow(
        "Customer",
        order.customer_name || "Customer"
      )}

      ${detailRow(
        "Order Date",
        formatDate(order.created_at)
      )}

      ${detailRow(
        "Payment Method",
        order.payment_method || "N/A"
      )}

      ${detailRow(
        "Payment Status",
        order.payment_status || "Pending"
      )}

      ${detailRow(
        "Total Amount",
        formatCurrency(order.total_amount),
        true
      )}

      ${detailRow(
        "Order Status",
        displayStatus
      )}

    </div>

    <!-- J&T TRACKING -->
    <div class="jcn-tracking-section">

      <div class="jcn-section-title">
        <i class="fa-solid fa-truck-fast"></i>
        <span>J&T DELIVERY TRACKING</span>
      </div>

      <div
        id="jntLatestUpdate"
        class="jnt-latest-update"
      >
        ${
          order.tracking_number && !cancelled
            ? renderShipmentJourney(order)
            : noTrackingHtml(cancelled, order)
        }
      </div>

    </div>

    <!-- ORDER ACTIONS -->
    <div class="order-actions">

      ${
        waitingPayment
          ? `
            <button
              type="button"
              class="pay-btn"
              data-action="pay"
            >
              <i class="fa-brands fa-paypal"></i>
              Continue to Pay
            </button>
          `
          : ""
      }

      ${
        canCancelOrder(order)
          ? `
            <button
              type="button"
              class="cancel-btn"
              data-action="cancel"
            >
              <i class="fa-solid fa-xmark"></i>
              Cancel Order
            </button>
          `
          : ""
      }

      ${
        !cancelled && !waitingPayment && status === "To Receive"
          ? `
            <button
              type="button"
              class="complete-btn"
              data-action="complete"
            >
              <i class="fa-solid fa-circle-check"></i>
              Order Received / Complete Order
            </button>
          `
          : ""
      }

    </div>
  `;

  if (order.tracking_number && !cancelled) {
    loadLatestJntUpdate(order);
  }
}

/* ============================================
   ORDER DETAIL ROW
============================================ */

function detailRow(label, value, highlight = false) {
  return `
    <div class="detail-row">

      <span>${escapeHtml(label)}</span>

      <strong class="${highlight ? "detail-highlight" : ""}">
        ${escapeHtml(value)}
      </strong>

    </div>
  `;
}

/* ============================================
   ORDER PROGRESS
============================================ */

function buildOrderProgress(order) {
  const status = normalizeStatus(order.status);

  if (isCancelledOrder(order)) {
    return `
      <div class="step cancelled active">
        <span class="dot"></span>

        <div>
          <strong>Cancelled</strong>
          <p>This order has been cancelled.</p>
        </div>
      </div>
    `;
  }

  const steps = isWaitingPayment(order)
    ? ["Waiting Payment", "Processing", "To Ship", "To Receive", "Completed"]
    : ["Processing", "To Ship", "To Receive", "Completed"];

  const currentStatus = isWaitingPayment(order)
    ? "Waiting Payment"
    : status;

  const currentIndex = steps.indexOf(currentStatus);

  return steps.map((step, index) => {
    const completed = currentIndex >= 0 && index < currentIndex;
    const current = index === currentIndex;
    const active = completed || current;

    return `
      <div class="step ${active ? "active" : ""} ${current ? "current" : ""}">

        <span class="dot"></span>

        <div>
          <strong>${escapeHtml(step)}</strong>

          <p>${escapeHtml(getStatusText(step))}</p>
        </div>

      </div>
    `;
  }).join("");
}

/* ============================================
   STATUS DESCRIPTION
============================================ */

function getStatusText(status) {
  const descriptions = {
    "Waiting Payment": "Waiting for PayPal payment.",
    "Processing": "Your order is being prepared.",
    "To Ship": "Your order is ready for shipment.",
    "To Receive": "Your order is on the way.",
    "Completed": "Your order has been completed."
  };

  return descriptions[status] || "";
}

/* ============================================
   SHOPEE-STYLE TRACKING - ORDER + COURIER
   No iframe, no invented courier scans.
============================================ */

function trackingLoadingHtml() {
  return `<p class="jnt-inline-note"><i class="fa-solid fa-spinner fa-spin"></i> Checking live courier updates...</p>`;
}

function noTrackingHtml(cancelled = false, order = null) {
  if (order) return renderShipmentJourney(order, null);
  return `<p class="jnt-inline-note">${cancelled ? "Order cancelled." : "Awaiting tracking number."}</p>`;
}

function getOrderSteps(order) {
  const status = normalizeStatus(order.status);
  const waiting = isWaitingPayment(order);
  const sequence = [
    { label: "Order Placed", detail: "Your order has been placed." },
    { label: "Preparing Order", detail: "Order is being processed." },
    { label: "Ready to Ship", detail: "Order is awaiting courier handoff." },
    { label: "To Receive", detail: "Shipment stage assigned by JCN." },
    { label: "Order Completed", detail: "Customer order marked complete." }
  ];
  let stage = 0;
  if (status === "Processing") stage = 1;
  if (status === "To Ship") stage = 2;
  if (status === "To Receive") stage = 3;
  if (status === "Completed") stage = 4;
  if (waiting) stage = 0;
  return { sequence, stage };
}

function renderShipmentJourney(order, tracking = null, note = "") {
  const cancelled = isCancelledOrder(order);
  const trackingNumber = String(order.tracking_number || "").trim();
  const { sequence, stage } = getOrderSteps(order);
  const status = getDisplayStatus(order);
  const rawHistory = Array.isArray(tracking?.history) ? tracking.history : [];
  const history = rawHistory.filter(x => x && (x.date || x.message || x.location))
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const currentCourier = String(tracking?.status || "").trim();
  const latest = history[0];

  const timeline = cancelled
    ? `<div class="jcn-journey-step current"><div class="jcn-journey-dot"><i class="fa-solid fa-xmark"></i></div><div><strong>Order Cancelled</strong><p>This order was cancelled.</p></div></div>`
    : sequence.map((step, index) => {
        const done = index < stage;
        const current = index === stage;
        return `<div class="jcn-journey-step ${done ? "done" : ""} ${current ? "current" : ""}">
          <div class="jcn-journey-dot"><i class="fa-solid ${done ? "fa-check" : current ? "fa-box" : "fa-circle"}"></i></div>
          <div><strong>${escapeHtml(step.label)}</strong><p>${escapeHtml(step.detail)}</p></div>
        </div>`;
      }).join("");

  const courierEvents = history.length ? `
    <h4 class="jcn-journey-subtitle"><i class="fa-solid fa-route"></i> Verified courier updates</h4>
    <div class="jcn-courier-events">${history.map((item, index) => `
      <div class="jcn-courier-event ${index === 0 ? "latest" : ""}">
        <strong>${escapeHtml(item.message || "Courier checkpoint")}</strong>
        <p>${escapeHtml(item.location || "Location unavailable")}</p>
        <small>${escapeHtml(item.date ? formatTrackingDate(item.date) : "Date unavailable")}</small>
      </div>`).join("")}</div>`
    : `<p class="jnt-inline-note">${trackingNumber ? "No verified J&T courier scans available yet." : "A J&T tracking number has not been assigned yet."}</p>`;

  return `
    <div class="jcn-journey-card">
      <div class="jcn-journey-heading">
        <strong><i class="fa-solid fa-truck-fast"></i> J&T Express Philippines</strong>
        <span class="jcn-journey-badge">${escapeHtml(cancelled ? "Cancelled" : currentCourier || status)}</span>
      </div>
      <p class="jcn-journey-number">Tracking Number: <strong>${escapeHtml(trackingNumber || "Not yet assigned")}</strong></p>
      <h4 class="jcn-journey-subtitle">Order progress</h4>
      <div class="jcn-journey-timeline">${timeline}</div>
      ${trackingNumber && !cancelled ? `
        <h4 class="jcn-journey-subtitle">J&T shipment journey</h4>
        ${latest ? `<p class="jcn-journey-latest">Latest: ${escapeHtml(latest.message || "Courier update")} ${latest.location ? "— " + escapeHtml(latest.location) : ""}</p>` : ""}
        ${courierEvents}
        <button type="button" class="jnt-history-btn" data-action="refresh-tracking">
          <i class="fa-solid fa-rotate-right"></i> Refresh tracking
        </button>` : ""}
      ${note ? `<p class="jcn-journey-warning">${escapeHtml(note)}</p>` : ""}
    </div>`;
}

async function loadLatestJntUpdate(order) {
  const container = document.getElementById("jntLatestUpdate");
  if (!container || !order || !order.tracking_number || isCancelledOrder(order)) return;
  const requestId = ++trackingRequestId;
  const orderId = String(order.id);
  container.innerHTML = renderShipmentJourney(order, null, "Checking live courier updates...");

  try {
    const token = localStorage.getItem("customerToken");
    if (!token) throw new Error("Customer login required to retrieve courier updates.");
    const response = await fetch(
      `${API_URL}/api/orders/${encodeURIComponent(order.id)}/tracking`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    let data = {};
    try { data = await response.json(); } catch { /* non-JSON server reply */ }
    if (requestId !== trackingRequestId || selectedOrderId !== orderId) return;

    if (!response.ok || !data.success) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Live courier access requires a valid customer session. Sign in again if this persists; the server tracking route must accept customer tokens.");
      }
      throw new Error(data.message || `Courier updates unavailable (HTTP ${response.status}).`);
    }
    displayJntTracking(data.tracking || {}, order);
  } catch (error) {
    if (requestId !== trackingRequestId || selectedOrderId !== orderId) return;
    console.error("J&T TRACKING ERROR:", error);
    // Preserve order progress even if AfterShip or authentication is unavailable.
    container.innerHTML = renderShipmentJourney(order, null, error.message);
  }
}

function displayJntTracking(tracking, order) {
  const container = document.getElementById("jntLatestUpdate");
  if (!container) return;
  container.innerHTML = renderShipmentJourney(order, tracking);
}

// Kept for compatibility with the existing click handler.
function toggleJntHistory() {
  const history = document.getElementById("jntTrackingHistory");
  if (history) history.hidden = !history.hidden;
}

/* ============================================
   CAN CANCEL ORDER?
============================================ */

function canCancelOrder(order) {
  const status = normalizeStatus(order.status);

  if (isCancelledOrder(order)) return false;

  if (
    status === "To Ship" ||
    status === "To Receive" ||
    status === "Completed"
  ) {
    return false;
  }

  return (
    status === "Pending" ||
    status === "Processing"
  );
}

/* ============================================
   CANCEL CUSTOMER ORDER
============================================ */

async function cancelOrder(orderId) {
  const order = allOrders.find(item =>
    String(item.id) === String(orderId)
  );

  if (!order || !canCancelOrder(order)) {
    await showError("This order can no longer be cancelled.");
    return;
  }

  const result = await Swal.fire({
    icon: "warning",
    title: "Cancel Order?",
    text: "Are you sure you want to cancel this order?",
    showCancelButton: true,
    confirmButtonText: "Yes, Cancel Order",
    cancelButtonText: "Keep Order",
    customClass: {
      popup: "jcn-popup",
      title: "jcn-warning-title",
      confirmButton: "jcn-danger-btn",
      cancelButton: "jcn-cancel-btn"
    },
    buttonsStyling: false
  });

  if (!result.isConfirmed) return;

  try {
    const response = await fetch(
      `${API_URL}/api/customer/orders/${encodeURIComponent(orderId)}/cancel`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("customerToken")}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to cancel order."
      );
    }

    showSuccess("Order cancelled successfully.");

    await loadOrders();
  } catch (error) {
    console.error("CANCEL ORDER ERROR:", error);
    await showError(error.message);
  }
}

/* ============================================
   COMPLETE CUSTOMER ORDER
============================================ */

async function completeOrder(orderId) {
  const order = allOrders.find(item =>
    String(item.id) === String(orderId)
  );

  if (
    !order ||
    isCancelledOrder(order) ||
    normalizeStatus(order.status) !== "To Receive"
  ) {
    await showError("This order is not ready for receipt confirmation.");
    return;
  }

  const result = await Swal.fire({
    icon: "question",
    title: "Order Received?",
    text: "Confirm that you have already received this order.",
    showCancelButton: true,
    confirmButtonText: "Yes, I Received It",
    cancelButtonText: "Cancel",
    customClass: {
      popup: "jcn-popup",
      confirmButton: "jcn-confirm-btn",
      cancelButton: "jcn-cancel-btn"
    },
    buttonsStyling: false
  });

  if (!result.isConfirmed) return;

  try {
    const response = await fetch(
      `${API_URL}/api/customer/orders/${encodeURIComponent(orderId)}/complete`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("customerToken")}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to complete order."
      );
    }

    showSuccess("Order received successfully!");

    await loadOrders();
  } catch (error) {
    console.error("COMPLETE ORDER ERROR:", error);
    await showError(error.message);
  }
}

/* ============================================
   CONTINUE PAYPAL PAYMENT
============================================ */

async function continueToPay(orderId) {
  const order = allOrders.find(item =>
    String(item.id) === String(orderId)
  );

  if (!order || !isWaitingPayment(order)) {
    await showError("This order is not awaiting PayPal payment.");
    return;
  }

  try {
    Swal.fire({
      title: "Connecting to PayPal",
      text: "Preparing your payment...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const response = await fetch(
      `${API_URL}/api/paypal/create-redirect-order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("customerToken")}`
        },
        body: JSON.stringify({
          system_order_id: orderId
        })
      }
    );

    const data = await response.json();

    Swal.close();

    if (!response.ok || !data.success || !data.approve_url) {
      throw new Error(
        data.message || "Unable to continue PayPal payment."
      );
    }

    const approveUrl = new URL(data.approve_url);

    if (
      approveUrl.protocol !== "https:" ||
      !(
        approveUrl.hostname === "paypal.com" ||
        approveUrl.hostname.endsWith(".paypal.com")
      )
    ) {
      throw new Error("Invalid PayPal approval URL.");
    }

    localStorage.setItem("lastOrderId", orderId);

    if (data.paypal_order_id) {
      localStorage.setItem(
        "paypalOrderId",
        data.paypal_order_id
      );
    }

    window.location.href = approveUrl.href;
  } catch (error) {
    Swal.close();

    console.error("PAYPAL PAYMENT ERROR:", error);
    await showError(error.message);
  }
}

/* ============================================
   SUCCESS TOAST
============================================ */

function showSuccess(message) {
  const existing = document.querySelector(".jcn-success-toast");

  if (existing) existing.remove();

  const toast = document.createElement("div");

  toast.className = "jcn-success-toast";

  toast.innerHTML = `
    <i class="fa-solid fa-circle-check"></i>
    <span>${escapeHtml(message)}</span>
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2500);
}

/* ============================================
   ERROR ALERT
============================================ */

async function showError(message) {
  await Swal.fire({
    icon: "error",
    title: "Error",
    text: String(message || "An error occurred."),
    confirmButtonText: "OK",
    customClass: {
      popup: "jcn-popup",
      confirmButton: "jcn-confirm-btn"
    },
    buttonsStyling: false
  });
}

/* ============================================
   FORMAT CURRENCY
============================================ */

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(amount) || 0);
}

/* ============================================
   FORMAT ORDER DATE
============================================ */

function formatDate(value) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

/* ============================================
   FORMAT TRACKING DATE
============================================ */

function formatTrackingDate(value) {
  if (!value) return "Waiting for update";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

/* ============================================
   HTML SECURITY
============================================ */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ============================================
   GLOBAL FUNCTIONS
============================================ */

window.selectOrder = selectOrder;
window.cancelOrder = cancelOrder;
window.completeOrder = completeOrder;
window.continueToPay = continueToPay;
window.toggleJntHistory = toggleJntHistory;
window.loadOrders = loadOrders;
