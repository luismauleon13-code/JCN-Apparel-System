const PRODUCTS_API = "http://localhost:5000/api/admin/products";

const defaultColors = [
  "Black", "White", "Mustard", "Army Green", "Navy Blue",
  "Maroon", "Pink", "Rust", "Fatigue", "Taupe",
  "Blue", "Gray", "Peach", "Dark Green", "Deep Royal",
  "Mint", "Red", "Brown", "Rose"
];

const defaultSizes = [
  { size: "XS", length: "27", width: "21", sleeve: "9" },
  { size: "S", length: "28", width: "22", sleeve: "9.25" },
  { size: "M", length: "29", width: "23", sleeve: "9.5" },
  { size: "L", length: "30", width: "24", sleeve: "10.25" },
  { size: "XL", length: "31", width: "25", sleeve: "10.5" },
  { size: "2XL", length: "32", width: "26", sleeve: "11" },
  { size: "3XL", length: "33", width: "27", sleeve: "11.5" }
];

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getProductTotalQuantity(product) {
  let sizes = product.sizes;

  if (typeof sizes === "string") {
    try {
      sizes = JSON.parse(sizes);
    } catch {
      sizes = [];
    }
  }

  if (Array.isArray(sizes) && sizes.length > 0) {
    return sizes.reduce((total, item) => {
      return total + Number(item.qty || 0);
    }, 0);
  }

  return Number(product.quantity || 0);
}

function renderAvailabilityOptions() {
  const sizesContainer = document.getElementById("sizesContainer");
  const colorsContainer = document.getElementById("colorsContainer");

  if (!sizesContainer || !colorsContainer) return;

  sizesContainer.innerHTML = defaultSizes.map(item => `
    <div class="size-qty-box">
      <label>
        <input type="checkbox" class="sizeCheck" value="${item.size}">
        ${item.size}
      </label>

      <input
        type="number"
        class="sizeQtyInput"
        data-size="${item.size}"
        min="0"
        value="0"
        disabled
        placeholder="Qty"
      >
    </div>
  `).join("");

  colorsContainer.innerHTML = defaultColors.map(color => `
    <label>
      <input type="checkbox" class="colorCheck" value="${color}">
      ${color}
    </label>
  `).join("");

  document.querySelectorAll(".sizeCheck").forEach(check => {
    check.addEventListener("change", () => {
      const qtyInput = document.querySelector(
        `.sizeQtyInput[data-size="${check.value}"]`
      );

      if (!qtyInput) return;

      qtyInput.disabled = !check.checked;

      if (!check.checked) {
        qtyInput.value = 0;
      }
    });
  });
}

