const API_URL = "http://localhost:5000";
const DELIVERY_FEE = 80;

let checkoutItems =
  JSON.parse(localStorage.getItem("checkoutItems")) ||
  JSON.parse(localStorage.getItem("customerCart")) ||
  [];

let cart = checkoutItems;
let createdSystemOrderId = null;

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  fillCustomerInfo();
  loadOrderSummary();
  setupPaymentMethod();
  setupLogoutButton();

  document
    .getElementById("checkoutForm")
    ?.addEventListener("submit", confirmOrder);

  document
    .getElementById("goOrdersBtn")
    ?.addEventListener("click", () => {
      window.location.href = "customer-orders.html";
    });
});

async function showAlert(icon, title, text) {
  await Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: "OK",
    customClass: {
      popup: "jcn-popup",
      title:
        icon === "error"
          ? "jcn-error-title"
          : icon === "success"
          ? "jcn-success-title"
          : "jcn-warning-title",
      confirmButton: "jcn-confirm-btn"
    },
    buttonsStyling: false
  });
}

async function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    await showAlert("warning", "Login Required", "Please login first.");
    window.location.href = "user-login.html";
    return;
  }

  if (!cart.length) {
    await showAlert(
      "warning",
      "No Checkout Items",
      "Please select product first."
    );

    window.location.href = "customer-shop.html";
  }
}

function fillCustomerInfo() {
  const user =
    JSON.parse(localStorage.getItem("customerUser")) || {};

  const fullnameInput =
    document.getElementById("fullName") ||
    document.getElementById("fullname");

  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const addressInput = document.getElementById("address");

  if (fullnameInput) {
    fullnameInput.value =
      user.full_name ||
      user.fullname ||
      user.username ||
      "";
  }

  if (emailInput) emailInput.value = user.email || "";
  if (phoneInput) phoneInput.value = user.phone || "";
  if (addressInput) addressInput.value = user.address || "";
}

function loadOrderSummary() {
  const orderItems = document.getElementById("orderItems");

  if (!orderItems) return;

  orderItems.innerHTML = "";

  if (!cart.length) {
    orderItems.innerHTML =
      `<p class="empty">No selected products.</p>`;

    updateTotals();
    return;
  }

  cart.forEach(item => {
    const quantity = Number(item.quantity || 1);

    orderItems.innerHTML += `
      <div class="order-item">
        <div>
          <strong>${item.title || "Untitled Product"}</strong>
          <p>
            Size: ${item.size || "N/A"} |
            Color: ${item.color || "N/A"} |
            Qty: ${quantity}
          </p>
        </div>
      </div>
    `;
  });

  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 1);
  }, 0);

  const deliveryFee = cart.length > 0 ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;

  document.getElementById("subtotal").textContent =
    `₱${subtotal.toFixed(2)}`;

  document.getElementById("deliveryFee").textContent =
    `₱${deliveryFee.toFixed(2)}`;

  document.getElementById("grandTotal").textContent =
    `₱${total.toFixed(2)}`;

  return total;
}

function generateOrderNumber() {
  const date = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `JCN-${date}-${random}`;
}

function setupPaymentMethod() {
  const paymentCards = document.querySelectorAll(".payment-card");
  const paymentInput = document.getElementById("paymentMethod");
  const paypalSection = document.getElementById("paypalSection");
  const confirmBtn = document.querySelector(".confirm-btn");

  if (!paymentCards.length || !paymentInput) return;

  paymentCards.forEach(card => {
    card.addEventListener("click", () => {
      paymentCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      const method = card.dataset.method;
      paymentInput.value = method;

      if (method === "PayPal") {
        if (paypalSection) paypalSection.style.display = "none";
        if (confirmBtn) confirmBtn.textContent = "Pay with PayPal";
      } else {
        if (paypalSection) paypalSection.style.display = "none";
        if (confirmBtn) confirmBtn.textContent = "Confirm Order";
      }
    });
  });
}

async function confirmOrder(e) {
  e.preventDefault();

  const paymentMethod =
    document.getElementById("paymentMethod")?.value || "COD";

  if (paymentMethod === "PayPal") {
    await createOrderForPayPal();
    return;
  }

  await createCODOrder();
}

