// ======================================================
// JCN INVENTORY - PRODUCT MANAGEMENT
// inventory-product.js
// ======================================================

const API_BASE_URL = "http://localhost:5000";
const PRODUCTS_API = `${API_BASE_URL}/api/admin/products`;
const STAFF_LOGIN_URL = "../../staff/html/staff-login.html";
const SHOP_TIMEZONE = "Asia/Manila";

const ALERT_THEME = {
  background: "#111111",
  color: "#ffffff",
  confirmButtonColor: "#d4af37"
};

// ======================================================
// DEFAULT PRODUCT COLORS
// ======================================================

const defaultColors = [
  "Black",
  "White",
  "Mustard",
  "Army Green",
  "Navy Blue",
  "Maroon",
  "Pink",
  "Rust",
  "Fatigue",
  "Taupe",
  "Blue",
  "Gray",
  "Peach",
  "Dark Green",
  "Deep Royal",
  "Mint",
  "Red",
  "Brown",
  "Rose"
];

// ======================================================
// DEFAULT PRODUCT SIZES
// ======================================================

const defaultSizes = [
  { size: "XS", length: "27", width: "21", sleeve: "9" },
  { size: "S", length: "28", width: "22", sleeve: "9.25" },
  { size: "M", length: "29", width: "23", sleeve: "9.5" },
  { size: "L", length: "30", width: "24", sleeve: "10.25" },
  { size: "XL", length: "31", width: "25", sleeve: "10.5" },
  { size: "2XL", length: "32", width: "26", sleeve: "11" },
  { size: "3XL", length: "33", width: "27", sleeve: "11.5" }
];

// ======================================================
// GLOBAL DATA
// ======================================================

let allProducts = [];
let productsLoaded = false;
let productsLoading = false;
let savingProduct = false;
let saleRefreshTimer = null;
let previousSaleState = "";

// ======================================================
// STAFF TOKEN / AUTH HEADERS
// ======================================================

function getStaffToken() {
  return localStorage.getItem("staffToken");
}

function getAuthHeaders() {
  const token = getStaffToken();

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

// ======================================================
// SAFE JSON RESPONSE
// ======================================================

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Invalid JSON response:", error);

    throw new Error(
      "The server returned an invalid response."
    );
  }
}

// ======================================================
// INVENTORY STAFF SESSION
// ======================================================

function clearStaffSession() {
  localStorage.removeItem("staffToken");
  localStorage.removeItem("staffUser");
}

function checkInventorySession() {
  const token = getStaffToken();
  const staffData = localStorage.getItem("staffUser");

  if (!token || !staffData) {
    window.location.replace(STAFF_LOGIN_URL);
    return false;
  }

  try {
    const staff = JSON.parse(staffData);

    if (!staff || typeof staff !== "object") {
      throw new Error("Invalid staff user data.");
    }

    const role = String(staff.role || "")
      .trim()
      .toLowerCase();

    if (role !== "inventory_staff" && role !== "admin") {
      clearStaffSession();

      Swal.fire({
        ...ALERT_THEME,
        icon: "error",
        title: "Access Denied",
        text:
          "You do not have permission to access Inventory Management."
      }).then(() => {
        window.location.replace(STAFF_LOGIN_URL);
      });

      return false;
    }

    const staffName = document.getElementById(
      "inventoryStaffName"
    );

    if (staffName) {
      staffName.textContent =
        staff.full_name ||
        staff.username ||
        "Inventory Staff";
    }

    return true;
  } catch (error) {
    console.error("Invalid staff session:", error);

    clearStaffSession();
    window.location.replace(STAFF_LOGIN_URL);

    return false;
  }
}

// ======================================================
// DATE HELPERS
// ======================================================

function getTodayDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const getPart = type =>
    parts.find(part => part.type === type)?.value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function isValidDateOnly(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Date only: end of the selected day in Philippine time.
// Timestamp: preserve its specified time and timezone.
// Timestamp without timezone: interpret as Philippine time.
// Missing or invalid date: no active sale.

function parseSaleEnd(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const raw = value.trim();
  let normalized;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (!isValidDateOnly(raw)) {
      return null;
    }

    normalized = `${raw}T23:59:59.999+08:00`;
  } else {
    normalized = raw.replace(" ", "T");

    const match = normalized.match(
      /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/i
    );

    if (!match || !isValidDateOnly(match[1])) {
      return null;
    }

    const [
      ,
      datePart,
      hours,
      minutes,
      seconds = "00",
      fraction = "",
      timezone
    ] = match;

    if (
      Number(hours) > 23 ||
      Number(minutes) > 59 ||
      Number(seconds) > 59
    ) {
      return null;
    }

    let zone = timezone || "+08:00";

    if (/^z$/i.test(zone)) {
      zone = "Z";
    } else {
      if (/^[+-]\d{2}$/.test(zone)) {
        zone += ":00";
      } else if (/^[+-]\d{4}$/.test(zone)) {
        zone = `${zone.slice(0, 3)}:${zone.slice(3)}`;
      }

      if (
        Number(zone.slice(1, 3)) > 23 ||
        Number(zone.slice(4, 6)) > 59
      ) {
        return null;
      }
    }

    const milliseconds = fraction
      ? `.${fraction.slice(0, 3).padEnd(3, "0")}`
      : "";

    normalized =
      `${datePart}T${hours}:${minutes}:${seconds}` +
      `${milliseconds}${zone}`;
  }

  const date = new Date(normalized);

  return Number.isFinite(date.getTime())
    ? date
    : null;
}

// ======================================================
// SALE INFORMATION
// ======================================================

function getProductSaleInfo(product, now = Date.now()) {
  const saleEnd = parseSaleEnd(product.sale_end);
  const rawPercent = Number(product.sale_percent);

  const isActive =
    saleEnd !== null &&
    saleEnd.getTime() > now &&
    Number.isFinite(rawPercent) &&
    rawPercent >= 1 &&
    rawPercent <= 100;

  return {
    isActive,
    saleEnd,
    salePercent: isActive ? rawPercent : 0
  };
}

