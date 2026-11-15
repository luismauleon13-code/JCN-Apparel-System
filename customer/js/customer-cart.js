
/* ============================================
   JCN APPAREL - CUSTOMER CART
   CUSTOMER-SPECIFIC LOCAL STORAGE
============================================ */

const DELIVERY_FEE = 80;

let cart = [];
let selectedCartIndexes = new Set();

/* ============================================
   GET LOGGED-IN CUSTOMER
============================================ */

function getCartCustomer() {
  try {
    return JSON.parse(
      localStorage.getItem("customerUser") || "{}"
    );
  } catch (error) {
    console.error("CUSTOMER DATA ERROR:", error);
    return {};
  }
}

/* ============================================
   GET UNIQUE CUSTOMER CART KEY
============================================ */

function getCustomerCartKey() {
  const customer = getCartCustomer();

  if (!customer.id) {
    return null;
  }

  return `customerCart_${customer.id}`;
}

/* ============================================
   LOAD SAVED CUSTOMER CART
============================================ */

function getSavedCart() {
  const cartKey = getCustomerCartKey();

  if (!cartKey) {
    return [];
  }

  try {
    const storedCart = JSON.parse(
      localStorage.getItem(cartKey) || "[]"
    );

    return Array.isArray(storedCart)
      ? storedCart
      : [];

  } catch (error) {
    console.error("CART STORAGE ERROR:", error);
    return [];
  }
}

/* ============================================
   INITIALIZE
============================================ */

document.addEventListener("DOMContentLoaded", () => {
  if (!checkLogin()) return;

  loadCart();
  setupButtons();

  if (typeof setupLogoutModal === "function") {
    setupLogoutModal();
  }
});

/* ============================================
   SETUP BUTTONS
============================================ */

function setupButtons() {
  document
    .getElementById("checkoutBtn")
    ?.addEventListener("click", checkout);

  document
    .getElementById("selectAllCart")
    ?.addEventListener("change", event => {
      if (event.target.checked) {
        selectedCartIndexes = new Set(
          cart.map((item, index) => index)
        );
      } else {
        selectedCartIndexes.clear();
      }

      renderCart();
    });
}

/* ============================================
   SWEETALERT
============================================ */

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

/* ============================================
   CHECK CUSTOMER LOGIN
============================================ */

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const customer = getCartCustomer();

  if (!token || !customer.id) {
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

    return false;
  }

  return true;
}

/* ============================================
   LOAD CART
============================================ */

function loadCart() {
  cart = getSavedCart();

  selectedCartIndexes = new Set(
    cart.map((item, index) => index)
  );

  renderCart();
}

/* ============================================
   ESCAPE HTML
============================================ */

function escapeCartHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ============================================
   RENDER CART
============================================ */

function renderCart() {
  const cartItems = document.getElementById("cartItems");
  const cartCount = document.getElementById("cartCount");
  const selectAll = document.getElementById("selectAllCart");

  if (!cartItems) return;

  if (cartCount) {
    cartCount.textContent = `${cart.length} item(s)`;
  }

  if (!cart.length) {
    cartItems.innerHTML =
      '<p class="empty">Your cart is empty.</p>';

    if (selectAll) {
      selectAll.checked = false;
      selectAll.disabled = true;
      selectAll.indeterminate = false;
    }

    updateSummary();
    return;
  }

  cartItems.innerHTML = "";

  cart.forEach((item, index) => {
    const image =
      item.image ||
      item.product_image ||
      "https://placehold.co/120x120?text=JCN";

    const quantity = Math.max(
      1,
      Math.floor(Number(item.quantity) || 1)
    );

    const itemElement = document.createElement("div");
    itemElement.className = "cart-item";

    itemElement.innerHTML = `
      <input
        type="checkbox"
        class="cart-select"
        data-index="${index}"
        ${selectedCartIndexes.has(index) ? "checked" : ""}
      >

      <img
        alt="Product"
        class="cart-product-image"
      >

      <div class="item-info">
        <h3>${escapeCartHTML(item.title || "Untitled Product")}</h3>

        <p>
          Size: ${escapeCartHTML(item.size || "N/A")}
        </p>

        <p>
          Color: ${escapeCartHTML(item.color || "N/A")}
        </p>

        <p class="item-price">
          ₱${Number(item.price || 0).toFixed(2)}
        </p>
      </div>

      <div class="item-actions">
        <div class="qty-box">
          <button
            type="button"
            class="qty-minus"
          >−</button>

          <input
            type="number"
            class="qty-input"
            value="${quantity}"
            min="1"
            step="1"
          >

          <button
            type="button"
            class="qty-plus"
          >+</button>
        </div>

        <button
          type="button"
          class="remove-btn"
        >
          <i class="fa-solid fa-trash"></i>
          Remove
        </button>
      </div>
    `;

    const imageElement =
      itemElement.querySelector(".cart-product-image");

    imageElement.src = image;
    imageElement.onerror = () => {
      imageElement.onerror = null;
      imageElement.src =
        "https://placehold.co/120x120?text=JCN";
    };

    itemElement
      .querySelector(".cart-select")
      .addEventListener("change", event => {
        if (event.target.checked) {
          selectedCartIndexes.add(index);
        } else {
          selectedCartIndexes.delete(index);
        }

        updateSelectAll();
        updateSummary();
      });

    itemElement
      .querySelector(".qty-minus")
      .addEventListener("click", () => {
        changeQty(index, -1);
      });

    itemElement
      .querySelector(".qty-plus")
      .addEventListener("click", () => {
        changeQty(index, 1);
      });

    itemElement
      .querySelector(".qty-input")
      .addEventListener("change", event => {
        setQty(index, event.target.value);
      });

    itemElement
      .querySelector(".remove-btn")
      .addEventListener("click", () => {
        removeItem(index);
      });

    cartItems.appendChild(itemElement);
  });

  updateSelectAll();
  updateSummary();
}

