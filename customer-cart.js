const API_URL = "http://localhost:5000";
const DELIVERY_FEE = 80;

let cart = JSON.parse(localStorage.getItem("customerCart")) || [];

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  loadCart();

  document.getElementById("checkoutBtn").addEventListener("click", checkout);
  document.getElementById("continueBtn").addEventListener("click", () => {
    window.location.href = "customer-shop.html";
  });
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

function loadCart() {
  const cartItems = document.getElementById("cartItems");

  if (!cart.length) {
    cartItems.innerHTML = `<p class="empty">Your cart is empty.</p>`;
    updateSummary();
    return;
  }

  cartItems.innerHTML = "";

  cart.forEach((item, index) => {
    cartItems.innerHTML += `
      <div class="cart-item">
        <img src="${item.image || item.product_image || "https://via.placeholder.com/120?text=JCN"}" alt="${item.title}">

        <div class="item-info">
          <h3>${item.title}</h3>
          <p>Size: ${item.size || "N/A"}</p>
          <p>Color: ${item.color || "N/A"}</p>
          <p class="item-price">₱${Number(item.price || 0).toFixed(2)}</p>
        </div>

        <div class="item-actions">
          <div class="qty-box">
            <button onclick="changeQty(${index}, -1)">−</button>
            <input type="number" value="${item.quantity}" min="1" onchange="setQty(${index}, this.value)">
            <button onclick="changeQty(${index}, 1)">+</button>
          </div>

          <button class="remove-btn" onclick="removeItem(${index})">
            <i class="fa-solid fa-trash"></i> Remove
          </button>
        </div>
      </div>
    `;
  });

  updateSummary();
}

function changeQty(index, amount) {
  cart[index].quantity = Number(cart[index].quantity || 1) + amount;

  if (cart[index].quantity < 1) {
    cart[index].quantity = 1;
  }

  saveCart();
}

function setQty(index, value) {
  const qty = Number(value);

  if (!qty || qty < 1) {
    cart[index].quantity = 1;
  } else {
    cart[index].quantity = qty;
  }

  saveCart();
}

function removeItem(index) {
  const confirmRemove = confirm("Remove this product from cart?");

  if (!confirmRemove) return;

  cart.splice(index, 1);
  saveCart();
}

function saveCart() {
  localStorage.setItem("customerCart", JSON.stringify(cart));
  loadCart();
}

function updateSummary() {
  const subtotal = cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 1);
  }, 0);

  const totalItems = cart.reduce((sum, item) => {
    return sum + Number(item.quantity || 1);
  }, 0);

  const total = cart.length ? subtotal + DELIVERY_FEE : 0;

  document.getElementById("cartCount").textContent = `${totalItems} item(s)`;
  document.getElementById("subtotal").textContent = `₱${subtotal.toFixed(2)}`;
  document.getElementById("deliveryFee").textContent = cart.length ? `₱${DELIVERY_FEE.toFixed(2)}` : "₱0.00";
  document.getElementById("grandTotal").textContent = `₱${total.toFixed(2)}`;
}

async function checkout() {
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }

  const proceed = confirm("Proceed to checkout?");
  if (!proceed) return;

  const user = JSON.parse(localStorage.getItem("customerUser")) || {};
  const paymentMethod = document.getElementById("paymentMethod").value;

  const subtotal = cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 1);
  }, 0);

  const totalAmount = subtotal + DELIVERY_FEE;

  try {
    const res = await fetch(`${API_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: user.id,
        customer_name: user.fullname || user.username || "Customer",
        customer_email: user.email || "",
        customer_phone: user.phone || "",
        total_amount: totalAmount,
        payment_method: paymentMethod
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Checkout failed.");
      return;
    }

    localStorage.removeItem("customerCart");
    cart = [];

    alert("Order placed successfully!");
    window.location.href = "customer-checkout.html";

  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
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