async function createCODOrder() {
  const result = await Swal.fire({
    title: "Confirm Order",
    text: "Do you want to place this COD order?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Place Order",
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

  const data = await createSystemOrder("COD");

  if (!data) return;

  removeCheckedOutItemsFromCart();
  localStorage.removeItem("checkoutItems");

  showSuccessModal(data.order_number || data.orderNumber);
}

async function createOrderForPayPal() {
  const result = await Swal.fire({
    title: "PayPal Payment",
    text: "You will be redirected to the official PayPal payment page.",
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Continue to PayPal",
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

  const orderData = await createSystemOrder("PayPal");

  if (!orderData) return;

  createdSystemOrderId =
    orderData.order?.id ||
    orderData.order_id ||
    orderData.id;

  if (!createdSystemOrderId) {
    await showAlert(
      "error",
      "Order Error",
      "Order was created but no order ID was returned."
    );
    return;
  }

  localStorage.setItem("lastOrderId", createdSystemOrderId);

  try {
    const paypalRes = await fetch(
      `${API_URL}/api/paypal/create-redirect-order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          system_order_id: createdSystemOrderId
        })
      }
    );

    const paypalData = await paypalRes.json();

    if (!paypalData.success || !paypalData.approve_url) {
      await showAlert(
        "error",
        "PayPal Error",
        paypalData.message || "Cannot redirect to PayPal."
      );
      return;
    }

    window.location.href = paypalData.approve_url;

  } catch (error) {
    console.error("PAYPAL REDIRECT ERROR:", error);

    await showAlert(
      "error",
      "PayPal Error",
      "Cannot connect to PayPal server."
    );
  }
}

async function createSystemOrder(paymentMethod) {
  cart =
    JSON.parse(localStorage.getItem("checkoutItems")) ||
    JSON.parse(localStorage.getItem("customerCart")) ||
    [];

  if (!cart.length) {
    await showAlert(
      "warning",
      "No Checkout Items",
      "Please select product first."
    );

    window.location.href = "customer-shop.html";
    return null;
  }

  const user =
    JSON.parse(localStorage.getItem("customerUser")) || {};

  const orderNumber = generateOrderNumber();
  const totalAmount = updateTotals();

  const fullNameInput =
    document.getElementById("fullName") ||
    document.getElementById("fullname");

  const customerName =
    fullNameInput?.value.trim() ||
    user.fullname ||
    user.full_name ||
    user.username ||
    "Customer";

  const customerEmail =
    document.getElementById("email")?.value.trim() ||
    user.email ||
    "";

  const customerPhone =
    document.getElementById("phone")?.value.trim() ||
    user.phone ||
    "";

  const shippingAddress =
    document.getElementById("address")?.value.trim() || "";

  if (!customerName || !customerEmail || !customerPhone || !shippingAddress) {
    await showAlert(
      "warning",
      "Missing Information",
      "Please complete your shipping details."
    );
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: user.id,
        order_number: orderNumber,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        shipping_address: shippingAddress,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: paymentMethod === "PayPal" ? "Unpaid" : "COD",
        status: paymentMethod === "PayPal" ? "Pending Payment" : "Pending",
        items: cart
      })
    });

    const data = await res.json();

    if (!data.success) {
      await showAlert(
        "error",
        "Order Failed",
        data.message || "Order failed."
      );
      return null;
    }

    return {
      ...data,
      order_number: orderNumber
    };

  } catch (error) {
    console.error("CHECKOUT ERROR:", error);

    await showAlert(
      "error",
      "Connection Error",
      "Cannot connect to server."
    );

    return null;
  }
}

function showSuccessModal(orderNumber) {
  const orderNumberText =
    document.getElementById("orderNumberText");

  const successModal =
    document.getElementById("successModal");

  if (orderNumberText && successModal) {
    orderNumberText.textContent = orderNumber;
    successModal.classList.add("active");
  } else {
    window.location.href = "customer-orders.html";
  }
}

function removeCheckedOutItemsFromCart() {
  const customerCart =
    JSON.parse(localStorage.getItem("customerCart")) || [];

  const checkedOutKeys = cart.map(item =>
    item.cartKey ||
    `${item.product_id}-${item.size}-${item.color}`
  );

  const remainingCart = customerCart.filter(item => {
    const key =
      item.cartKey ||
      `${item.product_id}-${item.size}-${item.color}`;

    return !checkedOutKeys.includes(key);
  });

  localStorage.setItem(
    "customerCart",
    JSON.stringify(remainingCart)
  );
}