function formatSaleEnd(date) {
  if (
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime())
  ) {
    return "";
  }

  return date.toLocaleString("en-PH", {
    timeZone: SHOP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

// ======================================================
// AUTOMATIC SALE EXPIRATION CHECK
// ======================================================

function getSaleStateSignature() {
  const now = Date.now();

  return JSON.stringify(
    allProducts.map(product => [
      product.id,
      getProductSaleInfo(product, now).isActive
    ])
  );
}

function refreshExpiredSales() {
  if (
    document.hidden ||
    productsLoading ||
    !productsLoaded
  ) {
    return;
  }

  const currentState = getSaleStateSignature();

  if (currentState === previousSaleState) {
    return;
  }

  previousSaleState = currentState;

  // Re-render with the current search/category filters.
  filterProducts();
}

function startSaleExpiryWatcher() {
  if (saleRefreshTimer !== null) {
    return;
  }

  saleRefreshTimer = window.setInterval(
    refreshExpiredSales,
    1000
  );

  document.addEventListener(
    "visibilitychange",
    refreshExpiredSales
  );

  window.addEventListener(
    "focus",
    refreshExpiredSales
  );
}

function stopSaleExpiryWatcher() {
  if (saleRefreshTimer !== null) {
    window.clearInterval(saleRefreshTimer);
    saleRefreshTimer = null;
  }

  document.removeEventListener(
    "visibilitychange",
    refreshExpiredSales
  );

  window.removeEventListener(
    "focus",
    refreshExpiredSales
  );
}

// ======================================================
// PRODUCT TOTAL QUANTITY
// ======================================================

function getProductTotalQuantity(product) {
  let sizes = product?.sizes;

  if (typeof sizes === "string") {
    try {
      sizes = JSON.parse(sizes);
    } catch {
      sizes = [];
    }
  }

  if (Array.isArray(sizes) && sizes.length > 0) {
    return sizes.reduce((total, item) => {
      const quantity = Number(item?.qty || 0);

      return total + (
        Number.isFinite(quantity)
          ? Math.max(0, quantity)
          : 0
      );
    }, 0);
  }

  const quantity = Number(product?.quantity || 0);

  return Number.isFinite(quantity)
    ? Math.max(0, quantity)
    : 0;
}

// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ======================================================
// RENDER SIZE + COLOR OPTIONS
// ======================================================

function renderAvailabilityOptions() {
  const sizesContainer = document.getElementById(
    "sizesContainer"
  );

  const colorsContainer = document.getElementById(
    "colorsContainer"
  );

  if (!sizesContainer || !colorsContainer) {
    console.error("Size or color container not found.");
    return;
  }

  sizesContainer.innerHTML = defaultSizes
    .map(item => `
      <div class="size-qty-box">
        <label
          class="size-option-label"
          for="size-${item.size}"
        >
          <input
            type="checkbox"
            id="size-${item.size}"
            class="sizeCheck"
            value="${item.size}"
          >
          <span>${item.size}</span>
        </label>

        <input
          type="number"
          class="sizeQtyInput"
          data-size="${item.size}"
          min="0"
          step="1"
          value="0"
          disabled
          placeholder="Qty"
        >
      </div>
    `)
    .join("");

  colorsContainer.innerHTML = defaultColors
    .map((color, index) => `
      <label
        class="color-option-label"
        for="color-${index}"
      >
        <input
          type="checkbox"
          id="color-${index}"
          class="colorCheck"
          value="${escapeHTML(color)}"
        >
        <span>${escapeHTML(color)}</span>
      </label>
    `)
    .join("");

  sizesContainer
    .querySelectorAll(".sizeCheck")
    .forEach(check => {
      check.addEventListener("change", () => {
        const qtyInput = sizesContainer.querySelector(
          `.sizeQtyInput[data-size="${check.value}"]`
        );

        const box = check.closest(".size-qty-box");

        if (!qtyInput) {
          return;
        }

        qtyInput.disabled = !check.checked;

        if (check.checked) {
          if (Number(qtyInput.value) <= 0) {
            qtyInput.value = 1;
          }

          box?.classList.add("selected");
          qtyInput.focus();
        } else {
          qtyInput.value = 0;
          box?.classList.remove("selected");
        }
      });
    });

  colorsContainer
    .querySelectorAll(".colorCheck")
    .forEach(check => {
      check.addEventListener("change", () => {
        check.closest(".color-option-label")
          ?.classList.toggle("selected", check.checked);
      });
    });
}

// ======================================================
// LOAD PRODUCTS
// ======================================================

async function loadProducts() {
  const container = document.getElementById(
    "productsContainer"
  );

  if (!container || productsLoading) {
    return;
  }

  productsLoading = true;
  productsLoaded = false;

  container.innerHTML = `
    <div class="loading-products">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <p>Loading products...</p>
    </div>
  `;

  try {
    const response = await fetch(PRODUCTS_API, {
      method: "GET",
      headers: getAuthHeaders(),
      cache: "no-store"
    });

    const data = await readJsonResponse(response);

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Failed to load products."
      );
    }

    allProducts = Array.isArray(data.products)
      ? data.products
      : Array.isArray(data)
        ? data
        : [];

    productsLoaded = true;
    previousSaleState = getSaleStateSignature();

    filterProducts();
  } catch (error) {
    console.error("LOAD PRODUCTS ERROR:", error);

    container.innerHTML = `
      <div class="text-center py-5">
        <i
          class="fa-solid fa-triangle-exclamation text-warning fs-1 mb-3"
        ></i>
        <p class="text-danger mb-2">
          Cannot load products.
        </p>
        <small class="text-secondary">
          ${escapeHTML(error.message)}
        </small>
      </div>
    `;
  } finally {
    productsLoading = false;
  }
}

// ======================================================
// DISPLAY PRODUCTS
// ======================================================

