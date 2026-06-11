const API_URL = "http://localhost:5000";

let allOrders = [];
let myOrders = [];
let currentFilter = "All";

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  setupTabs();
  loadOrders();

  document
    .getElementById("logoutBtn")
    ?.addEventListener("click", logoutCustomer);
});

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    showError("Please login first.");
    window.location.href = "user-login.html";
  }
}

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => {
        b.classList.remove("active");
      });

      btn.classList.add("active");
      currentFilter = btn.dataset.filter || btn.dataset.status;

      displayOrders();

      document.getElementById("orderDetails").innerHTML =
        `<p class="empty">Select an order to view details.</p>`;
    });
  });
}

async function loadOrders() {
  const ordersList = document.getElementById("ordersList");
  const user = JSON.parse(localStorage.getItem("customerUser")) || {};

  try {
    const res = await fetch(`${API_URL}/api/customer/orders/${user.id}`);
    const data = await res.json();

    if (!data.success) {
      ordersList.innerHTML = `<p class="empty">${data.message}</p>`;
      return;
    }

    allOrders = (data.orders || []).filter(order =>
      String(order.user_id) === String(user.id)
    );

    displayOrders();

  } catch (error) {
    console.error(error);
    ordersList.innerHTML = `<p class="empty">Cannot connect to server.</p>`;
  }
}

/* DISPLAY ORDERS */
function displayOrders() {
  const ordersList = document.getElementById("ordersList");

  myOrders = allOrders.filter(order => {
  const status = normalizeStatus(order.status);
  const paymentStatus = order.payment_status || "";

  const isCancelled =
    status === "Cancelled" ||
    order.status === "Cancelled" ||
    paymentStatus === "Cancelled";

  const isToPay =
    !isCancelled &&
    (
      order.status === "Pending Payment" ||
      paymentStatus === "Unpaid"
    );

  if (currentFilter === "All") {
    return true;
  }

  if (currentFilter === "Pending") {
    return isToPay;
  }

  if (currentFilter === "Processing") {
    return !isCancelled && status === "Processing";
  }

  if (currentFilter === "ToShip") {
    return !isCancelled && status === "To Ship";
  }

  if (currentFilter === "ToReceive") {
    return !isCancelled && status === "To Receive";
  }

  if (currentFilter === "Completed") {
    return !isCancelled && status === "Completed";
  }

  if (currentFilter === "Cancelled") {
    return isCancelled;
  }

  return true;
});

  if (!myOrders.length) {
    ordersList.innerHTML = `<p class="empty">No orders found.</p>`;
    return;
  }

  ordersList.innerHTML = "";

  myOrders.forEach((order, index) => {
    let status = normalizeStatus(order.status);

const isWaitingPayment =
  order.status === "Pending Payment" ||
  (
    order.payment_status === "Unpaid" &&
    order.status !== "Cancelled"
  );

if (order.status === "Cancelled") {
  status = "Cancelled";
}
else if (isWaitingPayment) {
  status = "Waiting Payment";
}

    ordersList.innerHTML += `
      <div class="order-card" onclick="selectOrder(${index})">
        <h3>${order.order_number || "Order #" + order.id}</h3>

        <p>Total: ₱${Number(order.total_amount || 0).toFixed(2)}</p>

        <p>
          Payment: ${order.payment_method || "N/A"} -
          ${order.payment_status || "Pending"}
        </p>

        <p>Date: ${formatDate(order.created_at)}</p>

        <span class="status ${status.toLowerCase().replaceAll(" ", "-")}">
          ${status}
        </span>
      </div>
    `;
  });
}

