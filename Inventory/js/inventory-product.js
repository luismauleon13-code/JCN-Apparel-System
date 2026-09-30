// ======================================================
// JCN INVENTORY - PRODUCT MANAGEMENT
// inventory-product.js
// ======================================================

const API_BASE_URL = "http://localhost:5000";
const PRODUCTS_API = `${API_BASE_URL}/api/admin/products`;


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
  {
    size: "XS",
    length: "27",
    width: "21",
    sleeve: "9"
  },
  {
    size: "S",
    length: "28",
    width: "22",
    sleeve: "9.25"
  },
  {
    size: "M",
    length: "29",
    width: "23",
    sleeve: "9.5"
  },
  {
    size: "L",
    length: "30",
    width: "24",
    sleeve: "10.25"
  },
  {
    size: "XL",
    length: "31",
    width: "25",
    sleeve: "10.5"
  },
  {
    size: "2XL",
    length: "32",
    width: "26",
    sleeve: "11"
  },
  {
    size: "3XL",
    length: "33",
    width: "27",
    sleeve: "11.5"
  }
];


// ======================================================
// GLOBAL DATA
// ======================================================

let allProducts = [];


// ======================================================
// STAFF TOKEN
// ======================================================

function getStaffToken() {
  return localStorage.getItem("staffToken");
}


// ======================================================
// AUTH HEADERS
// ======================================================

function getAuthHeaders() {
  const token = getStaffToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`
  };
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
    console.error("Invalid JSON response:", text);

    throw new Error(
      "The server returned an invalid response."
    );
  }
}


// ======================================================
// INVENTORY STAFF SESSION
// ======================================================

function checkInventorySession() {
  const token = localStorage.getItem("staffToken");
  const staffData = localStorage.getItem("staffUser");

  if (!token || !staffData) {
    window.location.replace(
      "../../staff/html/staff-login.html"
    );

    return false;
  }

  try {
    const staff = JSON.parse(staffData);

    const role = String(
      staff.role || ""
    )
      .trim()
      .toLowerCase();

    if (
      role !== "inventory_staff" &&
      role !== "admin"
    ) {
      localStorage.removeItem("staffToken");
      localStorage.removeItem("staffUser");

      Swal.fire({
        icon: "error",
        title: "Access Denied",
        text:
          "You do not have permission to access Inventory Management.",
        background: "#111111",
        color: "#ffffff",
        confirmButtonColor: "#d4af37"
      }).then(() => {
        window.location.replace(
          "../staff/staff-login.html"
        );
      });

      return false;
    }

    const staffName =
      document.getElementById(
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
    console.error(
      "Invalid staff session:",
      error
    );

    localStorage.removeItem("staffToken");
    localStorage.removeItem("staffUser");

    window.location.replace(
      "../staff/staff-login.html"
    );

    return false;
  }
}


// ======================================================
// TODAY
// ======================================================

function getTodayDate() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


// ======================================================
// PRODUCT TOTAL QUANTITY
// ======================================================

function getProductTotalQuantity(product) {
  let sizes = product?.sizes;

  if (typeof sizes === "string") {
    try {
      sizes = JSON.parse(sizes);
    } catch (error) {
      sizes = [];
    }
  }

  if (
    Array.isArray(sizes) &&
    sizes.length > 0
  ) {
    return sizes.reduce(
      (total, item) => {
        return (
          total +
          Number(item.qty || 0)
        );
      },
      0
    );
  }

  return Number(
    product?.quantity || 0
  );
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
  const sizesContainer =
    document.getElementById(
      "sizesContainer"
    );

  const colorsContainer =
    document.getElementById(
      "colorsContainer"
    );

  if (
    !sizesContainer ||
    !colorsContainer
  ) {
    console.error(
      "Size or color container not found."
    );

    return;
  }


  // ====================================================
  // SIZES
  // ====================================================

  sizesContainer.innerHTML =
    defaultSizes
      .map(item => {
        return `
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

              <span>
                ${item.size}
              </span>

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
        `;
      })
      .join("");


  // ====================================================
  // COLORS
  // ====================================================

  colorsContainer.innerHTML =
    defaultColors
      .map((color, index) => {
        return `
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

            <span>
              ${escapeHTML(color)}
            </span>

          </label>
        `;
      })
      .join("");


  // ====================================================
  // SIZE EVENTS
  // ====================================================

  document
    .querySelectorAll(".sizeCheck")
    .forEach(check => {

      check.addEventListener(
        "change",
        () => {

          const size =
            check.value;

          const qtyInput =
            document.querySelector(
              `.sizeQtyInput[data-size="${size}"]`
            );

          const box =
            check.closest(
              ".size-qty-box"
            );

          if (!qtyInput) {
            return;
          }

          if (check.checked) {
            qtyInput.disabled = false;

            if (
              Number(qtyInput.value) <= 0
            ) {
              qtyInput.value = 1;
            }

            box?.classList.add(
              "selected"
            );

            qtyInput.focus();

          } else {
            qtyInput.disabled = true;
            qtyInput.value = 0;

            box?.classList.remove(
              "selected"
            );
          }
        }
      );

    });


  // ====================================================
  // COLOR EVENTS
  // ====================================================

  document
    .querySelectorAll(".colorCheck")
    .forEach(check => {

      check.addEventListener(
        "change",
        () => {

          const label =
            check.closest(
              ".color-option-label"
            );

          if (check.checked) {
            label?.classList.add(
              "selected"
            );
          } else {
            label?.classList.remove(
              "selected"
            );
          }

        }
      );

    });
}


// ======================================================
// LOAD PRODUCTS
// ======================================================

async function loadProducts() {
  const container =
    document.getElementById(
      "productsContainer"
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="loading-products">

      <i
        class="fa-solid fa-spinner fa-spin"
      ></i>

      <p>
        Loading products...
      </p>

    </div>
  `;

  try {
    const response = await fetch(
      PRODUCTS_API,
      {
        method: "GET",

        headers: {
          ...getAuthHeaders()
        }
      }
    );

    const data =
      await readJsonResponse(
        response
      );

    if (!response.ok) {
      throw new Error(
        data.message ||
        "Failed to load products."
      );
    }

    allProducts =
      Array.isArray(data.products)
        ? data.products
        : Array.isArray(data)
          ? data
          : [];

    displayProducts(allProducts);

  } catch (error) {
    console.error(
      "LOAD PRODUCTS ERROR:",
      error
    );

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
  }
}


