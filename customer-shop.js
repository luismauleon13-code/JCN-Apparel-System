const API_URL = "http://localhost:5000";

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("customerCart")) || [];

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  loadProducts();
  updateCartCount();

  document.getElementById("searchInput").addEventListener("input", filterProducts);
  document.getElementById("categoryFilter").addEventListener("change", filterProducts);
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

async function loadProducts() {
  const productList = document.getElementById("productList");

  try {
    const res = await fetch(`${API_URL}/api/admin/products`);
    const data = await res.json();

    if (!data.success) {
      productList.innerHTML = `<p class="empty">${data.message}</p>`;
      return;
    }

    allProducts = data.products || [];
    loadCategories(allProducts);
    displayProducts(allProducts);

  } catch (error) {
    console.error(error);
    productList.innerHTML = `<p class="empty">Cannot connect to server.</p>`;
  }
}

function loadCategories(products) {
  const categoryFilter = document.getElementById("categoryFilter");
  categoryFilter.innerHTML = `<option value="">All Categories</option>`;

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  categories.forEach(category => {
    categoryFilter.innerHTML += `<option value="${category}">${category}</option>`;
  });
}

function displayProducts(products) {
  const productList = document.getElementById("productList");

  if (!products.length) {
    productList.innerHTML = `<p class="empty">No products found.</p>`;
    return;
  }

  productList.innerHTML = "";

  products.forEach(product => {
    const price = Number(product.price || 0);
    const sale = Number(product.sale_percent || 0);
    const finalPrice = sale > 0 ? price - (price * sale / 100) : price;

    productList.innerHTML += `
      <div class="product-card">
        <img src="${product.product_image || "https://via.placeholder.com/400x300?text=JCN+Product"}" alt="${product.title || "Product"}">

        <div class="product-info">
          <h3>${product.title || "Untitled Product"}</h3>
          <p>${product.description || "No description"}</p>

          <div class="price-row">
            <span class="price">₱${finalPrice.toFixed(2)}</span>
            ${sale > 0 ? `<span class="sale-badge">${sale}% OFF</span>` : ""}
          </div>

          <div class="product-actions">
            <button class="add-cart-btn" onclick='addToCartDirect(${JSON.stringify(product)})'>
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

function filterProducts() {
  const keyword = document.getElementById("searchInput").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;

  const filtered = allProducts.filter(product => {
    const matchSearch =
      (product.title || "").toLowerCase().includes(keyword) ||
      (product.description || "").toLowerCase().includes(keyword) ||
      (product.category || "").toLowerCase().includes(keyword);

    const matchCategory =
      category === "" || product.category === category;

    return matchSearch && matchCategory;
  });

  displayProducts(filtered);
}

function addToCartDirect(product) {
  const price = Number(product.price || 0);
  const sale = Number(product.sale_percent || 0);
  const finalPrice = sale > 0 ? price - (price * sale / 100) : price;

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

function buyNow(product) {
  const price = Number(product.price || 0);
  const sale = Number(product.sale_percent || 0);
  const finalPrice = sale > 0 ? price - (price * sale / 100) : price;

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
  window.location.href = "customer-checkout.html";
}

function updateCartCount() {
  cart = JSON.parse(localStorage.getItem("customerCart")) || [];

  const total = cart.reduce((sum, item) => {
    return sum + Number(item.quantity || 0);
  }, 0);

  document.getElementById("cartCount").textContent = total;
}

function logoutCustomer() {
  if (!confirm("Are you sure you want to logout?")) return;

  localStorage.removeItem("customerToken");
  localStorage.removeItem("customerUser");
  localStorage.removeItem("customerCart");

  window.location.href = "user-login.html";
}