/* SELECT ORDER */
function selectOrder(index) {
  const order = myOrders[index];
  const details = document.getElementById("orderDetails");
  const status = normalizeStatus(order.status);

  const isPayPalUnpaid =
  order.payment_method === "PayPal" &&
  order.payment_status === "Unpaid" &&
  order.status !== "Cancelled";

  details.innerHTML = `
    <div class="detail-row">
      <span>Order Number</span>
      <strong>${order.order_number || "Order #" + order.id}</strong>
    </div>

    <div class="detail-row">
      <span>Customer</span>
      <strong>${order.customer_name || "Customer"}</strong>
    </div>

    <div class="detail-row">
      <span>Payment Method</span>
      <strong>${order.payment_method || "N/A"}</strong>
    </div>

    <div class="detail-row">
      <span>Payment Status</span>
      <strong>${order.payment_status || "Pending"}</strong>
    </div>

    <div class="detail-row">
      <span>Total</span>
      <strong>₱${Number(order.total_amount || 0).toFixed(2)}</strong>
    </div>

    <div class="detail-row">
      <span>Status</span>
      <strong>${isPayPalUnpaid ? "Waiting Payment" : status}</strong>
    </div>

    <div class="tracker">
  ${
    status === "Cancelled"
      ? `
        <div class="step cancelled active">
          <span class="dot"></span>
          <div>
            <strong>Cancelled</strong>
            <p>This order has been cancelled.</p>
          </div>
        </div>
      `
      : isPayPalUnpaid
      ? `
        <div class="step active">
          <span class="dot"></span>
          <div>
            <strong>Waiting Payment</strong>
            <p>Waiting for PayPal payment.</p>
          </div>
        </div>

        <div class="step">
          <span class="dot"></span>
          <div>
            <strong>Processing</strong>
            <p>Your order is being prepared.</p>
          </div>
        </div>

        <div class="step">
          <span class="dot"></span>
          <div>
            <strong>To Ship</strong>
            <p>Your order is ready to ship.</p>
          </div>
        </div>

        <div class="step">
          <span class="dot"></span>
          <div>
            <strong>To Receive</strong>
            <p>Your order is on the way.</p>
          </div>
        </div>

        <div class="step">
          <span class="dot"></span>
          <div>
            <strong>Completed</strong>
            <p>Your order has been completed.</p>
          </div>
        </div>
      `
      : `
        ${statusStep("Processing", status)}
        ${statusStep("To Ship", status)}
        ${statusStep("To Receive", status)}
        ${statusStep("Completed", status)}
      `
  }
</div>

    <div class="order-actions">

      ${
        isPayPalUnpaid
          ? `
            <button type="button" class="pay-btn" onclick="window.continueToPay('${order.id}')">
              Continue to Pay
            </button>
          `
          : ""
      }

      ${
        canCancelOrder(order)
          ? `
            <button type="button" class="cancel-btn" onclick="window.cancelOrder('${order.id}')">
              Cancel Order
            </button>
          `
          : ""
      }

      <button
        type="button"
        class="complete-btn"
        onclick="window.completeOrder('${order.id}')"
        ${status !== "To Receive" ? "disabled" : ""}
      >
        Order Received / Complete Order
      </button>
    </div>
  `;
}