// ======================================================
// DISPLAY PRODUCTS
// ======================================================

function displayProducts(products) {
  const container =
    document.getElementById(
      "productsContainer"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (
    !Array.isArray(products) ||
    products.length === 0
  ) {
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


  products.forEach(product => {
    const now = new Date();

    let saleEnd = null;

    if (product.sale_end) {
      saleEnd = new Date(
        `${product.sale_end}T23:59:59`
      );
    }

    const saleExpired =
      saleEnd &&
      now > saleEnd;

    const salePercent =
      saleExpired
        ? 0
        : Number(
            product.sale_percent || 0
          );

    const price =
      Number(
        product.price || 0
      );

    const quantity =
      getProductTotalQuantity(
        product
      );

    const discountedPrice =
      salePercent > 0
        ? price -
          (
            price *
            salePercent /
            100
          )
        : price;


    const productTitle =
      escapeHTML(
        product.title ||
        "Untitled Product"
      );

    const productCategory =
      escapeHTML(
        product.category ||
        "Product"
      );

    const productDescription =
      escapeHTML(
        product.description ||
        "No description available."
      );


    // ==================================================
    // IMAGE
    // ==================================================

    let imageHTML = `
      <div class="product-image-placeholder">

        <i class="fa-solid fa-shirt"></i>

      </div>
    `;

    if (product.product_image) {
      imageHTML = `
        <img
          src="${escapeHTML(
            product.product_image
          )}"
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


    // ==================================================
    // PRICE
    // ==================================================

    let priceHTML = `
      <div class="new-price">
        ₱${price.toFixed(2)}
      </div>
    `;


    if (salePercent > 0) {
      let formattedSaleDate = "";

      if (product.sale_end) {
        formattedSaleDate =
          new Date(
            `${product.sale_end}T00:00:00`
          )
            .toLocaleDateString(
              "en-PH",
              {
                month: "short",
                day: "numeric",
                year: "numeric"
              }
            );
      }

      priceHTML = `
        <div class="sale-badge">
          ${salePercent}% OFF
        </div>

        ${
          formattedSaleDate
            ? `
              <div class="sale-date">

                <i
                  class="fa-regular fa-clock"
                ></i>

                Valid until:
                ${escapeHTML(
                  formattedSaleDate
                )}

              </div>
            `
            : ""
        }

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


    // ==================================================
    // PRODUCT CARD
    // ==================================================

    const card =
      document.createElement(
        "div"
      );

    card.className =
      "product-card";

    card.innerHTML = `
      <div class="product-img">

        ${imageHTML}

      </div>


      <div class="product-info">

        <small
          class="text-gold fw-bold"
        >
          ${productCategory}
        </small>


        <h5>
          ${productTitle}
        </h5>


        <p>
          ${productDescription}
        </p>


        <p
          class="${
            quantity <= 0
              ? "text-danger"
              : "text-success"
          }"
        >
          Stock:

          ${
            quantity <= 0
              ? "Out of Stock"
              : quantity
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
            data-id="${escapeHTML(
              product.id
            )}"
          >

            <i
              class="fa-solid fa-percent"
            ></i>

            <span>
              Add Sale
            </span>

          </button>


          <button
            class="btn-product-action btn-delete-product"
            type="button"
            data-action="delete"
            data-id="${escapeHTML(
              product.id
            )}"
          >

            <i
              class="fa-solid fa-trash"
            ></i>

            <span>
              Delete
            </span>

          </button>

        </div>

      </div>
    `;

    container.appendChild(card);
  });
}


// ======================================================
// PRODUCT ACTION BUTTONS
// ======================================================

function setupProductActions() {
  const container =
    document.getElementById(
      "productsContainer"
    );

  if (!container) {
    return;
  }

  container.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-action]"
        );

      if (!button) {
        return;
      }

      const action =
        button.dataset.action;

      const id =
        button.dataset.id;

      if (!id) {
        return;
      }

      if (action === "sale") {
        addSale(id);
        return;
      }

      if (action === "delete") {
        deleteProduct(id);
      }
    }
  );
}