function displayProducts(products) {
  const container = document.getElementById(
    "productsContainer"
  );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(products) || products.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5">
        <i
          class="fa-solid fa-shirt text-secondary fs-1 mb-3"
        ></i>
        <p class="text-secondary mb-0">
          No products found.
        </p>
      </div>
    `;

    return;
  }

  const now = Date.now();
  const fragment = document.createDocumentFragment();

  products.forEach(product => {
    const {
      isActive,
      saleEnd,
      salePercent
    } = getProductSaleInfo(product, now);

    const rawPrice = Number(product.price || 0);

    const price = Number.isFinite(rawPrice)
      ? rawPrice
      : 0;

    const quantity = getProductTotalQuantity(product);

    const discountedPrice = isActive
      ? price * (1 - salePercent / 100)
      : price;

    const productTitle = escapeHTML(
      product.title || "Untitled Product"
    );

    const productCategory = escapeHTML(
      product.category || "Product"
    );

    const productDescription = escapeHTML(
      product.description || "No description available."
    );

    const productId = escapeHTML(product.id);

    let imageHTML = `
      <div class="product-image-placeholder">
        <i class="fa-solid fa-shirt"></i>
      </div>
    `;

    if (product.product_image) {
      imageHTML = `
        <img
          src="${escapeHTML(product.product_image)}"
          alt="${productTitle}"
          loading="lazy"
          style="
            width:100%;
            height:180px;
            object-fit:cover;
            border-radius:16px;
          "
        >
      `;
    }

    // Default: original price, no sale badges.
    let priceHTML = `
      <div class="new-price">
        ₱${price.toFixed(2)}
      </div>
    `;

    // Only show a discount when its expiration is valid
    // and still in the future.
    if (isActive) {
      const formattedSaleDate = formatSaleEnd(saleEnd);

      priceHTML = `
        <div class="sale-badge">
          ${salePercent}% OFF
        </div>

        <div class="sale-date">
          <i class="fa-regular fa-clock"></i>
          Valid until:
          ${escapeHTML(formattedSaleDate)}
          (PH)
        </div>

        <div class="price-wrapper">
          <span class="old-price">
            ₱${price.toFixed(2)}
          </span>

          <span class="new-price">
            ₱${discountedPrice.toFixed(2)}
          </span>
        </div>
      `;
    }

    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <div class="product-img">
        ${imageHTML}
      </div>

      <div class="product-info">
        <small class="text-gold fw-bold">
          ${productCategory}
        </small>

        <h5>${productTitle}</h5>

        <p>${productDescription}</p>

        <p class="${
          quantity <= 0 ? "text-danger" : "text-success"
        }">
          Stock: ${
            quantity <= 0 ? "Out of Stock" : quantity
          }
        </p>

        <div class="product-price">
          ${priceHTML}
        </div>

        <div class="product-actions">
          <button
            class="btn-product-action btn-sale-product"
            type="button"
            data-action="sale"
            data-id="${productId}"
          >
            <i class="fa-solid fa-percent"></i>
            <span>Add Sale</span>
          </button>

          <button
            class="btn-product-action btn-delete-product"
            type="button"
            data-action="delete"
            data-id="${productId}"
          >
            <i class="fa-solid fa-trash"></i>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

// ======================================================
// PRODUCT ACTION BUTTONS
// ======================================================

function setupProductActions() {
  const container = document.getElementById(
    "productsContainer"
  );

  if (!container) {
    return;
  }

  container.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");

    if (
      !button ||
      !container.contains(button) ||
      button.disabled
    ) {
      return;
    }

    const { action, id } = button.dataset;

    if (!id || !["sale", "delete"].includes(action)) {
      return;
    }

    button.disabled = true;

    try {
      if (action === "sale") {
        await addSale(id);
      } else {
        await deleteProduct(id);
      }
    } finally {
      button.disabled = false;
    }
  });
}

// ======================================================
// FILTER PRODUCTS
// ======================================================

function filterProducts() {
  if (!productsLoaded) {
    return;
  }

  const searchValue = String(
    document.getElementById("productSearch")?.value || ""
  )
    .trim()
    .toLowerCase();

  const categoryValue = String(
    document.getElementById("productCategoryFilter")
      ?.value || "all"
  )
    .trim()
    .toLowerCase();

  const filteredProducts = allProducts.filter(product => {
    const title = String(product.title || "").toLowerCase();

    const description = String(
      product.description || ""
    ).toLowerCase();

    const category = String(product.category || "")
      .trim()
      .toLowerCase();

    const matchesSearch =
      title.includes(searchValue) ||
      description.includes(searchValue);

    const matchesCategory =
      categoryValue === "all" ||
      category === categoryValue;

    return matchesSearch && matchesCategory;
  });

  displayProducts(filteredProducts);
}

function setupProductFilters() {
  document.getElementById("productSearch")
    ?.addEventListener("input", filterProducts);

  document.getElementById("productCategoryFilter")
    ?.addEventListener("change", filterProducts);
}

// ======================================================
// GET SELECTED SIZES / COLORS
// ======================================================

function getSelectedSizes() {
  return [
    ...document.querySelectorAll(".sizeCheck:checked")
  ].map(input => {
    const sizeData = defaultSizes.find(
      item => item.size === input.value
    );

    const qtyInput = document.querySelector(
      `.sizeQtyInput[data-size="${input.value}"]`
    );

    return {
      ...sizeData,
      qty: Number(qtyInput?.value || 0)
    };
  });
}

function getSelectedColors() {
  return [
    ...document.querySelectorAll(".colorCheck:checked")
  ].map(input => input.value);
}

// ======================================================
// IMAGE VALIDATION
// ======================================================

function getImageValidationError(file) {
  if (!file) {
    return "Please upload a product image.";
  }

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    return "Please select a PNG, JPG, JPEG, or WEBP image.";
  }

  if (file.size > 5 * 1024 * 1024) {
    return "The product image must be 5MB or smaller.";
  }

  return "";
}

// ======================================================
// SAVE PRODUCT
// ======================================================

async function saveProduct(event) {
  event.preventDefault();

  if (savingProduct) {
    return;
  }

  const title = document.getElementById(
    "productTitle"
  )?.value.trim();

  const priceValue = document.getElementById(
    "productPrice"
  )?.value.trim();

  const price = Number(priceValue);

  const category = document.getElementById(
    "productCategory"
  )?.value;

  const description = document.getElementById(
    "productDescription"
  )?.value.trim();

  if (!title) {
    await showWarning(
      "Missing Product Title",
      "Please enter the product title."
    );
    return;
  }

  if (
    !priceValue ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    await showWarning(
      "Invalid Price",
      "Please enter a valid product price."
    );
    return;
  }

  if (!category) {
    await showWarning(
      "Missing Product Type",
      "Please select the product type."
    );
    return;
  }

  const selectedSizes = getSelectedSizes();

  if (selectedSizes.length === 0) {
    await showWarning(
      "Missing Size",
      "Please select at least one available size."
    );
    return;
  }

  const invalidQuantity = selectedSizes.some(
    item => !Number.isInteger(item.qty) || item.qty <= 0
  );

  if (invalidQuantity) {
    await showWarning(
      "Invalid Quantity",
      "Enter a whole-number quantity greater than 0 for every selected size."
    );
    return;
  }

  const selectedColors = getSelectedColors();

  if (selectedColors.length === 0) {
    await showWarning(
      "Missing Color",
      "Please select at least one available color."
    );
    return;
  }

  const totalQuantity = selectedSizes.reduce(
    (total, item) => total + item.qty,
    0
  );

  const image = document.getElementById(
    "productImage"
  )?.files?.[0];

  const imageError = getImageValidationError(image);

  if (imageError) {
    await showWarning("Product Image", imageError);
    return;
  }

  const formData = new FormData();

  formData.append("title", title);
  formData.append("price", String(price));
  formData.append("category", category);
  formData.append("description", description || "");
  formData.append("quantity", String(totalQuantity));
  formData.append("colors", JSON.stringify(selectedColors));
  formData.append("sizes", JSON.stringify(selectedSizes));
  formData.append("product_image", image);

  const saveButton = document.getElementById(
    "saveProductBtn"
  );

  const originalButtonHTML = saveButton?.innerHTML;

  savingProduct = true;

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin me-2"></i>
        Saving...
      `;
    }

    const response = await fetch(PRODUCTS_API, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData
    });

    const data = await readJsonResponse(response);

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Failed to save product."
      );
    }

    await Swal.fire({
      ...ALERT_THEME,
      icon: "success",
      title: "Product Added",
      text: data.message || "Product added successfully.",
      confirmButtonText: "Continue"
    });

    resetProductForm();

    const modalElement = document.getElementById(
      "addProductModal"
    );

    if (
      modalElement &&
      typeof bootstrap !== "undefined"
    ) {
      const modal =
        bootstrap.Modal.getInstance(modalElement) ||
        new bootstrap.Modal(modalElement);

      modal.hide();
    }

    await loadProducts();
  } catch (error) {
    console.error("SAVE PRODUCT ERROR:", error);

    await Swal.fire({
      ...ALERT_THEME,
      icon: "error",
      title: "Save Failed",
      text: error.message || "Cannot save product.",
      confirmButtonText: "OK"
    });
  } finally {
    savingProduct = false;

    if (saveButton) {
      saveButton.disabled = false;
      saveButton.innerHTML =
        originalButtonHTML || "Save Product";
    }
  }
}