async function continueToPay(orderId) {
  try {
    const res = await fetch(`${API_URL}/api/paypal/create-redirect-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        system_order_id: orderId
      })
    });

    const data = await res.json();

    if (!data.success || !data.approve_url) {
      showError(data.message || "Cannot continue PayPal payment.");
      return;
    }

    window.location.href = data.approve_url;

  } catch (error) {
    console.error(error);
    showError("Cannot connect to PayPal server.");
  }
}

function canCancelOrder(order) {
  const status = normalizeStatus(order.status);

  return (
    status === "Pending" ||
    status === "Processing" ||
    order.status === "Pending Payment" ||
    order.payment_status === "Unpaid"
  );
}

window.selectOrder = selectOrder;
window.continueToPay = continueToPay;
window.cancelOrder = cancelOrder;
window.completeOrder = completeOrder;


function statusStep(step, currentStatus) {
  if (currentStatus === "Cancelled") {
    return `
      <div class="step">
        <span class="dot"></span>
        <div>
          <strong>${step}</strong>
          <p>${getStatusText(step)}</p>
        </div>
      </div>
    `;
  }

  const orderSteps = [
    "Pending",
    "Processing",
    "To Ship",
    "To Receive",
    "Completed"
  ];

  const active =
    orderSteps.indexOf(step) <= orderSteps.indexOf(currentStatus);

  return `
    <div class="step ${active ? "active" : ""}">
      <span class="dot"></span>
      <div>
        <strong>${step}</strong>
        <p>${getStatusText(step)}</p>
      </div>
    </div>
  `;
}

function getStatusText(status) {
  if (status === "Pending") return "Waiting for payment.";
  if (status === "Processing") return "Your order is being prepared.";
  if (status === "To Ship") return "Your order is ready to ship.";
  if (status === "To Receive") return "Your order is on the way.";
  if (status === "Completed") return "Your order has been completed.";
  return "";
}

function normalizeStatus(status) {
  if (!status) return "Pending";

  if (status === "Preparing") return "Processing";
  if (status === "Processing") return "Processing";

  if (status === "To Pay") return "Pending";
  if (status === "Pending") return "Pending";

  if (status === "To Ship") return "To Ship";
  if (status === "To Deliver") return "To Receive";
  if (status === "Shipped") return "To Receive";
  if (status === "To Receive") return "To Receive";

  if (status === "Completed") return "Completed";
  if (status === "Delivered") return "Completed";

  if (status === "Cancelled") return "Cancelled";
  if (status === "Canceled") return "Cancelled";

  return status;
}

/* CANCEL ORDER */
async function cancelOrder(orderId) {
  const result = await Swal.fire({
    title: "Cancel Order",
    text: "Are you sure you want to cancel this order?",
    icon: "warning",
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
    const res = await fetch(
      `${API_URL}/api/customer/orders/${orderId}/cancel`,
      {
        method: "PATCH"
      }
    );

    const data = await res.json();

    if (!data.success) {
      showError(data.message || "Failed to cancel order.");
      return;
    }

    showSuccess("Order cancelled successfully.");

    await loadOrders();

    document.getElementById("orderDetails").innerHTML =
      `<p class="empty">Select an order to view details.</p>`;

  } catch (error) {
    console.error(error);
    showError("Cannot connect to server.");
  }
}

/* COMPLETE ORDER */
async function completeOrder(orderId) {
  const result = await Swal.fire({
    title: "Complete Order",
    text: "Confirm that you already received this order?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, I Received It",
    cancelButtonText: "Cancel",
    customClass: {
      popup: "jcn-popup",
      title: "jcn-title",
      confirmButton: "jcn-confirm-btn",
      cancelButton: "jcn-cancel-btn"
    },
    buttonsStyling: false
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(
      `${API_URL}/api/customer/orders/${orderId}/complete`,
      {
        method: "PATCH"
      }
    );

    const data = await res.json();

    if (!data.success) {
      showError(data.message || "Failed to complete order.");
      return;
    }

    showSuccess("Order received successfully.");

    await loadOrders();

    document.getElementById("orderDetails").innerHTML =
      `<p class="empty">Select an order to view details.</p>`;

  } catch (error) {
    console.error(error);
    showError("Cannot connect to server.");
  }
}

/* TOAST SUCCESS */
function showSuccess(message) {
  const oldToast = document.querySelector(".jcn-success-toast");
  if (oldToast) oldToast.remove();

  const toast = document.createElement("div");

  toast.className = "jcn-success-toast";

  toast.innerHTML = `
    <i class="fa-solid fa-circle-check"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 50);

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 300);

  }, 2500);
}

/* ERROR ALERT */
async function showError(message) {
  await Swal.fire({
    icon: "error",
    title: "Error",
    text: message,
    confirmButtonText: "OK",
    customClass: {
      popup: "jcn-popup",
      title: "jcn-error-title",
      confirmButton: "jcn-confirm-btn"
    },
    buttonsStyling: false
  });
}

function formatDate(date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString();
}