// ======================================================
// FILTER PRODUCTS
// ======================================================

function filterProducts() {
  const searchInput =
    document.getElementById(
      "productSearch"
    );

  const categoryFilter =
    document.getElementById(
      "productCategoryFilter"
    );

  const searchValue =
    String(
      searchInput?.value || ""
    )
      .trim()
      .toLowerCase();

  const categoryValue =
    categoryFilter?.value ||
    "all";


  const filteredProducts =
    allProducts.filter(
      product => {

        const title =
          String(
            product.title || ""
          )
            .toLowerCase();

        const description =
          String(
            product.description || ""
          )
            .toLowerCase();

        const category =
          String(
            product.category || ""
          );

        const matchesSearch =
          title.includes(
            searchValue
          ) ||
          description.includes(
            searchValue
          );

        const matchesCategory =
          categoryValue === "all" ||
          category === categoryValue;

        return (
          matchesSearch &&
          matchesCategory
        );
      }
    );


  displayProducts(
    filteredProducts
  );
}


// ======================================================
// GET SELECTED SIZES
// ======================================================

function getSelectedSizes() {
  const checkedSizes = [
    ...document.querySelectorAll(
      ".sizeCheck:checked"
    )
  ];

  return checkedSizes.map(
    input => {

      const sizeData =
        defaultSizes.find(
          item =>
            item.size ===
            input.value
        );

      const qtyInput =
        document.querySelector(
          `.sizeQtyInput[data-size="${input.value}"]`
        );

      return {
        ...sizeData,

        qty: Number(
          qtyInput?.value || 0
        )
      };
    }
  );
}


// ======================================================
// GET SELECTED COLORS
// ======================================================

function getSelectedColors() {
  return [
    ...document.querySelectorAll(
      ".colorCheck:checked"
    )
  ].map(
    input => input.value
  );
}


// ======================================================
// SAVE PRODUCT
// ======================================================