async function loadProducts() {
  const container = document.getElementById("productsContainer");
  if (!container) return;

  try {
    const res = await fetch(PRODUCTS_API);
    const data = await res.json();

    container.innerHTML = "";

    if (!data.products || data.products.length === 0) {
      container.innerHTML = `<p class="text-secondary">No products added yet.</p>`;
      return;
    }

    data.products.forEach(product => {
      const now = new Date();

      const saleEnd = product.sale_end
        ? new Date(product.sale_end + "T23:59:59")
        : null;

      const saleExpired = saleEnd && now > saleEnd;

      const salePercent = saleExpired
        ? 0
        : Number(product.sale_percent || 0);

      const price = Number(product.price || 0);
      const quantity = getProductTotalQuantity(product);

      const discountedPrice =
        salePercent > 0
          ? price - (price * salePercent / 100)
          : price;

      container.innerHTML += `
        <div class="product-card">
          <div class="product-img">
            ${
              product.product_image
                ? `<img src="${product.product_image}" alt="${product.title}" style="width:100%;height:180px;object-fit:cover;border-radius:16px;">`
                : `<i class="fa-solid fa-shirt"></i>`
            }
          </div>

          <div class="product-info">
            <small class="text-gold fw-bold">${product.category || "Product"}</small>
            <h5>${product.title || "Untitled Product"}</h5>
            <p>${product.description || "No description available."}</p>

            <p class="${quantity <= 0 ? "text-danger" : "text-success"}">
              Stock: ${quantity <= 0 ? "Out of Stock" : quantity}
            </p>

            <div class="product-price">
              ${
                salePercent > 0
                  ? `
                    <div class="sale-badge">${salePercent}% OFF</div>

                    <div class="sale-date">
                      🕒 Valid until:
                      ${new Date(product.sale_end).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </div>

                    <div class="price-wrapper">
                      <span class="old-price">₱${price.toFixed(2)}</span>
                      <span class="new-price">₱${discountedPrice.toFixed(2)}</span>
                    </div>
                  `
                  : `<div class="new-price">₱${price.toFixed(2)}</div>`
              }
            </div>

            <div class="product-actions">
              <button class="btn-product-action btn-sale-product" onclick="addSale('${product.id}')">
                <i class="fa-solid fa-percent"></i>
                <span>Add Sale</span>
              </button>

              <button class="btn-product-action btn-delete-product" onclick="deleteProduct('${product.id}')">
                <i class="fa-solid fa-trash"></i>
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      `;
    });

  } catch (error) {
    console.error(error);
    container.innerHTML = `<p class="text-danger">Cannot load products. Make sure backend is running.</p>`;
  }
}

async function saveProduct(e) {
  e.preventDefault();

  const selectedSizes = [...document.querySelectorAll(".sizeCheck:checked")]
    .map(input => {
      const sizeData = defaultSizes.find(item => item.size === input.value);

      const qtyInput = document.querySelector(
        `.sizeQtyInput[data-size="${input.value}"]`
      );

      return {
        ...sizeData,
        qty: Number(qtyInput?.value || 0)
      };
    });

  const selectedColors = [...document.querySelectorAll(".colorCheck:checked")]
    .map(input => input.value);

  if (selectedSizes.length === 0) {
    await Swal.fire("Missing Size", "Please select at least one size.", "warning");
    return;
  }

  if (selectedColors.length === 0) {
    await Swal.fire("Missing Color", "Please select at least one color.", "warning");
    return;
  }

  const totalQuantity = selectedSizes.reduce((sum, item) => {
    return sum + Number(item.qty || 0);
  }, 0);

  if (totalQuantity <= 0) {
    await Swal.fire("Missing Quantity", "Please enter quantity for selected size.", "warning");
    return;
  }

  const formData = new FormData();

  formData.append("title", document.getElementById("productTitle").value.trim());
  formData.append("price", document.getElementById("productPrice").value.trim());
  formData.append("category", document.getElementById("productCategory").value);
  formData.append("description", document.getElementById("productDescription").value.trim());
  formData.append("quantity", totalQuantity);
  formData.append("colors", JSON.stringify(selectedColors));
  formData.append("sizes", JSON.stringify(selectedSizes));

  const image = document.getElementById("productImage").files[0];

  if (image) {
    formData.append("product_image", image);
  }

  try {
    const res = await fetch(PRODUCTS_API, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok || data.success === false) {
      await Swal.fire("Save Failed", data.message || "Failed to save product.", "error");
      return;
    }

    await Swal.fire({
      icon: "success",
      title: "Product Added",
      text: data.message || "Product added successfully.",
      confirmButtonText: "Continue",
      customClass: {
        popup: "jcn-alert-popup",
        title: "jcn-success-title",
        confirmButton: "jcn-alert-btn"
      },
      buttonsStyling: false
    });

    document.getElementById("addProductForm").reset();

    const previewImage = document.getElementById("previewImage");
    const uploadPlaceholder = document.getElementById("uploadPlaceholder");

    if (previewImage) previewImage.src = "";
    if (uploadPlaceholder) uploadPlaceholder.style.display = "flex";

    renderAvailabilityOptions();

    const modal = bootstrap.Modal.getInstance(
      document.getElementById("addProductModal")
    );

    if (modal) modal.hide();

    loadProducts();

  } catch (error) {
    console.error(error);

    await Swal.fire({
      icon: "error",
      title: "Save Failed",
      text: "Cannot save product. Make sure backend is running.",
      confirmButtonText: "OK",
      customClass: {
        popup: "jcn-alert-popup",
        title: "jcn-error-title",
        confirmButton: "jcn-alert-btn"
      },
      buttonsStyling: false
    });
  }
}

async function addSale(id) {
  const sale = await Swal.fire({
    title: "Add Sale Discount",
    html: `<p class="sale-subtitle">Enter discount percentage for this product</p>`,
    input: "number",
    inputPlaceholder: "Example: 10",
    showCancelButton: true,
    confirmButtonText: "Next",
    cancelButtonText: "Cancel",
    buttonsStyling: false,
    inputAttributes: {
      min: 1,
      max: 100
    }
  });

  if (!sale.isConfirmed || !sale.value) return;

  const salePercent = Number(sale.value);

  if (salePercent <= 0 || salePercent > 100) {
    await Swal.fire("Invalid Discount", "Discount must be between 1 and 100.", "error");
    return;
  }

  const today = getTodayDate();

  const saleEnd = await Swal.fire({
    title: "Sale End Date",
    html: `<p class="sale-subtitle">Choose sale end date</p>`,
    input: "date",
    inputAttributes: {
      min: today
    },
    showCancelButton: true,
    confirmButtonText: "Save Sale",
    cancelButtonText: "Cancel",
    buttonsStyling: false
  });

  if (!saleEnd.isConfirmed || !saleEnd.value) return;

  if (saleEnd.value < today) {
    await Swal.fire({
      icon: "error",
      title: "Unavailable Date",
      text: "This date is already finished. Please choose today or a future date.",
      confirmButtonText: "OK",
      customClass: {
        popup: "jcn-alert-popup",
        title: "jcn-error-title",
        confirmButton: "jcn-alert-btn"
      },
      buttonsStyling: false
    });
    return;
  }

  try {
    const res = await fetch(`${PRODUCTS_API}/${id}/sale`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sale_percent: salePercent,
        sale_end: saleEnd.value
      })
    });

    const data = await res.json();

    if (!res.ok || data.success === false) {
      await Swal.fire("Failed", data.message || "Failed to add sale.", "error");
      return;
    }

    await Swal.fire("Sale Added", "Sale added successfully.", "success");

    loadProducts();

  } catch (error) {
    console.error("ADD SALE ERROR:", error);
    await Swal.fire("Server Error", "Cannot connect to server.", "error");
  }
}