// ======================================================
// RESET PRODUCT FORM
// ======================================================

function resetProductForm() {
  document.getElementById("addProductForm")?.reset();

  const imageInput = document.getElementById(
    "productImage"
  );

  if (imageInput) {
    imageInput.value = "";
  }

  clearImagePreview();
  renderAvailabilityOptions();
}

// ======================================================
// IMAGE PREVIEW
// ======================================================

function clearImagePreview() {
  const previewImage = document.getElementById(
    "previewImage"
  );

  const uploadPlaceholder = document.getElementById(
    "uploadPlaceholder"
  );

  if (previewImage) {
    previewImage.removeAttribute("src");
    previewImage.style.display = "none";
  }

  if (uploadPlaceholder) {
    uploadPlaceholder.style.display = "flex";
  }
}

function setupImagePreview() {
  const imageInput = document.getElementById(
    "productImage"
  );

  const previewImage = document.getElementById(
    "previewImage"
  );

  const uploadPlaceholder = document.getElementById(
    "uploadPlaceholder"
  );

  if (!imageInput || !previewImage) {
    console.error("Image upload elements not found.");
    return;
  }

  imageInput.addEventListener("change", async event => {
    const file = event.target.files?.[0];

    if (!file) {
      clearImagePreview();
      return;
    }

    const errorMessage = getImageValidationError(file);

    if (errorMessage) {
      imageInput.value = "";
      clearImagePreview();

      await showWarning("Invalid Image", errorMessage);
      return;
    }

    const reader = new FileReader();

    reader.onload = loadEvent => {
      // Ignore an older read if the selected file changed.
      if (imageInput.files?.[0] !== file) {
        return;
      }

      previewImage.src = loadEvent.target.result;
      previewImage.style.display = "block";

      if (uploadPlaceholder) {
        uploadPlaceholder.style.display = "none";
      }
    };

    reader.onerror = async () => {
      if (imageInput.files?.[0] !== file) {
        return;
      }

      imageInput.value = "";
      clearImagePreview();

      await showWarning(
        "Image Error",
        "The selected image could not be read."
      );
    };

    reader.readAsDataURL(file);
  });
}