async function saveProduct(event) {
  event.preventDefault();


  // ====================================================
  // BASIC PRODUCT INFORMATION
  // ====================================================

  const title =
    document
      .getElementById(
        "productTitle"
      )
      ?.value
      .trim();


  const price =
    document
      .getElementById(
        "productPrice"
      )
      ?.value
      .trim();


  const category =
    document
      .getElementById(
        "productCategory"
      )
      ?.value;


  const description =
    document
      .getElementById(
        "productDescription"
      )
      ?.value
      .trim();


  // ====================================================
  // VALIDATION
  // ====================================================

  if (!title) {
    await showWarning(
      "Missing Product Title",
      "Please enter the product title."
    );

    return;
  }


  if (
    !price ||
    Number(price) <= 0
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


  // ====================================================
  // SIZES
  // ====================================================

  const selectedSizes =
    getSelectedSizes();


  if (
    selectedSizes.length === 0
  ) {
    await showWarning(
      "Missing Size",
      "Please select at least one available size."
    );

    return;
  }


  const invalidQuantity =
    selectedSizes.some(
      item =>
        !Number.isInteger(
          Number(item.qty)
        ) ||
        Number(item.qty) <= 0
    );


  if (invalidQuantity) {
    await showWarning(
      "Invalid Quantity",
      "Enter a quantity greater than 0 for every selected size."
    );

    return;
  }


  // ====================================================
  // COLORS
  // ====================================================

  const selectedColors =
    getSelectedColors();


  if (
    selectedColors.length === 0
  ) {
    await showWarning(
      "Missing Color",
      "Please select at least one available color."
    );

    return;
  }


  // ====================================================
  // TOTAL STOCK
  // ====================================================

  const totalQuantity =
    selectedSizes.reduce(
      (total, item) => {
        return (
          total +
          Number(item.qty || 0)
        );
      },
      0
    );


  // ====================================================
  // IMAGE
  // ====================================================

  const imageInput =
    document.getElementById(
      "productImage"
    );

  const image =
    imageInput?.files?.[0];


  if (!image) {
    await showWarning(
      "Missing Product Image",
      "Please upload a product image."
    );

    return;
  }


  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
  ];


  if (
    !allowedTypes.includes(
      image.type
    )
  ) {
    await showWarning(
      "Invalid Image",
      "Please upload PNG, JPG, JPEG, or WEBP only."
    );

    return;
  }


  const maxImageSize =
    5 * 1024 * 1024;


  if (
    image.size > maxImageSize
  ) {
    await showWarning(
      "Image Too Large",
      "The product image must be 5MB or smaller."
    );

    return;
  }


  // ====================================================
  // FORM DATA
  // ====================================================

  const formData =
    new FormData();


  formData.append(
    "title",
    title
  );


  formData.append(
    "price",
    String(
      Number(price)
    )
  );


  formData.append(
    "category",
    category
  );


  formData.append(
    "description",
    description || ""
  );


  formData.append(
    "quantity",
    String(totalQuantity)
  );


  formData.append(
    "colors",
    JSON.stringify(
      selectedColors
    )
  );


  formData.append(
    "sizes",
    JSON.stringify(
      selectedSizes
    )
  );


  formData.append(
    "product_image",
    image
  );


  // ====================================================
  // SAVE BUTTON
  // ====================================================

  const saveButton =
    document.getElementById(
      "saveProductBtn"
    );

  const originalButtonHTML =
    saveButton?.innerHTML;


  try {
    if (saveButton) {
      saveButton.disabled = true;

      saveButton.innerHTML = `
        <i
          class="fa-solid fa-spinner fa-spin me-2"
        ></i>

        Saving...
      `;
    }


    // ==================================================
    // SEND PRODUCT TO BACKEND
    // ==================================================

    const response =
      await fetch(
        PRODUCTS_API,
        {
          method: "POST",

          headers: {
            ...getAuthHeaders()
          },

          body: formData
        }
      );


    const data =
      await readJsonResponse(
        response
      );


    if (!response.ok) {
      throw new Error(
        data.message ||
        "Failed to save product."
      );
    }


    if (
      data.success === false
    ) {
      throw new Error(
        data.message ||
        "Failed to save product."
      );
    }


    // ==================================================
    // SUCCESS
    // ==================================================

    await Swal.fire({
      icon: "success",

      title: "Product Added",

      text:
        data.message ||
        "Product added successfully.",

      background: "#111111",

      color: "#ffffff",

      confirmButtonText:
        "Continue",

      confirmButtonColor:
        "#d4af37"
    });


    // ==================================================
    // RESET FORM
    // ==================================================

    resetProductForm();


    // ==================================================
    // CLOSE MODAL
    // ==================================================

    const modalElement =
      document.getElementById(
        "addProductModal"
      );


    if (
      modalElement &&
      typeof bootstrap !==
        "undefined"
    ) {
      const modal =
        bootstrap.Modal.getInstance(
          modalElement
        ) ||
        new bootstrap.Modal(
          modalElement
        );

      modal.hide();
    }


    // ==================================================
    // REFRESH PRODUCTS
    // ==================================================

    await loadProducts();


  } catch (error) {
    console.error(
      "SAVE PRODUCT ERROR:",
      error
    );


    await Swal.fire({
      icon: "error",

      title: "Save Failed",

      text:
        error.message ||
        "Cannot save product.",

      background: "#111111",

      color: "#ffffff",

      confirmButtonText: "OK",

      confirmButtonColor:
        "#d4af37"
    });


  } finally {
    if (saveButton) {
      saveButton.disabled = false;

      saveButton.innerHTML =
        originalButtonHTML ||
        `
          <i
            class="fa-solid fa-floppy-disk me-2"
          ></i>
          Save Product
        `;
    }
  }
}


