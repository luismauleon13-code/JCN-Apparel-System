const API_URL = "http://localhost:5000";

let allOrders = [];
let myOrders = [];
let currentFilter = "All";

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  setupTabs();
  loadOrders();

  document.getElementById("logoutBtn").addEventListener("click", logoutCustomer);
});

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    alert("Please login first.");
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
      currentFilter = btn.dataset.status;

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
    const res = await fetch(`${API_URL}/api/admin/reports`);
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

function displayOrders() {
  const ordersList = document.getElementById("ordersList");

  myOrders = allOrders.filter(order => {
    const status = normalizeStatus(order.status);
    const paymentMethod = order.payment_method || "";
    const paymentStatus = order.payment_status || "";

    if (currentFilter === "All") return true;

    /* TO PAY */
    if (currentFilter === "Pending") {
      return (
        paymentMethod === "PayPal" &&
        paymentStatus !== "Paid" &&
        status !== "Cancelled"
      );
    }

    /* TO SHIP */
    if (currentFilter === "Processing") {
      return (
        status === "Processing" &&
        status !== "Cancelled" &&
        (
          paymentMethod === "COD" ||
          paymentStatus === "Paid"
        )
      );
    }

    /* TO RECEIVE */
    if (currentFilter === "Shipped") {
      return status === "Shipped";
    }

    /* COMPLETED */
    if (currentFilter === "Completed") {
      return status === "Delivered" || status === "Completed";
    }

    /* CANCELLED */
    if (currentFilter === "Cancelled") {
      return status === "Cancelled";
    }

    return true;
  });

  if (!myOrders.length) {
    ordersList.innerHTML = `<p class="empty">No orders found.</p>`;
    return;
  }

  ordersList.innerHTML = "";

  myOrders.forEach((order, index) => {
    const status = normalizeStatus(order.status);

    ordersList.innerHTML += `
      <div class="order-card" onclick="selectOrder(${index})">
        <h3>${order.order_number || "Order #" + order.id}</h3>
        <p>Total: ₱${Number(order.total_amount || 0).toFixed(2)}</p>
        <p>Payment: ${order.payment_method || "N/A"} - ${order.payment_status || "Pending"}</p>
        <p>Date: ${formatDate(order.created_at)}</p>
        <span class="status">${status}</span>
      </div>
    `;
  });
}

function selectOrder(index) {
  const order = myOrders[index];
  const details = document.getElementById("orderDetails");
  const status = normalizeStatus(order.status);

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
      <strong>${status}</strong>
    </div>

    <div class="tracker">
      ${statusStep("Pending", status)}
      ${statusStep("Processing", status)}
      ${statusStep("Shipped", status)}
      ${statusStep("Delivered", status)}
    </div>

    <div class="order-actions">
      ${
        canCancelOrder(order)
          ? `
            <button class="cancel-btn" onclick="cancelOrder('${order.id}')">
              Cancel Order
            </button>
          `
          : ""
      }

      <button class="complete-btn"
        onclick="completeOrder('${order.id}')"
        ${status !== "Delivered" ? "disabled" : ""}
      >
        Order Received / Complete Order
      </button>
    </div>
  `;
}

function canCancelOrder(order) {
  const status = normalizeStatus(order.status);

  return (
    status === "Pending" ||
    status === "Processing"
  );
}

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

  const order = ["Pending", "Processing", "Shipped", "Delivered"];
  const active = order.indexOf(step) <= order.indexOf(currentStatus);

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
  if (status === "Shipped") return "Your order is on the way.";
  if (status === "Delivered") return "Your order has been delivered.";
  return "";
}

function normalizeStatus(status) {
  if (!status) return "Pending";

  if (status === "Preparing") return "Processing";
  if (status === "To Deliver") return "Shipped";
  if (status === "Completed") return "Delivered";

  return status;
}

async function cancelOrder(orderId) {
  const confirmCancel = confirm("Are you sure you want to cancel this order?");

  if (!confirmCancel) return;

  try {
    const res = await fetch(`${API_URL}/api/customer/orders/${orderId}/cancel`, {
      method: "PATCH"
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Failed to cancel order.");
      return;
    }

    alert("Order cancelled successfully.");

    await loadOrders();

    document.getElementById("orderDetails").innerHTML =
      `<p class="empty">Select an order to view details.</p>`;

  } catch (error) {
    console.error(error);
    alert("Cannot connect to server.");
  }
}

async function completeOrder(orderId) {
  const confirmComplete = confirm("Confirm that you received this order?");

  if (!confirmComplete) return;

  alert("Order received confirmed.");
}

function formatDate(date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString();
}

function logoutCustomer() {
  if (!confirm("Are you sure you want to logout?")) return;

  localStorage.removeItem("customerToken");
  localStorage.removeItem("customerUser");
  localStorage.removeItem("customerCart");

  window.location.href = "user-login.html";
}