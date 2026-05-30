const API_URL = "http://localhost:5000";
const DELIVERY_FEE = 80;

let cart = JSON.parse(localStorage.getItem("customerCart")) || [];

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  fillCustomerInfo();
  loadOrderSummary();

  document.getElementById("checkoutForm").addEventListener("submit", confirmOrder);
  document.getElementById("logoutBtn").addEventListener("click", logoutCustomer);
  document.getElementById("goOrdersBtn").addEventListener("click", () => {
    window.location.href = "customer-orders.html";
  });
});

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    alert("Please login first.");
    window.location.href = "user-login.html";
    return;
  }

  if (!cart.length) {
    alert("Your cart is empty.");
    window.location.href = "customer-shop.html";
  }
}

function fillCustomerInfo() {

  const user =
    JSON.parse(localStorage.getItem("customerUser")) || {};

  const fullnameInput =
    document.getElementById("fullname");

  const emailInput =
    document.getElementById("email");

  const phoneInput =
    document.getElementById("phone");

  const addressInput =
    document.getElementById("address");

  if (fullnameInput)
    fullnameInput.value =
      user.full_name ||
      user.fullname ||
      "";

  if (emailInput)
    emailInput.value =
      user.email || "";

  /* AUTO FILL ONLY IF SAVED */
  if (phoneInput)
    phoneInput.value =
      user.phone || "";

  if (addressInput)
    addressInput.value =
      user.address || "";
}

function loadOrderSummary() {
  const orderItems = document.getElementById("orderItems");

  orderItems.innerHTML = "";

  cart.forEach(item => {
    const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);

    orderItems.innerHTML += `
      <div class="order-item">
        <div>
          <strong>${item.title}</strong>
          <p>${item.size || "N/A"} / ${item.color || "N/A"} / Qty: ${item.quantity}</p>
        </div>
        <strong>₱${itemTotal.toFixed(2)}</strong>
      </div>
    `;
  });

  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 1);
  }, 0);

  const total = subtotal + DELIVERY_FEE;

  document.getElementById("subtotal").textContent = `₱${subtotal.toFixed(2)}`;
  document.getElementById("deliveryFee").textContent = `₱${DELIVERY_FEE.toFixed(2)}`;
  document.getElementById("grandTotal").textContent = `₱${total.toFixed(2)}`;

  return total;
}

function generateOrderNumber() {
  const date = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `JCN-${date}-${random}`;
}

async function confirmOrder(e) {
  e.preventDefault();

  const confirmPlace = confirm("Confirm your order?");
  if (!confirmPlace) return;

  const user = JSON.parse(localStorage.getItem("customerUser")) || {};
  const orderNumber = generateOrderNumber();
  const totalAmount = updateTotals();

  const shippingAddress = document.getElementById("address").value.trim();

  try {
    const res = await fetch(`${API_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: user.id,
        order_number: orderNumber,
        customer_name: document.getElementById("fullName").value.trim(),
        customer_email: document.getElementById("email").value.trim(),
        customer_phone: document.getElementById("phone").value.trim(),
        shipping_address: shippingAddress,
        total_amount: totalAmount,
        payment_method: document.getElementById("paymentMethod").value,
        items: cart
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Order failed.");
      return;
    }

    localStorage.removeItem("customerCart");

    document.getElementById("orderNumberText").textContent = orderNumber;
    document.getElementById("successModal").classList.add("active");

  } catch (error) {
    console.error(error);
    alert("Cannot connect to server.");
  }
}

function logoutCustomer() {
  if (!confirm("Are you sure you want to logout?")) return;

  localStorage.removeItem("customerToken");
  localStorage.removeItem("customerUser");
  localStorage.removeItem("customerCart");

  window.location.href = "user-login.html";
}