// ======================================================
// RESET PRODUCT FORM
// ======================================================

function resetProductForm() {
  const form =
    document.getElementById(
      "addProductForm"
    );


  if (form) {
    form.reset();
  }


  const imageInput =
    document.getElementById(
      "productImage"
    );


  if (imageInput) {
    imageInput.value = "";
  }


  const previewImage =
    document.getElementById(
      "previewImage"
    );


  const uploadPlaceholder =
    document.getElementById(
      "uploadPlaceholder"
    );


  if (previewImage) {
    previewImage.src = "";

    previewImage.style.display =
      "none";
  }


  if (uploadPlaceholder) {
    uploadPlaceholder.style.display =
      "flex";
  }


  renderAvailabilityOptions();
}


// ======================================================
// IMAGE PREVIEW
// ======================================================

function setupImagePreview() {
  const imageInput =
    document.getElementById(
      "productImage"
    );


  const previewImage =
    document.getElementById(
      "previewImage"
    );


  const uploadPlaceholder =
    document.getElementById(
      "uploadPlaceholder"
    );


  if (
    !imageInput ||
    !previewImage
  ) {
    console.error(
      "Image upload elements not found."
    );

    return;
  }


  imageInput.addEventListener(
    "change",
    async event => {

      const file =
        event.target.files?.[0];


      if (!file) {
        clearImagePreview();
        return;
      }


      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp"
      ];


      if (
        !allowedTypes.includes(
          file.type
        )
      ) {
        imageInput.value = "";

        clearImagePreview();


        await showWarning(
          "Invalid Image",
          "Please select a PNG, JPG, JPEG, or WEBP image."
        );

        return;
      }


      const maxImageSize =
        5 * 1024 * 1024;


      if (
        file.size >
        maxImageSize
      ) {
        imageInput.value = "";

        clearImagePreview();


        await showWarning(
          "Image Too Large",
          "Please select an image smaller than 5MB."
        );

        return;
      }


      const reader =
        new FileReader();


      reader.onload =
        loadEvent => {

          previewImage.src =
            loadEvent.target.result;

          previewImage.style.display =
            "block";


          if (uploadPlaceholder) {
            uploadPlaceholder.style.display =
              "none";
          }
        };


      reader.onerror =
        async () => {

          imageInput.value = "";

          clearImagePreview();


          await showWarning(
            "Image Error",
            "The selected image could not be read."
          );
        };


      reader.readAsDataURL(
        file
      );
    }
  );


  function clearImagePreview() {
    previewImage.src = "";

    previewImage.style.display =
      "none";


    if (uploadPlaceholder) {
      uploadPlaceholder.style.display =
        "flex";
    }
  }
}


// ======================================================
// ADD SALE
// ======================================================

