const API_URL = "http://localhost:5000";

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("customerCart")) || [];
let selectedBuyProduct = null;

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  loadProducts();
  updateCartCount();

  document.getElementById("searchInput")?.addEventListener("input", filterProducts);
  document.getElementById("categoryFilter")?.addEventListener("change", filterProducts);

  document.getElementById("buyModalSize")?.addEventListener("change", updateBuyStockLimit);
});

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    alert("Please login first.");
    window.location.href = "user-login.html";
  }
}

function parseArray(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  return [];
}

function getAvailableSizes(product) {
  return parseArray(product.sizes).filter(size => {
    return Number(size.qty || 0) > 0;
  });
}

function getAvailableColors(product) {
  return parseArray(product.colors);
}

function isSaleActive(product) {
  const salePercent = Number(product.sale_percent || 0);

  if (salePercent <= 0 || !product.sale_end) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const saleEnd = new Date(product.sale_end);
  saleEnd.setHours(23, 59, 59, 999);

  return saleEnd >= today;
}

function getFinalPrice(product) {
  const price = Number(product.price || 0);
  const salePercent = Number(product.sale_percent || 0);

  if (!isSaleActive(product)) {
    return price;
  }

  return price - (price * salePercent / 100);
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
  if (!categoryFilter) return;

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
    const salePercent = Number(product.sale_percent || 0);
    const saleActive = isSaleActive(product);
    const finalPrice = getFinalPrice(product);

    const availableSizes = getAvailableSizes(product);
    const availableColors = getAvailableColors(product);
    const outOfStock = availableSizes.length === 0 || availableColors.length === 0;

    productList.innerHTML += `
      <div class="product-card">
        <img
          src="${product.product_image || "https://via.placeholder.com/400x300?text=JCN+Product"}"
          alt="${product.title || "Product"}"
        >

        <div class="product-info">
          <h3>${product.title || "Untitled Product"}</h3>
          <p>${product.description || "No description"}</p>

          <div class="price-row">
            ${
              saleActive
                ? `
                  <div>
                    <span class="old-price">₱${price.toFixed(2)}</span>
                    <span class="price">₱${finalPrice.toFixed(2)}</span>
                  </div>
                  <span class="sale-badge">${salePercent}% OFF</span>
                `
                : `<span class="price">₱${price.toFixed(2)}</span>`
            }
          </div>

          ${
            outOfStock
              ? `<p class="stock-status out">Out of Stock</p>`
              : `<p class="stock-status in">Available</p>`
          }

          <div class="product-actions">
            <button 
              class="add-cart-btn" 
              onclick='openBuyModalById("${product.id}", "cart")'
              ${outOfStock ? "disabled" : ""}
            >
              Add Cart
            </button>

            <button 
              class="buy-btn" 
              onclick='openBuyModalById("${product.id}", "buy")'
              ${outOfStock ? "disabled" : ""}
            >
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

function openBuyModalById(productId, mode = "buy") {
  const product = allProducts.find(p => String(p.id) === String(productId));

  if (!product) {
    showToast("Product not found.");
    return;
  }

  openBuyModal(product, mode);
}

function openBuyModal(product, mode = "buy") {
  selectedBuyProduct = {
    ...product,
    mode
  };

  const sizes = getAvailableSizes(product);
  const colors = getAvailableColors(product);
  const finalPrice = getFinalPrice(product);

  if (!sizes.length) {
    showToast("No available size for this product.");
    return;
  }

  if (!colors.length) {
    showToast("No available color for this product.");
    return;
  }

  document.getElementById("buyModalImage").src =
    product.product_image || "https://via.placeholder.com/400x300?text=JCN+Product";

  document.getElementById("buyModalCategory").textContent =
    product.category || "Product";

  document.getElementById("buyModalTitle").textContent =
    product.title || "Untitled Product";

  document.getElementById("buyModalDescription").textContent =
    product.description || "No description";

  document.getElementById("buyModalPrice").textContent =
    "₱" + finalPrice.toFixed(2);

  document.getElementById("buyModalSize").innerHTML = sizes.map(size => `
    <option value="${size.size}" data-stock="${Number(size.qty || 0)}">
      ${size.size} - Stock: ${Number(size.qty || 0)}
    </option>
  `).join("");

  document.getElementById("buyModalColor").innerHTML = colors.map(color => `
    <option value="${color}">
      ${color}
    </option>
  `).join("");

  document.querySelector(".buy-confirm-btn").textContent =
    mode === "cart" ? "Add to Cart" : "Continue Checkout";

  document.getElementById("buyNowModal").classList.remove("hidden");

  updateBuyStockLimit();
}

function updateBuyStockLimit() {
  const sizeSelect = document.getElementById("buyModalSize");
  const qtyInput = document.getElementById("buyModalQty");
  const stockText = document.getElementById("buyStockText");

  if (!sizeSelect || !qtyInput) return;

  const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
  const stock = Number(selectedOption?.dataset.stock || 1);

  qtyInput.max = stock;
  qtyInput.value = 1;

  if (stockText) {
    stockText.textContent = `Available stock: ${stock}`;
  }
}

function closeBuyModal() {
  document.getElementById("buyNowModal").classList.add("hidden");
  selectedBuyProduct = null;
}

function confirmBuyNow() {
  if (!selectedBuyProduct) return;

  const sizeSelect = document.getElementById("buyModalSize");
  const colorSelect = document.getElementById("buyModalColor");
  const qtyInput = document.getElementById("buyModalQty");

  const size = sizeSelect.value;
  const color = colorSelect.value;
  const quantity = Number(qtyInput.value || 1);
  const maxStock = Number(sizeSelect.options[sizeSelect.selectedIndex]?.dataset.stock || 1);

  if (quantity <= 0) {
    showToast("Quantity must be at least 1.");
    return;
  }

  if (quantity > maxStock) {
    showToast(`Only ${maxStock} stock available for size ${size}.`);
    qtyInput.value = maxStock;
    return;
  }

  const finalPrice = Number(getFinalPrice(selectedBuyProduct).toFixed(2));

  const item = {
    cartKey: `${selectedBuyProduct.id}-${size}-${color}`,
    product_id: selectedBuyProduct.id,
    title: selectedBuyProduct.title,
    image: selectedBuyProduct.product_image,
    price: finalPrice,
    original_price: Number(selectedBuyProduct.price || 0),
    sale_percent: Number(selectedBuyProduct.sale_percent || 0),
    size: size,
    color: color,
    quantity: quantity
  };

  cart = JSON.parse(localStorage.getItem("customerCart")) || [];

  if (selectedBuyProduct.mode === "cart") {
    const existing = cart.find(cartItem => cartItem.cartKey === item.cartKey);

    if (existing) {
      const newQty = Number(existing.quantity || 0) + quantity;

      if (newQty > maxStock) {
        showToast(`Only ${maxStock} stock available for size ${size}.`);
        return;
      }

      existing.quantity = newQty;
      existing.price = finalPrice;
      existing.original_price = Number(selectedBuyProduct.price || 0);
      existing.sale_percent = Number(selectedBuyProduct.sale_percent || 0);
      existing.size = size;
      existing.color = color;
    } else {
      cart.push(item);
    }

    localStorage.setItem("customerCart", JSON.stringify(cart));
    updateCartCount();
    closeBuyModal();
    showToast("Product added to cart.");
    return;
  }

  localStorage.setItem("checkoutItems", JSON.stringify([item]));
window.location.href = "customer-checkout.html";
}

function showToast(message) {
  const oldToast = document.querySelector(".jcn-toast");
  if (oldToast) oldToast.remove();

  const toast = document.createElement("div");
  toast.className = "jcn-toast";
  toast.innerHTML = `
    <i class="fa-solid fa-check"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 50);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function updateCartCount() {
  cart = JSON.parse(localStorage.getItem("customerCart")) || [];

  const total = cart.reduce((sum, item) => {
    return sum + Number(item.quantity || 0);
  }, 0);

  const cartCount = document.getElementById("cartCount");
  if (cartCount) cartCount.textContent = total;
}