const DELIVERY_FEE = 80;

let cart = JSON.parse(localStorage.getItem("customerCart")) || [];

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  loadCart();
  setupButtons();
  setupLogoutModal?.();
});

function setupButtons() {
  document
    .getElementById("checkoutBtn")
    ?.addEventListener("click", checkout);
}

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

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    Swal.fire({
      icon: "warning",
      title: "Login Required",
      text: "Please login first.",
      confirmButtonText: "OK",
      customClass: {
        popup: "jcn-popup",
        title: "jcn-warning-title",
        confirmButton: "jcn-confirm-btn"
      },
      buttonsStyling: false
    }).then(() => {
      window.location.href = "user-login.html";
    });
  }
}

function loadCart() {
  const cartItems = document.getElementById("cartItems");
  const cartCount = document.getElementById("cartCount");
  const selectAll = document.getElementById("selectAllCart");

  if (!cartItems) return;

  cart = JSON.parse(localStorage.getItem("customerCart")) || [];

  if (cartCount) {
    cartCount.textContent = `${cart.length} item(s)`;
  }

  if (!cart.length) {
    cartItems.innerHTML = `<p class="empty">Your cart is empty.</p>`;

    if (selectAll) {
      selectAll.checked = false;
      selectAll.disabled = true;
      selectAll.indeterminate = false;
    }

    updateSummary();
    return;
  }

  if (selectAll) {
    selectAll.checked = true;
    selectAll.disabled = false;
    selectAll.indeterminate = false;
  }

  cartItems.innerHTML = "";

  cart.forEach((item, index) => {
    const key =
      item.cartKey ||
      `${item.product_id}-${item.size}-${item.color}`;

    cartItems.innerHTML += `
      <div class="cart-item">
        <input
          type="checkbox"
          class="cart-select"
          data-key="${key}"
          checked
        >

        <img
          src="${item.image || item.product_image || "https://via.placeholder.com/120?text=JCN"}"
          alt="${item.title || "Product"}"
        >

        <div class="item-info">
          <h3>${item.title || "Untitled Product"}</h3>
          <p>Size: ${item.size || "N/A"}</p>
          <p>Color: ${item.color || "N/A"}</p>
          <p class="item-price">₱${Number(item.price || 0).toFixed(2)}</p>
        </div>

        <div class="item-actions">
          <div class="qty-box">
            <button type="button" onclick="changeQty(${index}, -1)">−</button>

            <input
              type="number"
              value="${item.quantity || 1}"
              min="1"
              onchange="setQty(${index}, this.value)"
            >

            <button type="button" onclick="changeQty(${index}, 1)">+</button>
          </div>

          <button type="button" class="remove-btn" onclick="removeItem(${index})">
            <i class="fa-solid fa-trash"></i>
            Remove
          </button>
        </div>
      </div>
    `;
  });

  setupCartSelection();
  updateSummary();
}

function setupCartSelection() {
  const selectAll = document.getElementById("selectAllCart");
  const checkboxes = document.querySelectorAll(".cart-select");

  selectAll?.addEventListener("change", () => {
    checkboxes.forEach(box => {
      box.checked = selectAll.checked;
    });

    selectAll.indeterminate = false;
    updateSummary();
  });

  checkboxes.forEach(box => {
    box.addEventListener("change", () => {
      const allChecked = [...checkboxes].every(cb => cb.checked);
      const anyChecked = [...checkboxes].some(cb => cb.checked);

      if (selectAll) {
        selectAll.checked = allChecked;
        selectAll.indeterminate = !allChecked && anyChecked;
      }

      updateSummary();
    });
  });
}

function getSelectedItems() {
  const selectedKeys = [...document.querySelectorAll(".cart-select:checked")]
    .map(box => box.dataset.key);

  return cart.filter(item => {
    const key =
      item.cartKey ||
      `${item.product_id}-${item.size}-${item.color}`;

    return selectedKeys.includes(key);
  });
}

function updateSummary() {
  const selectedItems = getSelectedItems();

  const subtotal = selectedItems.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.quantity || 1);
  }, 0);

  const deliveryFee = selectedItems.length > 0 ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;

  document.getElementById("subtotal").textContent =
    `₱${subtotal.toFixed(2)}`;

  document.getElementById("deliveryFee").textContent =
    `₱${deliveryFee.toFixed(2)}`;

  document.getElementById("grandTotal").textContent =
    `₱${total.toFixed(2)}`;
}

function changeQty(index, amount) {
  if (!cart[index]) return;

  cart[index].quantity =
    Number(cart[index].quantity || 1) + amount;

  if (cart[index].quantity < 1) {
    cart[index].quantity = 1;
  }

  saveCart();
}

function setQty(index, value) {
  if (!cart[index]) return;

  const qty = Number(value);
  cart[index].quantity = !qty || qty < 1 ? 1 : qty;

  saveCart();
}

function removeItem(index) {
  if (!cart[index]) return;

  cart.splice(index, 1);
  saveCart();
}

function saveCart() {
  localStorage.setItem("customerCart", JSON.stringify(cart));
  loadCart();
}

async function checkout() {
  cart = JSON.parse(localStorage.getItem("customerCart")) || [];

  if (!cart.length) {
    await showAlert(
      "warning",
      "Cart Empty",
      "Your shopping cart is currently empty."
    );
    return;
  }

  const selectedItems = getSelectedItems();

  if (!selectedItems.length) {
    await showAlert(
      "warning",
      "No Product Selected",
      "Please select at least one product before checkout."
    );
    return;
  }

  localStorage.setItem(
    "checkoutItems",
    JSON.stringify(selectedItems)
  );

  window.location.href = "customer-checkout.html";
}