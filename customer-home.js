const API_URL = "http://localhost:5000";

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("customerCart")) || [];

document.addEventListener("DOMContentLoaded", () => {
  checkCustomerLogin();
  loadCustomerName();
  loadProducts();
  loadAnnouncements();
  updateCartCount();
  loadOrderCount();

  document.getElementById("searchProduct")?.addEventListener("input", searchProducts);
  document.getElementById("logoutBtn")?.addEventListener("click", logoutCustomer);
});

/* CHECK LOGIN */
function checkCustomerLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    alert("Please login first.");
    window.location.href = "user-login.html";
  }
}

/* LOAD CUSTOMER NAME */
function loadCustomerName() {
  const user = JSON.parse(localStorage.getItem("customerUser")) || {};

  document.getElementById("customerName").textContent =
    user.fullname || user.full_name || user.username || "User";
}

/* LOAD PRODUCTS */
async function loadProducts() {
  const productList = document.getElementById("productList");

  try {
    const res = await fetch(`${API_URL}/api/admin/products`);
    const data = await res.json();

    if (!data.success) {
      productList.innerHTML = `<div class="empty-state">${data.message}</div>`;
      return;
    }

    allProducts = data.products || [];
    document.getElementById("totalProducts").textContent = allProducts.length;

    displayProducts(allProducts);

  } catch (error) {
    console.error(error);
    productList.innerHTML = `<div class="empty-state">Cannot connect to server.</div>`;
  }
}

/* DISPLAY PRODUCTS */
function displayProducts(products) {
  const productList = document.getElementById("productList");

  if (!products.length) {
    productList.innerHTML = `<div class="empty-state">No products found.</div>`;
    return;
  }

  productList.innerHTML = "";

  products.forEach(product => {
    const title = product.title || "Untitled Product";
    const desc = product.description || "No description available.";
    const price = Number(product.price || 0);
    const image = product.product_image || "https://via.placeholder.com/300x200?text=JCN+Product";

    const salePercent = Number(product.sale_percent || 0);
    const finalPrice =
      salePercent > 0
        ? price - (price * salePercent / 100)
        : price;

    productList.innerHTML += `
      <div class="product-card">
        <img src="${image}" alt="${title}">

        <div class="product-info">
          <h3>${title}</h3>
          <p>${desc}</p>

          <div class="price-row">
            <span class="price">₱${finalPrice.toFixed(2)}</span>
            ${salePercent > 0 ? `<span class="sale-badge">${salePercent}% OFF</span>` : ""}
          </div>

          <div class="product-actions">
            <button class="add-cart-btn" onclick='addToCart(${JSON.stringify(product)})'>
              Add Cart
            </button>

            <button class="buy-btn" onclick='buyNow(${JSON.stringify(product)})'>
              Buy Now
            </button>
          </div>
        </div>
      </div>
    `;
  });
}

/* SEARCH PRODUCT */
function searchProducts() {
  const keyword = document.getElementById("searchProduct").value.toLowerCase();

  const filtered = allProducts.filter(product =>
    (product.title || "").toLowerCase().includes(keyword) ||
    (product.category || "").toLowerCase().includes(keyword) ||
    (product.description || "").toLowerCase().includes(keyword)
  );

  displayProducts(filtered);
}