// ======================================================
// ADD SALE
// ======================================================

async function addSale(id) {
  const sale = await Swal.fire({
    ...ALERT_THEME,
    icon: "question",
    title: "Add Sale Discount",
    text: "Enter the discount percentage.",
    input: "number",
    inputPlaceholder: "Example: 10",
    inputAttributes: {
      min: "1",
      max: "100",
      step: "1"
    },
    showCancelButton: true,
    confirmButtonText: "Next",
    cancelButtonText: "Cancel",
    inputValidator: value => {
      const percent = Number(value);

      if (
        !value ||
        !Number.isInteger(percent) ||
        percent < 1 ||
        percent > 100
      ) {
        return "Enter a whole-number discount from 1 to 100.";
      }

      return undefined;
    }
  });

  if (!sale.isConfirmed) {
    return;
  }

  const salePercent = Number(sale.value);

  const saleEnd = await Swal.fire({
    ...ALERT_THEME,
    icon: "question",
    title: "Sale End Date",
    text: "Choose the sale's final date.",
    input: "date",
    inputAttributes: {
      min: getTodayDate()
    },
    showCancelButton: true,
    confirmButtonText: "Save Sale",
    cancelButtonText: "Cancel",
    inputValidator: value => {
      if (!isValidDateOnly(value)) {
        return "Please choose a valid sale end date.";
      }

      if (value < getTodayDate()) {
        return "Please choose today or a future date.";
      }

      return undefined;
    }
  });

  if (!saleEnd.isConfirmed) {
    return;
  }

  // Keep the existing API payload format.
  // The backend must preserve the intended end-date rule.
  if (
    !isValidDateOnly(saleEnd.value) ||
    saleEnd.value < getTodayDate()
  ) {
    await showWarning(
      "Unavailable Date",
      "Please choose today or a future date."
    );
    return;
  }

  try {
    const response = await fetch(
      `${PRODUCTS_API}/${encodeURIComponent(id)}/sale`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          sale_percent: salePercent,
          sale_end: saleEnd.value
        })
      }
    );

    const data = await readJsonResponse(response);

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Failed to add sale."
      );
    }

    await Swal.fire({
      ...ALERT_THEME,
      icon: "success",
      title: "Sale Added",
      text: "Sale added successfully."
    });

    await loadProducts();
  } catch (error) {
    console.error("ADD SALE ERROR:", error);

    await Swal.fire({
      ...ALERT_THEME,
      icon: "error",
      title: "Sale Failed",
      text: error.message || "Cannot update sale."
    });
  }
}