async function addSale(id) {
  const sale =
    await Swal.fire({
      icon: "question",

      title:
        "Add Sale Discount",

      text:
        "Enter the discount percentage.",

      input: "number",

      inputPlaceholder:
        "Example: 10",

      inputAttributes: {
        min: "1",
        max: "100",
        step: "1"
      },

      showCancelButton: true,

      confirmButtonText:
        "Next",

      cancelButtonText:
        "Cancel",

      background:
        "#111111",

      color:
        "#ffffff",

      confirmButtonColor:
        "#d4af37"
    });


  if (
    !sale.isConfirmed ||
    !sale.value
  ) {
    return;
  }


  const salePercent =
    Number(sale.value);


  if (
    salePercent < 1 ||
    salePercent > 100
  ) {
    await showWarning(
      "Invalid Discount",
      "Discount must be between 1 and 100."
    );

    return;
  }


  const today =
    getTodayDate();


  const saleEnd =
    await Swal.fire({
      icon: "question",

      title:
        "Sale End Date",

      text:
        "Choose when the sale will end.",

      input: "date",

      inputAttributes: {
        min: today
      },

      showCancelButton: true,

      confirmButtonText:
        "Save Sale",

      cancelButtonText:
        "Cancel",

      background:
        "#111111",

      color:
        "#ffffff",

      confirmButtonColor:
        "#d4af37"
    });


  if (
    !saleEnd.isConfirmed ||
    !saleEnd.value
  ) {
    return;
  }


  if (
    saleEnd.value < today
  ) {
    await showWarning(
      "Unavailable Date",
      "Please choose today or a future date."
    );

    return;
  }


  try {
    const response =
      await fetch(
        `${PRODUCTS_API}/${id}/sale`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            ...getAuthHeaders()
          },

          body:
            JSON.stringify({
              sale_percent:
                salePercent,

              sale_end:
                saleEnd.value
            })
        }
      );


    const data =
      await readJsonResponse(
        response
      );


    if (
      !response.ok ||
      data.success === false
    ) {
      throw new Error(
        data.message ||
        "Failed to add sale."
      );
    }


    await Swal.fire({
      icon: "success",

      title: "Sale Added",

      text:
        "Sale added successfully.",

      background:
        "#111111",

      color:
        "#ffffff",

      confirmButtonColor:
        "#d4af37"
    });


    await loadProducts();


  } catch (error) {
    console.error(
      "ADD SALE ERROR:",
      error
    );


    await Swal.fire({
      icon: "error",

      title: "Sale Failed",

      text:
        error.message ||
        "Cannot update sale.",

      background:
        "#111111",

      color:
        "#ffffff",

      confirmButtonColor:
        "#d4af37"
    });
  }
}


// ======================================================
// DELETE PRODUCT
// ======================================================

async function deleteProduct(id) {
  const result =
    await Swal.fire({
      icon: "warning",

      title:
        "Delete Product?",

      text:
        "This product will be permanently deleted.",

      showCancelButton: true,

      confirmButtonText:
        "Delete Product",

      cancelButtonText:
        "Cancel",

      reverseButtons: true,

      background:
        "#111111",

      color:
        "#ffffff",

      confirmButtonColor:
        "#dc3545",

      cancelButtonColor:
        "#6c757d"
    });


  if (!result.isConfirmed) {
    return;
  }


  try {
    const response =
      await fetch(
        `${PRODUCTS_API}/${id}`,
        {
          method: "DELETE",

          headers: {
            ...getAuthHeaders()
          }
        }
      );


    const data =
      await readJsonResponse(
        response
      );


    if (
      !response.ok ||
      data.success === false
    ) {
      throw new Error(
        data.message ||
        "Failed to delete product."
      );
    }


    await Swal.fire({
      icon: "success",

      title: "Deleted",

      text:
        "Product deleted successfully.",

      background:
        "#111111",

      color:
        "#ffffff",

      confirmButtonColor:
        "#d4af37"
    });


    await loadProducts();


  } catch (error) {
    console.error(
      "DELETE PRODUCT ERROR:",
      error
    );


    await Swal.fire({
      icon: "error",

      title: "Delete Failed",

      text:
        error.message ||
        "Server error while deleting product.",

      background:
        "#111111",

      color:
        "#ffffff",

      confirmButtonColor:
        "#d4af37"
    });
  }
}


// ======================================================
// SEARCH + FILTER
// ======================================================