async function deleteProduct(id) {
  const result = await Swal.fire({
    title: "Delete Product",
    html: `
      <div class="delete-warning-icon">
        <i class="fa-solid fa-trash-can"></i>
      </div>
      <p class="delete-warning-text">
        Are you sure you want to permanently delete this product?
      </p>
    `,
    showCancelButton: true,
    confirmButtonText: "Delete Product",
    cancelButtonText: "Cancel",
    buttonsStyling: false
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`${PRODUCTS_API}/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (!res.ok || data.success === false) {
      await Swal.fire("Delete Failed", data.message || "Failed to delete product.", "error");
      return;
    }

    await Swal.fire("Deleted", "Product deleted successfully.", "success");

    loadProducts();

  } catch (error) {
    console.error("Delete product error:", error);
    await Swal.fire("Delete Failed", "Server error while deleting product.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderAvailabilityOptions();
  loadProducts();

  const addProductForm = document.getElementById("addProductForm");

  if (addProductForm) {
    addProductForm.addEventListener("submit", saveProduct);
  }

  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  const adminLogoutModal = document.getElementById("adminLogoutModal");
  const adminConfirmLogout = document.getElementById("adminConfirmLogout");
  const adminCancelLogout = document.getElementById("adminCancelLogout");

  if (adminLogoutBtn && adminLogoutModal) {
    adminLogoutBtn.addEventListener("click", () => {
      adminLogoutModal.classList.remove("hidden");
    });
  }

  if (adminCancelLogout && adminLogoutModal) {
    adminCancelLogout.addEventListener("click", () => {
      adminLogoutModal.classList.add("hidden");
    });
  }

  if (adminConfirmLogout) {
    adminConfirmLogout.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      window.location.href = "index.html";
    });
  }
});