/* LOAD ANNOUNCEMENTS */
async function loadNotifications() {
  const notificationList = document.getElementById("notificationList");
  const notificationCount = document.getElementById("notificationCount");

  try {
    const res = await fetch(`${API_URL}/api/announcements`);
    const data = await res.json();

    if (!data.success) {
      notificationList.innerHTML =
        `<div class="empty-state">${data.message}</div>`;
      return;
    }

    const announcements = data.announcements || [];

    /* GET READ NOTIFICATIONS */
    const readNotifications =
      JSON.parse(localStorage.getItem("readNotifications")) || [];

    /* UNREAD COUNT */
    const unreadCount = announcements.filter(item =>
      !readNotifications.includes(item.id)
    ).length;

    notificationCount.textContent = unreadCount;

    if (!announcements.length) {
      notificationList.innerHTML =
        `<div class="empty-state">No notifications yet.</div>`;
      return;
    }

    notificationList.innerHTML = "";

    announcements.forEach(item => {

      const isRead = readNotifications.includes(item.id);

      notificationList.innerHTML += `
        <div class="notification-item ${isRead ? "read" : ""}"
          onclick="markAsRead('${item.id}')">

          <i class="fa-solid fa-bell"></i>

          <div>
            <h4>${item.title}</h4>
            <p>${item.message}</p>
          </div>

        </div>
      `;
    });

  } catch (error) {
    console.error(error);

    notificationList.innerHTML =
      `<div class="empty-state">Cannot load notifications.</div>`;
  }
}

/* MARK AS READ */
function markAsRead(notificationId) {

  let readNotifications =
    JSON.parse(localStorage.getItem("readNotifications")) || [];

  if (!readNotifications.includes(notificationId)) {

    readNotifications.push(notificationId);

    localStorage.setItem(
      "readNotifications",
      JSON.stringify(readNotifications)
    );
  }

  loadAnnouncements();
}

/* ADD TO CART */
function addToCart(product) {
  const price = Number(product.price || 0);
  const salePercent = Number(product.sale_percent || 0);

  const finalPrice =
    salePercent > 0
      ? price - (price * salePercent / 100)
      : price;

  cart = JSON.parse(localStorage.getItem("customerCart")) || [];

  const existing = cart.find(item =>
    item.product_id === product.id &&
    item.size === "M" &&
    item.color === "Black"
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      cartKey: `${product.id}-M-Black`,
      product_id: product.id,
      title: product.title,
      image: product.product_image,
      price: finalPrice,
      size: "M",
      color: "Black",
      quantity: 1
    });
  }

  localStorage.setItem("customerCart", JSON.stringify(cart));
  updateCartCount();

  alert("Product added to cart.");
}

/* BUY NOW */
function buyNow(product) {
  const price = Number(product.price || 0);
  const salePercent = Number(product.sale_percent || 0);

  const finalPrice =
    salePercent > 0
      ? price - (price * salePercent / 100)
      : price;

  const checkoutItem = [{
    cartKey: `${product.id}-M-Black`,
    product_id: product.id,
    title: product.title,
    image: product.product_image,
    price: finalPrice,
    size: "M",
    color: "Black",
    quantity: 1
  }];

  localStorage.setItem("customerCart", JSON.stringify(checkoutItem));
  updateCartCount();

  window.location.href = "customer-checkout.html";
}

/* CART COUNT */
function updateCartCount() {
  cart = JSON.parse(localStorage.getItem("customerCart")) || [];

  const total = cart.reduce((sum, item) => {
    return sum + Number(item.quantity || 0);
  }, 0);

  document.getElementById("cartCount").textContent = total;
}

/* ORDER COUNT - EXCLUDE CANCELLED */
async function loadOrderCount() {
  const user = JSON.parse(localStorage.getItem("customerUser")) || {};

  try {
    const res = await fetch(`${API_URL}/api/admin/reports`);
    const data = await res.json();

    if (!data.success) return;

    const myOrders = (data.orders || []).filter(order =>
      String(order.user_id) === String(user.id) &&
      order.status !== "Cancelled"
    );

    document.getElementById("orderCount").textContent = myOrders.length;

  } catch (error) {
    console.error("Cannot load orders:", error);
  }
}

/* LOGOUT */
function logoutCustomer() {
  const confirmLogout = confirm("Are you sure you want to logout?");

  if (!confirmLogout) return;

  localStorage.removeItem("customerToken");
  localStorage.removeItem("customerUser");
  localStorage.removeItem("customerCart");

  window.location.href = "user-login.html";
}