function setupProductFilters() {
  const searchInput =
    document.getElementById(
      "productSearch"
    );


  const categoryFilter =
    document.getElementById(
      "productCategoryFilter"
    );


  if (searchInput) {
    searchInput.addEventListener(
      "input",
      filterProducts
    );
  }


  if (categoryFilter) {
    categoryFilter.addEventListener(
      "change",
      filterProducts
    );
  }
}


// ======================================================
// INVENTORY LOGOUT
// ======================================================

function setupInventoryLogout() {
  const logoutButton =
    document.getElementById(
      "inventoryLogoutBtn"
    );


  const logoutModal =
    document.getElementById(
      "inventoryLogoutModal"
    );


  const confirmLogout =
    document.getElementById(
      "inventoryConfirmLogout"
    );


  const cancelLogout =
    document.getElementById(
      "inventoryCancelLogout"
    );


  const backdrop =
    logoutModal?.querySelector(
      ".logout-backdrop"
    );


  if (
    logoutButton &&
    logoutModal
  ) {
    logoutButton.addEventListener(
      "click",
      () => {
        logoutModal.classList.remove(
          "hidden"
        );
      }
    );
  }


  if (
    cancelLogout &&
    logoutModal
  ) {
    cancelLogout.addEventListener(
      "click",
      () => {
        logoutModal.classList.add(
          "hidden"
        );
      }
    );
  }


  if (
    backdrop &&
    logoutModal
  ) {
    backdrop.addEventListener(
      "click",
      () => {
        logoutModal.classList.add(
          "hidden"
        );
      }
    );
  }


  if (confirmLogout) {
    confirmLogout.addEventListener(
      "click",
      () => {

        localStorage.removeItem(
          "staffToken"
        );

        localStorage.removeItem(
          "staffUser"
        );


        window.location.replace(
          "../../staff/html/staff-login.html"
        );
      }
    );
  }
}


// ======================================================
// RESET FORM WHEN MODAL CLOSES
// ======================================================

function setupModalReset() {
  const modalElement =
    document.getElementById(
      "addProductModal"
    );


  if (!modalElement) {
    return;
  }


  modalElement.addEventListener(
    "hidden.bs.modal",
    () => {
      resetProductForm();
    }
  );
}


// ======================================================
// RESET SCROLL WHEN MODAL OPENS
// ======================================================

function setupModalScroll() {
  const modalElement =
    document.getElementById(
      "addProductModal"
    );


  if (!modalElement) {
    return;
  }


  modalElement.addEventListener(
    "shown.bs.modal",
    () => {

      const modalBody =
        modalElement.querySelector(
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

function showWarning(
  title,
  message
) {
  return Swal.fire({
    icon: "warning",

    title: title,

    text: message,

    background:
      "#111111",

    color:
      "#ffffff",

    confirmButtonText:
      "OK",

    confirmButtonColor:
      "#d4af37"
  });
}


// ======================================================
// INITIALIZE INVENTORY PRODUCT PAGE
// ======================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "JCN Inventory Product JS loaded."
    );


    // ==================================================
    // CHECK LOGIN
    // ==================================================

    const authorized =
      checkInventorySession();


    if (!authorized) {
      return;
    }


    // ==================================================
    // CREATE SIZES + COLORS
    // ==================================================

    renderAvailabilityOptions();


    // ==================================================
    // PRODUCT ACTIONS
    // ==================================================

    setupProductActions();


    // ==================================================
    // SEARCH + FILTER
    // ==================================================

    setupProductFilters();


    // ==================================================
    // IMAGE UPLOAD
    // ==================================================

    setupImagePreview();


    // ==================================================
    // LOGOUT
    // ==================================================

    setupInventoryLogout();


    // ==================================================
    // MODAL
    // ==================================================

    setupModalReset();

    setupModalScroll();


    // ==================================================
    // ADD PRODUCT FORM
    // ==================================================

    const addProductForm =
      document.getElementById(
        "addProductForm"
      );


    if (addProductForm) {
      addProductForm.addEventListener(
        "submit",
        saveProduct
      );
    } else {
      console.error(
        "addProductForm not found."
      );
    }


    // ==================================================
    // LOAD PRODUCTS
    // ==================================================

    loadProducts();

  }
);