// ======================================================
// DELETE PRODUCT
// ======================================================

async function deleteProduct(id) {
  const result = await Swal.fire({
    ...ALERT_THEME,
    icon: "warning",
    title: "Delete Product?",
    text: "This product will be permanently deleted.",
    showCancelButton: true,
    confirmButtonText: "Delete Product",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    confirmButtonColor: "#dc3545",
    cancelButtonColor: "#6c757d"
  });

  if (!result.isConfirmed) {
    return;
  }

  try {
    const response = await fetch(
      `${PRODUCTS_API}/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders()
      }
    );

    const data = await readJsonResponse(response);

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || "Failed to delete product."
      );
    }

    await Swal.fire({
      ...ALERT_THEME,
      icon: "success",
      title: "Deleted",
      text: "Product deleted successfully."
    });

    await loadProducts();
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);

    await Swal.fire({
      ...ALERT_THEME,
      icon: "error",
      title: "Delete Failed",
      text:
        error.message ||
        "Server error while deleting product."
    });
  }
}

// ======================================================
// INVENTORY LOGOUT
// ======================================================

function setupInventoryLogout() {
  const logoutButton = document.getElementById(
    "inventoryLogoutBtn"
  );

  const logoutModal = document.getElementById(
    "inventoryLogoutModal"
  );

  const confirmLogout = document.getElementById(
    "inventoryConfirmLogout"
  );

  const cancelLogout = document.getElementById(
    "inventoryCancelLogout"
  );

  const backdrop = logoutModal?.querySelector(
    ".logout-backdrop"
  );

  logoutButton?.addEventListener("click", event => {
    event.preventDefault();
    logoutModal?.classList.remove("hidden");
  });

  cancelLogout?.addEventListener("click", event => {
    event.preventDefault();
    logoutModal?.classList.add("hidden");
  });

  backdrop?.addEventListener("click", () => {
    logoutModal?.classList.add("hidden");
  });

  confirmLogout?.addEventListener("click", event => {
    event.preventDefault();

    stopSaleExpiryWatcher();
    clearStaffSession();

    window.location.replace(STAFF_LOGIN_URL);
  });
}

// ======================================================
// RESET FORM WHEN MODAL CLOSES
// ======================================================

function setupModalReset() {
  const modalElement = document.getElementById(
    "addProductModal"
  );

  modalElement?.addEventListener(
    "hidden.bs.modal",
    resetProductForm
  );
}

// ======================================================
// RESET SCROLL WHEN MODAL OPENS
// ======================================================

function setupModalScroll() {
  const modalElement = document.getElementById(
    "addProductModal"
  );

  modalElement?.addEventListener(
    "shown.bs.modal",
    () => {
      const modalBody = modalElement.querySelector(
        ".modal-body"
      );

      if (modalBody) {
        modalBody.scrollTop = 0;
      }
    }
  );
}

// ======================================================
// SWEETALERT WARNING
// ======================================================

function showWarning(title, message) {
  return Swal.fire({
    ...ALERT_THEME,
    icon: "warning",
    title,
    text: message,
    confirmButtonText: "OK"
  });
}

// ======================================================
// INITIALIZE INVENTORY PRODUCT PAGE
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("JCN Inventory Product JS loaded.");

  if (!checkInventorySession()) {
    return;
  }

  renderAvailabilityOptions();
  setupProductActions();
  setupProductFilters();
  setupImagePreview();
  setupInventoryLogout();
  setupModalReset();
  setupModalScroll();

  const addProductForm = document.getElementById(
    "addProductForm"
  );

  if (addProductForm) {
    addProductForm.addEventListener(
      "submit",
      saveProduct
    );
  } else {
    console.error("addProductForm not found.");
  }

  loadProducts();
  startSaleExpiryWatcher();
});