/* ============================================
   SELECT ALL CART ITEMS
============================================ */

function updateSelectAll() {
  const selectAll = document.getElementById("selectAllCart");

  if (!selectAll) return;

  const selectedCount = selectedCartIndexes.size;

  selectAll.disabled = cart.length === 0;

  selectAll.checked =
    cart.length > 0 &&
    selectedCount === cart.length;

  selectAll.indeterminate =
    selectedCount > 0 &&
    selectedCount < cart.length;
}

/* ============================================
   GET SELECTED ITEMS
============================================ */

function getSelectedItems() {
  return cart.filter((item, index) => {
    return selectedCartIndexes.has(index);
  });
}

/* ============================================
   UPDATE SUMMARY
============================================ */

function updateSummary() {
  const selectedItems = getSelectedItems();

  const subtotal = selectedItems.reduce((sum, item) => {
    return sum +
      Number(item.price || 0) *
      Number(item.quantity || 1);
  }, 0);

  const deliveryFee =
    selectedItems.length > 0 ? DELIVERY_FEE : 0;

  const total = subtotal + deliveryFee;

  const subtotalElement =
    document.getElementById("subtotal");

  const deliveryElement =
    document.getElementById("deliveryFee");

  const totalElement =
    document.getElementById("grandTotal");

  if (subtotalElement) {
    subtotalElement.textContent =
      `₱${subtotal.toFixed(2)}`;
  }

  if (deliveryElement) {
    deliveryElement.textContent =
      `₱${deliveryFee.toFixed(2)}`;
  }

  if (totalElement) {
    totalElement.textContent =
      `₱${total.toFixed(2)}`;
  }
}

/* ============================================
   CHANGE QUANTITY
============================================ */

function changeQty(index, amount) {
  if (!cart[index]) return;

  const currentQty = Math.max(
    1,
    Math.floor(Number(cart[index].quantity) || 1)
  );

  cart[index].quantity = Math.max(
    1,
    currentQty + amount
  );

  saveCart();
}

function setQty(index, value) {
  if (!cart[index]) return;

  const qty = Number(value);

  cart[index].quantity =
    Number.isFinite(qty) && qty >= 1
      ? Math.floor(qty)
      : 1;

  saveCart();
}

/* ============================================
   REMOVE PRODUCT
============================================ */

function removeItem(index) {
  if (!cart[index]) return;

  cart.splice(index, 1);

  const newSelection = new Set();

  selectedCartIndexes.forEach(selectedIndex => {
    if (selectedIndex < index) {
      newSelection.add(selectedIndex);
    } else if (selectedIndex > index) {
      newSelection.add(selectedIndex - 1);
    }
  });

  selectedCartIndexes = newSelection;

  saveCart();
}

/* ============================================
   SAVE CUSTOMER-SPECIFIC CART
============================================ */

function saveCart() {
  const cartKey = getCustomerCartKey();

  if (!cartKey) {
    console.error(
      "Unable to save cart: No logged-in customer."
    );
    return;
  }

  localStorage.setItem(
    cartKey,
    JSON.stringify(cart)
  );

  renderCart();
}



/* ============================================
   CHECKOUT
============================================ */

async function checkout() {
  const cartKey = getCustomerCartKey();

  if (!cartKey || !localStorage.getItem("customerToken")) {
    await showAlert(
      "warning",
      "Login Required",
      "Please login first."
    );
    return;
  }

  cart = getSavedCart();

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


/* ==========================================
   JCN CUSTOMER CART - MOBILE SIDEBAR
========================================== */

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  const main = document.querySelector(".main");

  if (!sidebar || !main) return;

  // Prevent duplicate initialization
  if (document.getElementById("jcnMobileMenuBtn")) return;

  // Create hamburger button
  const menuBtn = document.createElement("button");

  menuBtn.id = "jcnMobileMenuBtn";
  menuBtn.type = "button";
  menuBtn.className = "jcn-mobile-menu-btn";
  menuBtn.setAttribute("aria-label", "Open navigation menu");
  menuBtn.setAttribute("aria-expanded", "false");

  menuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';

  // Create sidebar overlay
  const overlay = document.createElement("div");
  overlay.className = "jcn-sidebar-overlay";

  // Insert button and overlay
  main.prepend(menuBtn);
  document.body.appendChild(overlay);

  function closeSidebar() {
    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("active");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("jcn-menu-open");
  }

  function openSidebar() {
    sidebar.classList.add("mobile-open");
    overlay.classList.add("active");
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("jcn-menu-open");
  }

  menuBtn.addEventListener("click", () => {
    if (sidebar.classList.contains("mobile-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  overlay.addEventListener("click", closeSidebar);

  sidebar.querySelectorAll(".menu a").forEach(link => {
    link.addEventListener("click", closeSidebar);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSidebar();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 800) closeSidebar();
  });
});

