/* =========================================================
   JCN APPAREL PRINTING SERVICES
   INVENTORY - ORDER PREPARATION

   FEATURES:
   - Order status dropdown
   - Newest orders first
   - Oldest orders first
   - Search orders
   - Automatic order counters
   - Order pagination
   - Preparation checklist
   - Cashier verification
   - J&T tracking registration
   - Update tracking number
   - Inventory staff logout
========================================================= */


/* =========================================================
   01. CONFIGURATION
========================================================= */

const INVENTORY_API = "/api/inventory";
const SERVER_API = "";
const STAFF_LOGIN = "../../staff/html/staff-login.html";

const PAGE_LIMIT = 10;

let currentPage = 1;

let currentOrders = [];
let filteredOrders = [];

let selectedTrackingOrder = null;

let loadingOrders = false;
let savingTracking = false;

let currentFilter = "all";
let currentSort = "newest";
let currentSearch = "";

const processingOrders = new Set();
const preparationChecklists = new Map();

let notificationTimer = null;


/* =========================================================
   02. HTML SECURITY
========================================================= */

function escapeInventoryHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char])
  );
}


/* =========================================================
   03. NORMALIZE VALUES
========================================================= */

function normalizeInventoryValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}


/* =========================================================
   04. SYSTEM NOTIFICATION
========================================================= */

function inventoryNotify(message) {
  const element =
    document.getElementById("notice") ||
    document.getElementById("notification");

  if (!element) {
    console.log(message);
    return;
  }

  clearTimeout(notificationTimer);

  element.textContent = message;
  element.hidden = !message;

  notificationTimer = setTimeout(() => {
    element.textContent = "";
    element.hidden = true;
  }, 5000);
}


/* =========================================================
   05. STAFF SESSION VALIDATION
========================================================= */

function checkInventorySession() {
  try {
    const user = JSON.parse(
      localStorage.getItem("staffUser") || "null"
    );

    const token = localStorage.getItem("staffToken");

    const role = normalizeInventoryValue(user?.role);

    if (
      !token ||
      !user ||
      !["inventory_staff", "admin"].includes(role)
    ) {
      throw new Error("Login required.");
    }

    return user;

  } catch (error) {
    window.location.replace(STAFF_LOGIN);
    return null;
  }
}


/* =========================================================
   06. INVENTORY API REQUEST
========================================================= */

async function inventoryRequest(
  path,
  method = "GET",
  body,
  baseUrl = INVENTORY_API
) {
  let response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,

      cache: "no-store",

      headers: {
        Authorization:
          `Bearer ${localStorage.getItem("staffToken") || ""}`,

        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {})
      },

      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {})
    });

  } catch (error) {
    throw new Error(
      "Cannot connect to the server. Please check your connection."
    );
  }


  /* EXPIRED SESSION */

  if (response.status === 401) {
    localStorage.removeItem("staffToken");
    localStorage.removeItem("staffUser");

    window.location.replace(STAFF_LOGIN);

    throw new Error("Session expired.");
  }


  /* READ SERVER RESPONSE */

  let data;

  try {
    data = await response.json();

  } catch (error) {
    throw new Error("Invalid server response.");
  }


  /* HANDLE SERVER ERRORS */

  if (
    !response.ok ||
    !data ||
    data.success === false
  ) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed (${response.status}).`;

    console.error("INVENTORY API ERROR", {
      url: `${baseUrl}${path}`,
      status: response.status,
      message,
      details: data?.details || null
    });

    throw new Error(message);
  }

  return data;
}


/* =========================================================
   07. PAGE INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const user = checkInventorySession();

  if (!user) return;


  /* DISPLAY STAFF NAME */

  const staffBadge =
    document.getElementById("inventoryStaffName") ||
    document.querySelector(".topbar .staff");

  if (staffBadge) {
    staffBadge.textContent =
      user.full_name ||
      user.username ||
      "Inventory Staff";
  }


  /* INITIALIZE PAGE FUNCTIONS */

  setupOrderControls();

  setupTrackingModal();

  setupInventoryLogout();

  loadPreparationOrders();
});


/* =========================================================
   08. GET READABLE ORDER NUMBER
========================================================= */

function getInventoryOrderNumber(order) {
  return String(
    order.order_number ||
    order.id ||
    "Unknown Order"
  );
}


/* =========================================================
   09. GET SAVED INVENTORY ITEMS
========================================================= */

function getInventoryOrderItems(order) {
  let items = order.inventory_items;

  if (typeof items === "string") {
    try {
      items = JSON.parse(items);

    } catch (error) {
      console.error("INVALID INVENTORY ITEMS:", error);

      return [];
    }
  }

  if (!Array.isArray(items)) {
    return [];
  }

  const validItems = items.every(
    item =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item)
  );

  return validItems ? items : [];
}


/* =========================================================
   10. CASHIER VERIFICATION
========================================================= */

function isCashierVerified(order) {
  return Boolean(order.cashier_verified_at);
}


/* =========================================================
   11. PAYMENT ELIGIBILITY
========================================================= */

function isInventoryPaymentEligible(order) {
  const method = normalizeInventoryValue(
    order.payment_method
  );

  const payment = normalizeInventoryValue(
    order.payment_status
  );


  /* COD DOES NOT REQUIRE ADVANCE PAYMENT */

  if (method === "cod") {
    return true;
  }


  /* PAYPAL MUST BE PAID */

  if (method === "paypal") {
    return payment === "paid";
  }

  return false;
}


/* =========================================================
   12. GET PREPARATION STATUS
========================================================= */

function getInventoryPreparationStatus(order) {
  return String(
    order.inventory_preparation || "Queued"
  ).trim();
}


/* =========================================================
   13. CHECK IF INVENTORY IS READY
========================================================= */

function isInventoryReady(order) {
  const preparation = normalizeInventoryValue(
    getInventoryPreparationStatus(order)
  );

  return [
    "ready",
    "ready to ship",
    "prepared"
  ].includes(preparation);
}


/* =========================================================
   14. CHECK TRACKING NUMBER
========================================================= */

function hasInventoryTracking(order) {
  return Boolean(
    String(order.tracking_number ?? "").trim()
  );
}


/* =========================================================
   15. ORDER CATEGORY

   preparation = Queued / Preparing
   ready       = Ready without tracking number
   tracking    = With tracking number
========================================================= */

function getOrderCategory(order) {
  if (hasInventoryTracking(order)) {
    return "tracking";
  }

  if (isInventoryReady(order)) {
    return "ready";
  }

  return "preparation";
}


/* =========================================================
   16. ORDER CATEGORY LABEL
========================================================= */

function getOrderCategoryLabel(order) {
  const category = getOrderCategory(order);

  switch (category) {
    case "tracking":
      return "Tracking Registered";

    case "ready":
      return "Ready to Ship";

    default:
      return "For Preparation";
  }
}


/* =========================================================
   17. ORDER CATEGORY BADGE
========================================================= */

function getOrderCategoryBadge(order) {
  const category = getOrderCategory(order);

  switch (category) {
    case "tracking":
      return "badge tracking";

    case "ready":
      return "badge";

    default:
      return "badge warning";
  }
}


/* =========================================================
   18. ORDER CREATION TIME
========================================================= */

function getOrderTime(order) {
  const time = Date.parse(order.created_at || "");

  return Number.isFinite(time)
    ? time
    : null;
}


/* =========================================================
   19. FORMAT ORDER DATE - PHILIPPINE TIME
========================================================= */

function formatOrderDate(order) {
  const time = getOrderTime(order);

  if (time === null) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",

    hour: "numeric",
    minute: "2-digit",

    hour12: true,

    timeZone: "Asia/Manila"
  }).format(new Date(time));
}


/* =========================================================
   20. NEW ORDER INDICATOR

   Orders created within the last 24 hours
========================================================= */

function isNewInventoryOrder(order) {
  const time = getOrderTime(order);

  if (time === null) {
    return false;
  }

  const difference = Date.now() - time;

  return (
    difference >= 0 &&
    difference < 24 * 60 * 60 * 1000
  );
}


/* =========================================================
   21. ORDER PREPARATION ELIGIBILITY
========================================================= */

function getPreparationEligibility(order) {
  const orderStatus = normalizeInventoryValue(
    order.status
  );

  const preparationStatus = normalizeInventoryValue(
    getInventoryPreparationStatus(order)
  );

  const verified = isCashierVerified(order);

  const paymentEligible =
    isInventoryPaymentEligible(order);

  const items = getInventoryOrderItems(order);

  const blocked = reason => ({
    allowed: false,
    action: null,
    reason
  });


  /* CLOSED ORDERS */

  if (
    [
      "cancelled",
      "canceled",
      "completed"
    ].includes(orderStatus)
  ) {
    return blocked("This order is already closed.");
  }


  /* RELEASED ORDERS */

  if (
    order.cashier_released_at ||
    order.released_at
  ) {
    return blocked(
      "This order has already been released."
    );
  }


  /* CASHIER VERIFICATION REQUIRED */

  if (!verified) {
    return blocked(
      "Waiting for cashier verification."
    );
  }


  /* PAYMENT VALIDATION */

  if (!paymentEligible) {
    return blocked(
      "Waiting for successful payment confirmation."
    );
  }


  /* INVENTORY ITEM VALIDATION */

  if (
    !items.length ||
    items.length > 200
  ) {
    return blocked(
      "Valid saved inventory items are required."
    );
  }


  /* INVENTORY REVISION VALIDATION */

  if (
    !Number.isInteger(order.inventory_revision) ||
    order.inventory_revision < 0 ||
    order.inventory_revision >= 2147483647
  ) {
    return blocked(
      "Invalid inventory revision. Refresh this page."
    );
  }


  /* START PREPARATION */

  if (preparationStatus === "queued") {

    if (
      ![
        "pending",
        "preparing",
        "processing"
      ].includes(orderStatus)
    ) {
      return blocked(
        "This order cannot enter preparation."
      );
    }

    if (order.inventory_prepared_at) {
      return blocked(
        "This order already has a preparation record."
      );
    }

    if (order.can_start_preparation === false) {
      return blocked(
        "The server has blocked this preparation action."
      );
    }

    return {
      allowed: true,
      action: "start",
      reason:
        "Verified order is ready for preparation."
    };
  }


  /* MARK READY TO SHIP */

  if (preparationStatus === "preparing") {

    if (
      ![
        "preparing",
        "processing"
      ].includes(orderStatus)
    ) {
      return blocked(
        "The order has not properly entered preparation."
      );
    }

    if (order.inventory_prepared_at) {
      return blocked(
        "Preparation has already been completed."
      );
    }

    if (order.can_mark_ready === false) {
      return blocked(
        "This order cannot be marked ready."
      );
    }

    return {
      allowed: true,
      action: "ready",
      reason:
        "Check all ordered items before completing preparation."
    };
  }


  /* COMPLETED PREPARATION */

  if (isInventoryReady(order)) {
    return blocked(
      "Inventory preparation has been completed."
    );
  }

  return blocked(
    "Order preparation is unavailable."
  );
}


/* =========================================================
   22. J&T TRACKING ELIGIBILITY
========================================================= */

function canManageInventoryTracking(order) {
  const orderStatus = normalizeInventoryValue(
    order.status
  );

  return (
    isInventoryReady(order) &&

    isCashierVerified(order) &&

    isInventoryPaymentEligible(order) &&

    ![
      "cancelled",
      "canceled",
      "completed"
    ].includes(orderStatus) &&

    !order.cashier_released_at &&

    !order.released_at &&

    order.is_ready_for_tracking !== false
  );
}


/* =========================================================
   23. CHECK IF PAGE IS BUSY
========================================================= */

function isInventoryPageBusy() {
  return (
    loadingOrders ||
    savingTracking ||
    processingOrders.size > 0
  );
}


/* =========================================================
   24. DISABLE / ENABLE FILTER CONTROLS
========================================================= */

function updateOrderControlState() {
  const disabled = isInventoryPageBusy();

  [
    "orderSearch",
    "orderStatusFilter",
    "orderSort",
    "refreshOrders"
  ].forEach(id => {
    const element = document.getElementById(id);

    if (element) {
      element.disabled = disabled;
    }
  });


  /* DISABLE PAGINATION WHILE PROCESSING */

  if (disabled) {
    [
      "previousOrders",
      "nextOrders"
    ].forEach(id => {
      const element = document.getElementById(id);

      if (element) {
        element.disabled = true;
      }
    });

    document
      .querySelectorAll("#orderList button, #orderList input")
      .forEach(element => {
        element.disabled = true;
      });
  }
}


/* =========================================================
   25. INITIALIZE SEARCH, FILTER AND SORT
========================================================= */

function setupOrderControls() {
  const searchInput =
    document.getElementById("orderSearch");

  const statusFilter =
    document.getElementById("orderStatusFilter");

  const sortSelect =
    document.getElementById("orderSort");


  /* DEFAULT SEARCH */

  if (searchInput) {
    searchInput.value = "";

    searchInput.addEventListener("input", () => {
      currentSearch = normalizeInventoryValue(
        searchInput.value
      );

      currentPage = 1;

      applyOrderFilters();
    });
  }


  /* STATUS DROPDOWN */

  if (statusFilter) {
    statusFilter.value = "all";

    statusFilter.addEventListener("change", () => {
      currentFilter = statusFilter.value;

      currentPage = 1;

      applyOrderFilters();
    });
  }


  /* SORTING DROPDOWN */

  if (sortSelect) {
    sortSelect.value = "newest";

    sortSelect.addEventListener("change", () => {
      currentSort = sortSelect.value;

      currentPage = 1;

      applyOrderFilters();
    });
  }


  /* CREATE REFRESH BUTTON */

  const sectionHead = document.querySelector(
    "#orderResults .section-head"
  );

  let refreshButton =
    document.getElementById("refreshOrders");

  if (!refreshButton && sectionHead) {
    refreshButton = document.createElement("button");

    refreshButton.type = "button";
    refreshButton.id = "refreshOrders";

    refreshButton.innerHTML = `
      <i class="fa-solid fa-arrows-rotate"></i>
      Refresh
    `;

    sectionHead.appendChild(refreshButton);
  }


  /* REFRESH EVENT */

  refreshButton?.addEventListener("click", () => {
    if (isInventoryPageBusy()) {
      return;
    }

    currentPage = 1;

    loadPreparationOrders();
  });


  /* CREATE PAGINATION CONTAINER */

  const orderResults =
    document.getElementById("orderResults");

  if (
    orderResults &&
    !document.getElementById("orderPagination")
  ) {
    const pagination = document.createElement("div");

    pagination.id = "orderPagination";
    pagination.className = "toolbar";

    pagination.style.marginTop = "20px";
    pagination.style.marginBottom = "0";

    orderResults.appendChild(pagination);
  }
}


/* =========================================================
   26. LOAD ALL ORDER PAGES

   All orders are collected before applying search,
   category filtering and sorting.
========================================================= */

async function fetchAllInventoryOrders() {
  const orders = new Map();

  let page = 1;
  let expectedTotal = null;

  while (true) {

    const data = await inventoryRequest(
      `/orders?page=${page}`
    );


    /* VALIDATE RESPONSE */

    if (!Array.isArray(data.orders)) {
      throw new Error(
        "The inventory orders API returned an invalid orders list."
      );
    }

    const limit = Number(data.limit) || 10;

    if (data.page != null && Number(data.page) !== page) {
      throw new Error(
        "Invalid inventory pagination response."
      );
    }

    if (
      expectedTotal === null &&
      data.total != null &&
      Number.isFinite(Number(data.total))
    ) {
      expectedTotal = Math.max(0, Number(data.total));
    }


    /* COLLECT ORDERS WITHOUT DUPLICATES */

    let added = 0;

    for (const order of data.orders) {

      if (!order || !order.id) {
        throw new Error(
          "The inventory API returned an order without an ID."
        );
      }

      if (!orders.has(order.id)) {
        added++;
      }

      orders.set(order.id, order);
    }


    /* CHECK IF LAST PAGE */

    if (data.orders.length === 0) {
      break;
    }

    if (added === 0) {
      throw new Error(
        "Duplicate API pages detected. Please refresh the orders."
      );
    }

    if (
      expectedTotal !== null &&
      page * limit >= expectedTotal
    ) {
      break;
    }

    if (data.orders.length < limit) {
      break;
    }

    page++;

    if (page > 500) {
      throw new Error(
        "Too many order pages. Backend pagination must be optimized."
      );
    }
  }

  if (
    expectedTotal !== null &&
    orders.size < expectedTotal
  ) {
    throw new Error(
      "The order list changed while loading. Please refresh and try again."
    );
  }

  return Array.from(orders.values());
}


/* =========================================================
   27. LOAD PREPARATION ORDERS
========================================================= */

async function loadPreparationOrders() {
  const container =
    document.getElementById("orderList");

  const emptyState =
    document.getElementById("orderEmptyState");

  const pagination =
    document.getElementById("orderPagination");

  if (
    !container ||
    loadingOrders ||
    processingOrders.size
  ) {
    return;
  }

  loadingOrders = true;

  updateOrderControlState();

  if (emptyState) {
    emptyState.hidden = true;
  }

  if (pagination) {
    pagination.innerHTML = "";
  }

  container.innerHTML = `
    <p class="empty" role="status">
      <i class="fa-solid fa-spinner fa-spin"></i>
      Loading customer orders...
    </p>
  `;

  try {

    /* LOAD ALL ORDERS */

    currentOrders = await fetchAllInventoryOrders();


    /* REMOVE OUTDATED CHECKLISTS */

    const activeKeys = new Set(
      currentOrders.map(getChecklistKey)
    );

    for (const key of preparationChecklists.keys()) {
      if (!activeKeys.has(key)) {
        preparationChecklists.delete(key);
      }
    }


    /* UPDATE SUMMARY */

    updateOrderCounters();

    loadingOrders = false;


    /* APPLY DEFAULT OR SELECTED FILTER */

    applyOrderFilters();

  } catch (error) {

    console.error("PREPARATION ERROR:", error);

    currentOrders = [];
    filteredOrders = [];

    [
      "countAll",
      "countPreparation",
      "countReady",
      "countTracking"
    ].forEach(id => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = "—";
      }
    });

    const resultCount =
      document.getElementById("orderResultCount");

    if (resultCount) {
      resultCount.textContent = "Unable to load orders.";
    }

    container.innerHTML = `
      <div class="empty">

        <p class="negative">
          ${escapeInventoryHtml(error.message)}
        </p>

        <button
          type="button"
          id="retryOrders"
        >
          <i class="fa-solid fa-arrows-rotate"></i>
          Retry
        </button>

      </div>
    `;

    document
      .getElementById("retryOrders")
      ?.addEventListener("click", loadPreparationOrders);

  } finally {

    loadingOrders = false;

    updateOrderControlState();

    const retryButton =
      document.getElementById("retryOrders");

    if (retryButton) {
      retryButton.disabled = false;
    }
  }
}


/* =========================================================
   28. AUTOMATIC ORDER COUNTERS
========================================================= */

function updateOrderCounters() {
  const counts = {
    all: currentOrders.length,
    preparation: 0,
    ready: 0,
    tracking: 0
  };

  currentOrders.forEach(order => {
    const category = getOrderCategory(order);

    counts[category]++;
  });

  const elements = {
    countAll: counts.all,
    countPreparation: counts.preparation,
    countReady: counts.ready,
    countTracking: counts.tracking
  };

  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  });
}


/* =========================================================
   29. SEARCH ORDER
========================================================= */

function matchesOrderSearch(order) {
  if (!currentSearch) {
    return true;
  }

  const items = getInventoryOrderItems(order);

  const productNames = items
    .map(item =>
      item.title ||
      item.name ||
      item.product_name ||
      ""
    )
    .join(" ");

  const searchableText = [
    order.order_number,
    order.id,
    order.customer_name,
    order.customer_email,
    order.customer_phone,
    order.tracking_number,
    order.shipping_address,
    productNames
  ]
    .map(normalizeInventoryValue)
    .join(" ");

  return searchableText.includes(currentSearch);
}


/* =========================================================
   30. SORT ORDERS

   Newest orders always appear first by default.
========================================================= */

function sortInventoryOrders(orders) {
  return [...orders].sort((first, second) => {
    const firstTime = getOrderTime(first);
    const secondTime = getOrderTime(second);


    /* INVALID DATES ALWAYS APPEAR LAST */

    if (firstTime === null && secondTime === null) {
      return String(first.id).localeCompare(
        String(second.id)
      );
    }

    if (firstTime === null) {
      return 1;
    }

    if (secondTime === null) {
      return -1;
    }


    /* STABLE SORT FOR IDENTICAL DATES */

    if (firstTime === secondTime) {
      return String(first.id).localeCompare(
        String(second.id)
      );
    }


    /* OLDEST FIRST */

    if (currentSort === "oldest") {
      return firstTime - secondTime;
    }


    /* NEWEST FIRST */

    return secondTime - firstTime;
  });
}


/* =========================================================
   31. APPLY SEARCH, CATEGORY FILTER AND SORT
========================================================= */

function applyOrderFilters() {
  if (loadingOrders) {
    return;
  }

  filteredOrders = currentOrders.filter(order => {

    const category = getOrderCategory(order);

    const categoryMatches =
      currentFilter === "all" ||
      category === currentFilter;

    return (
      categoryMatches &&
      matchesOrderSearch(order)
    );
  });


  /* SORT MATCHING ORDERS */

  filteredOrders = sortInventoryOrders(
    filteredOrders
  );


  /* VALIDATE CURRENT PAGE */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / PAGE_LIMIT)
  );

  currentPage = Math.max(
    1,
    Math.min(currentPage, totalPages)
  );


  /* UPDATE MATCHING ORDER COUNT */

  updateOrderResultCount();


  /* DISPLAY FILTERED ORDERS */

  renderPreparationOrders();


  /* DISPLAY PAGINATION */

  renderOrderPagination();
}


/* =========================================================
   32. UPDATE ORDER RESULT COUNT
========================================================= */

function updateOrderResultCount() {
  const element =
    document.getElementById("orderResultCount");

  if (!element) return;

  const total = filteredOrders.length;

  if (!total) {
    element.textContent =
      "Showing 0 orders";

    return;
  }

  const start =
    (currentPage - 1) * PAGE_LIMIT + 1;

  const end = Math.min(
    currentPage * PAGE_LIMIT,
    total
  );

  element.textContent =
    `Showing ${start}–${end} of ${total} order(s)`;
}


/* =========================================================
   33. CHECKLIST MEMORY

   Preserve checked items when changing:
   - Search
   - Filters
   - Sorting
   - Pagination

   Reset checklist when inventory revision changes.
========================================================= */

function getChecklistKey(order) {
  return `${order.id}:${order.inventory_revision}`;
}


function getSavedChecklist(order) {
  const key = getChecklistKey(order);

  return preparationChecklists.get(key) || new Set();
}


function savePreparationChecklist(order, checkboxes) {
  const key = getChecklistKey(order);

  const checkedItems = checkboxes
    .filter(item => item.checked)
    .map(item => Number(item.value));

  preparationChecklists.set(
    key,
    new Set(checkedItems)
  );
}


/* =========================================================
   34. RENDER PREPARATION ORDERS
========================================================= */

function renderPreparationOrders() {
  const container =
    document.getElementById("orderList");

  const emptyState =
    document.getElementById("orderEmptyState");

  if (!container) return;


  /* EMPTY ORDER LIST */

  if (!filteredOrders.length) {
    container.innerHTML = "";

    if (emptyState) {
      emptyState.hidden = false;

      emptyState.textContent =
        "No orders match your selected filters.";
    }

    return;
  }

  if (emptyState) {
    emptyState.hidden = true;
  }


  /* GET ORDERS FOR CURRENT PAGE */

  const start = (currentPage - 1) * PAGE_LIMIT;

  const visibleOrders = filteredOrders.slice(
    start,
    start + PAGE_LIMIT
  );


  /* RENDER ORDER CARDS */

  container.innerHTML = visibleOrders
    .map(order => renderInventoryOrderCard(order))
    .join("");


  /* INITIALIZE ORDER ACTIONS */

  setupPreparationActions();

  if (isInventoryPageBusy()) {
    updateOrderControlState();
  }
}


/* =========================================================
   35. ORDER CARD TEMPLATE
========================================================= */

function renderInventoryOrderCard(order) {
  const items = getInventoryOrderItems(order);

  const verified = isCashierVerified(order);

  const paymentEligible =
    isInventoryPaymentEligible(order);

  const eligibility =
    getPreparationEligibility(order);

  const preparationStatus =
    getInventoryPreparationStatus(order);

  const normalizedPreparation =
    normalizeInventoryValue(preparationStatus);

  const isQueued =
    normalizedPreparation === "queued";

  const isPreparing =
    normalizedPreparation === "preparing";

  const isReady = isInventoryReady(order);

  const canPrepare = eligibility.allowed;

  const canTrack =
    canManageInventoryTracking(order);

  const trackingNumber = String(
    order.tracking_number ?? ""
  ).trim();

  const shippingAddress = String(
    order.shipping_address ?? ""
  ).trim();

  const orderStatus =
    order.status || "Pending";

  const isBusy =
    processingOrders.has(order.id);

  const checkedItems =
    getSavedChecklist(order);

  const categoryLabel =
    getOrderCategoryLabel(order);

  const badgeClass =
    getOrderCategoryBadge(order);


  return `

    <article
      class="order"
      data-order-id="${escapeInventoryHtml(order.id)}"
    >

      <!-- ORDER HEADER -->

      <div class="section-head">

        <div>

          <h3>

            Order ${escapeInventoryHtml(
              getInventoryOrderNumber(order)
            )}

            ${
              isNewInventoryOrder(order)

                ? `
                    <span class="new-order-badge">
                      NEW
                    </span>
                  `

                : ""
            }

          </h3>

          <p class="order-date">

            <i class="fa-regular fa-clock"></i>

            ${escapeInventoryHtml(
              formatOrderDate(order)
            )}

          </p>

        </div>

        <span class="${badgeClass}">

          ${escapeInventoryHtml(categoryLabel)}

        </span>

      </div>


      <!-- CUSTOMER AND PAYMENT -->

      <p>

        ${escapeInventoryHtml(
          order.customer_name || "Customer"
        )}

        ·

        ${escapeInventoryHtml(
          order.payment_method || "N/A"
        )}

        /

        ${escapeInventoryHtml(
          order.payment_status || "Pending"
        )}

      </p>


      <!-- ORDER STATUS -->

      <p>

        <strong>Order Status:</strong>

        ${escapeInventoryHtml(orderStatus)}

      </p>


      <!-- PREPARATION STATUS -->

      <p>

        <strong>Preparation Status:</strong>

        ${escapeInventoryHtml(preparationStatus)}

      </p>


      <!-- CUSTOMER PHONE -->

      <p>

        <strong>Contact Number:</strong>

        ${escapeInventoryHtml(
          order.customer_phone || "Not available"
        )}

      </p>


      <!-- SHIPPING ADDRESS -->

      <p style="overflow-wrap:anywhere">

        <strong>Shipping Address:</strong>

        ${escapeInventoryHtml(
          shippingAddress ||
          "No shipping address saved"
        )}

      </p>


      <!-- MISSING ADDRESS WARNING -->

      ${
        !shippingAddress

          ? `
              <p class="negative">

                <i class="fa-solid fa-triangle-exclamation"></i>

                Please verify the customer's shipping address.

              </p>
            `

          : ""
      }


      <!-- CASHIER VERIFICATION -->

      <p>

        <strong>Cashier Verification:</strong>

        ${
          verified

            ? `
                <span class="positive">
                  Verified
                </span>
              `

            : `
                <span class="negative">
                  Not Verified
                </span>
              `
        }

      </p>


      <!-- PAYMENT WARNING -->

      ${
        !paymentEligible

          ? `
              <p class="negative">
                Payment confirmation required.
              </p>
            `

          : ""
      }


      <!-- QUEUED ORDER MESSAGE -->

      ${
        isQueued && canPrepare

          ? `
              <p class="positive">

                Verified by cashier.
                Ready to start preparation.

              </p>
            `

          : ""
      }


      <!-- PREPARATION IN PROGRESS -->

      ${
        isPreparing && canPrepare

          ? `
              <p>

                Check all ordered items before
                completing preparation.

              </p>
            `

          : ""
      }


      <!-- READY ORDER MESSAGE -->

      ${
        isReady

          ? `
              <p class="positive">

                <i class="fa-solid fa-circle-check"></i>

                Inventory preparation completed.

              </p>
            `

          : ""
      }


      <!-- READY TO REGISTER TRACKING -->

      ${
        isReady && !trackingNumber && canTrack

          ? `
              <p>

                This order is ready for shipment.
                Add the official J&T tracking number.

              </p>
            `

          : ""
      }


      <!-- BLOCKED ACTION MESSAGE -->

      ${
        !canPrepare && !isReady

          ? `
              <p class="negative">

                ${escapeInventoryHtml(
                  eligibility.reason
                )}

              </p>
            `

          : ""
      }


      <!-- ORDERED ITEMS -->

      <div class="preparation-items">

        ${
          items.length

            ? items.map((item, itemIndex) => `

                <label class="check">

                  <input
                    type="checkbox"
                    value="${itemIndex}"

                    ${
                      isReady ||
                      checkedItems.has(itemIndex)

                        ? "checked"

                        : ""
                    }

                    ${
                      !isPreparing ||
                      !canPrepare ||
                      isBusy

                        ? "disabled"

                        : ""
                    }
                  >

                  <span>

                    ${escapeInventoryHtml(
                      item.title ||
                      item.name ||
                      item.product_name ||
                      `Product ${item.product_id || item.id || ""}`
                    )}

                    <small style="display:block">

                      ${escapeInventoryHtml(
                        item.size || "N/A"
                      )}

                      /

                      ${escapeInventoryHtml(
                        item.color || "N/A"
                      )}

                      ·

                      ${escapeInventoryHtml(
                        item.quantity ??
                        item.qty ??
                        1
                      )}

                      unit(s)

                    </small>

                  </span>

                </label>

              `).join("")

            : `
                <p class="negative">

                  No saved item details.

                  Preparation is blocked until
                  verified items are recovered.

                </p>
              `
        }

      </div>


      <!-- ORDER ACTIONS -->

      <footer class="preparation-actions">


        <!-- START / MARK READY -->

        ${
          canPrepare

            ? `
                <button
                  type="button"
                  data-action="${eligibility.action}"

                  ${
                    eligibility.action === "ready" ||
                    isBusy

                      ? "disabled"

                      : ""
                  }
                >

                  ${
                    eligibility.action === "start"

                      ? `
                          <i class="fa-solid fa-box-open"></i>

                          Start Preparation
                        `

                      : `
                          <i class="fa-solid fa-circle-check"></i>

                          Mark Ready to Ship
                        `
                  }

                </button>
              `

            : ""
        }


        <!-- ADD J&T TRACKING -->

        ${
          canTrack && !trackingNumber

            ? `
                <button
                  type="button"
                  class="jnt-add-btn"
                  data-action="add-tracking"
                >

                  <i class="fa-solid fa-truck-fast"></i>

                  Add J&T Tracking

                </button>
              `

            : ""
        }


        <!-- SAVED J&T TRACKING -->

        ${
          trackingNumber

            ? `
                <div class="jnt-tracking-saved">

                  <p>

                    <i class="fa-solid fa-truck"></i>

                    J&T Tracking:

                    <strong>

                      ${escapeInventoryHtml(
                        trackingNumber
                      )}

                    </strong>

                  </p>

                  ${
                    canTrack

                      ? `
                          <button
                            type="button"
                            class="jnt-add-btn"
                            data-action="edit-tracking"
                          >

                            <i class="fa-solid fa-pen"></i>

                            Update Tracking

                          </button>
                        `

                      : ""
                  }

                </div>
              `

            : ""
        }

      </footer>

    </article>

  `;
}


/* =========================================================
   36. INITIALIZE PREPARATION ACTIONS
========================================================= */

function setupPreparationActions() {
  document
    .querySelectorAll("#orderList .order")
    .forEach(card => {

      const orderId = card.dataset.orderId;

      const order = currentOrders.find(
        item => String(item.id) === orderId
      );

      if (!order) return;


      /* GET PREPARATION BUTTON */

      const preparationButton = card.querySelector(
        '[data-action="start"], [data-action="ready"]'
      );


      /* GET ITEM CHECKLIST */

      const checkboxes = [
        ...card.querySelectorAll(
          'input[type="checkbox"]'
        )
      ];


      /* UPDATE PREPARATION BUTTON */

      const updatePreparationButton = () => {
        if (!preparationButton) {
          return;
        }

        if (isInventoryPageBusy()) {
          preparationButton.disabled = true;
          return;
        }

        const action =
          preparationButton.dataset.action;

        if (action === "ready") {

          preparationButton.disabled =
            checkboxes.length === 0 ||
            checkboxes.some(item => !item.checked);

        } else {

          preparationButton.disabled = false;
        }
      };


      /* CHECKBOX CHANGE EVENT */

      checkboxes.forEach(checkbox => {
        checkbox.addEventListener("change", () => {

          savePreparationChecklist(
            order,
            checkboxes
          );

          updatePreparationButton();
        });
      });


      /* PREPARATION ACTION */

      preparationButton?.addEventListener(
        "click",
        async () => {

          await handlePreparationAction(
            order,
            preparationButton,
            checkboxes
          );
        }
      );


      /* INITIAL BUTTON STATE */

      updatePreparationButton();


      /* J&T TRACKING BUTTONS */

      card
        .querySelectorAll(
          '[data-action="add-tracking"], [data-action="edit-tracking"]'
        )
        .forEach(button => {

          button.addEventListener("click", () => {
            openJntTrackingModal(order);
          });

        });

    });
}


/* =========================================================
   37. HANDLE PREPARATION ACTION
========================================================= */

async function handlePreparationAction(
  order,
  preparationButton,
  checkboxes
) {
  if (isInventoryPageBusy()) {
    return;
  }


  /* VALIDATE CURRENT ELIGIBILITY */

  const eligibility =
    getPreparationEligibility(order);

  if (!eligibility.allowed) {
    inventoryNotify(eligibility.reason);
    return;
  }

  const action =
    preparationButton.dataset.action;

  if (action !== eligibility.action) {
    inventoryNotify(
      "Order status changed. Please refresh the page."
    );

    return;
  }


  /* GET CHECKED ITEMS */

  const checkedItems = checkboxes
    .filter(item => item.checked)
    .map(item => Number(item.value));


  /* VALIDATE COMPLETE CHECKLIST */

  if (
    action === "ready" &&
    (
      !checkboxes.length ||
      checkedItems.length !== checkboxes.length
    )
  ) {
    inventoryNotify(
      "Please check all ordered items before marking the order ready."
    );

    return;
  }


  /* PREVENT DUPLICATE SUBMISSIONS */

  processingOrders.add(order.id);

  updateOrderControlState();

  preparationButton.disabled = true;

  preparationButton.textContent =
    action === "start"

      ? "Starting Preparation..."

      : "Completing Preparation...";


  /* DISABLE CHECKBOXES */

  checkboxes.forEach(item => {
    item.disabled = true;
  });


  let success = false;

  try {

    /* SEND PREPARATION ACTION */

    await inventoryRequest(

      `/orders/${encodeURIComponent(order.id)}/preparation`,

      "PATCH",

      {
        action,

        revision: order.inventory_revision,

        checked:
          action === "start"
            ? []
            : checkedItems
      }
    );


    /* REMOVE OLD CHECKLIST */

    preparationChecklists.delete(
      getChecklistKey(order)
    );

    success = true;


    /* SUCCESS NOTIFICATION */

    inventoryNotify(

      action === "ready"

        ? "Order marked ready for shipment."

        : "Order preparation started successfully."
    );

  } catch (error) {

    console.error(
      "PREPARATION ACTION ERROR:",
      error
    );

    inventoryNotify(error.message);

  } finally {

    processingOrders.delete(order.id);

    updateOrderControlState();

    if (success) {

      /* RELOAD ORDERS FROM THE SERVER */

      await loadPreparationOrders();

    } else {

      /* RESTORE EXISTING ORDER CARDS */

      applyOrderFilters();
    }
  }
}


/* =========================================================
   38. ORDER PAGINATION
========================================================= */

function renderOrderPagination() {
  const pagination =
    document.getElementById("orderPagination");

  if (!pagination) return;

  const total = filteredOrders.length;

  if (!total) {
    pagination.innerHTML = "";
    return;
  }

  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_LIMIT)
  );

  const busy = isInventoryPageBusy();

  pagination.innerHTML = `

    <button
      type="button"
      id="previousOrders"
      class="ghost"

      ${
        currentPage <= 1 || busy

          ? "disabled"

          : ""
      }
    >

      <i class="fa-solid fa-chevron-left"></i>

      Previous

    </button>


    <span>

      Page ${currentPage} of ${totalPages}

      ·

      ${total} record(s)

    </span>


    <button
      type="button"
      id="nextOrders"
      class="ghost"

      ${
        currentPage >= totalPages || busy

          ? "disabled"

          : ""
      }
    >

      Next

      <i class="fa-solid fa-chevron-right"></i>

    </button>

  `;


  /* PREVIOUS PAGE */

  document
    .getElementById("previousOrders")
    ?.addEventListener("click", () => {

      if (
        currentPage <= 1 ||
        isInventoryPageBusy()
      ) {
        return;
      }

      currentPage--;

      applyOrderFilters();
    });


  /* NEXT PAGE */

  document
    .getElementById("nextOrders")
    ?.addEventListener("click", () => {

      if (
        currentPage >= totalPages ||
        isInventoryPageBusy()
      ) {
        return;
      }

      currentPage++;

      applyOrderFilters();
    });
}


/* =========================================================
   39. INITIALIZE J&T TRACKING MODAL
========================================================= */

function setupTrackingModal() {
  const modal =
    document.getElementById("jntTrackingModal");

  const form =
    document.getElementById("jntTrackingForm");

  if (!modal || !form) {
    console.warn(
      "J&T tracking modal not found."
    );

    return;
  }


  /* CLOSE BUTTON */

  document
    .getElementById("closeJntModal")
    ?.addEventListener(
      "click",
      () => closeJntTrackingModal()
    );


  /* CANCEL BUTTON */

  document
    .getElementById("cancelJntTracking")
    ?.addEventListener(
      "click",
      () => closeJntTrackingModal()
    );


  /* CLICK OUTSIDE MODAL */

  modal
    .querySelector(".jnt-modal-overlay")
    ?.addEventListener(
      "click",
      () => closeJntTrackingModal()
    );


  /* ESCAPE KEY */

  document.addEventListener("keydown", event => {

    if (
      event.key === "Escape" &&
      !modal.classList.contains("hidden")
    ) {
      closeJntTrackingModal();
    }
  });


  /* SAVE TRACKING NUMBER */

  form.addEventListener(
    "submit",
    saveJntTracking
  );
}


/* =========================================================
   40. OPEN J&T TRACKING MODAL
========================================================= */

function openJntTrackingModal(order) {
  if (isInventoryPageBusy()) {
    return;
  }

  const modal =
    document.getElementById("jntTrackingModal");

  const orderIdInput =
    document.getElementById("jntOrderId");

  const orderNumberElement =
    document.getElementById("jntOrderNumber");

  const trackingInput =
    document.getElementById("jntTrackingNumber");

  const saveButton =
    document.getElementById("saveJntTracking");


  /* VALIDATE MODAL ELEMENTS */

  if (
    !modal ||
    !orderIdInput ||
    !orderNumberElement ||
    !trackingInput
  ) {
    inventoryNotify(
      "J&T tracking form is missing."
    );

    return;
  }


  /* VALIDATE TRACKING ELIGIBILITY */

  if (!canManageInventoryTracking(order)) {
    inventoryNotify(
      "Complete inventory preparation before registering tracking."
    );

    return;
  }


  /* SELECT ORDER */

  selectedTrackingOrder = order;


  /* SET ORDER ID */

  orderIdInput.value = order.id;


  /* SET READABLE ORDER NUMBER */

  orderNumberElement.textContent =
    getInventoryOrderNumber(order);


  /* EXISTING TRACKING NUMBER */

  trackingInput.value =
    order.tracking_number || "";


  /* UPDATE BUTTON TEXT */

  if (saveButton) {
    saveButton.innerHTML =

      hasInventoryTracking(order)

        ? `
            <i class="fa-solid fa-floppy-disk"></i>
            Update Tracking
          `

        : `
            <i class="fa-solid fa-floppy-disk"></i>
            Save &amp; Register Tracking
          `;
  }


  /* SHOW MODAL */

  modal.classList.remove("hidden");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  trackingInput.focus();
}


/* =========================================================
   41. CLOSE J&T TRACKING MODAL
========================================================= */

function closeJntTrackingModal(force = false) {
  if (
    savingTracking &&
    force !== true
  ) {
    return;
  }

  const modal =
    document.getElementById("jntTrackingModal");

  if (!modal) return;

  modal.classList.add("hidden");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  selectedTrackingOrder = null;
}


/* =========================================================
   42. CHECK DUPLICATE TRACKING NUMBER
========================================================= */

function isDuplicateTrackingNumber(
  trackingNumber,
  orderId
) {
  const normalizedTracking =
    normalizeInventoryValue(trackingNumber);

  return currentOrders.some(order => {

    const existingTracking =
      normalizeInventoryValue(
        order.tracking_number
      );

    return (
      String(order.id) !== String(orderId) &&

      existingTracking !== "" &&

      existingTracking === normalizedTracking
    );
  });
}


/* =========================================================
   43. SAVE J&T TRACKING NUMBER
========================================================= */

async function saveJntTracking(event) {
  event.preventDefault();

  if (
    !selectedTrackingOrder ||
    isInventoryPageBusy()
  ) {
    return;
  }

  const order = selectedTrackingOrder;


  /* VALIDATE ORDER */

  if (!canManageInventoryTracking(order)) {
    inventoryNotify(
      "Tracking is unavailable for this order."
    );

    return;
  }


  /* GET TRACKING INPUT */

  const trackingInput =
    document.getElementById("jntTrackingNumber");

  const saveButton =
    document.getElementById("saveJntTracking");

  if (!trackingInput || !saveButton) {
    inventoryNotify(
      "Tracking form is incomplete."
    );

    return;
  }

  const trackingNumber =
    trackingInput.value.trim();


  /* VALIDATE TRACKING NUMBER */

  if (
    !/^[A-Za-z0-9-]{6,50}$/.test(trackingNumber)
  ) {
    inventoryNotify(
      "Enter a valid tracking number from the J&T waybill."
    );

    return;
  }


  /* PREVENT UNCHANGED TRACKING NUMBER */

  if (
    normalizeInventoryValue(trackingNumber) ===

    normalizeInventoryValue(order.tracking_number)
  ) {
    inventoryNotify(
      "This tracking number is already registered."
    );

    return;
  }


  /* PREVENT DUPLICATE TRACKING NUMBER */

  if (
    isDuplicateTrackingNumber(
      trackingNumber,
      order.id
    )
  ) {
    inventoryNotify(
      "This tracking number is already assigned to another order."
    );

    return;
  }


  /* CONFIRM TRACKING NUMBER */

  const isUpdate = hasInventoryTracking(order);

  const confirmed = window.confirm(

    `${isUpdate ? "Update" : "Register"} J&T tracking number?\n\n` +

    `Order: ${getInventoryOrderNumber(order)}\n` +

    `Tracking Number: ${trackingNumber}\n\n` +

    "Please make sure this is the correct J&T waybill number."
  );

  if (!confirmed) {
    return;
  }


  /* DISABLE DUPLICATE SUBMISSION */

  savingTracking = true;

  updateOrderControlState();

  const originalText =
    saveButton.innerHTML;

  saveButton.disabled = true;

  saveButton.textContent =
    "Registering Tracking...";

  trackingInput.disabled = true;

  let success = false;

  try {

    /* REGISTER J&T TRACKING NUMBER */

    await inventoryRequest(

      `/api/orders/${encodeURIComponent(order.id)}/tracking`,

      "POST",

      {
        tracking_number: trackingNumber,

        courier: "J&T Express"
      },

      SERVER_API
    );

    success = true;


    /* SUCCESS MESSAGE */

    inventoryNotify(

      isUpdate

        ? "J&T tracking updated successfully."

        : "J&T tracking registered successfully."
    );


    /* CLOSE MODAL */

    closeJntTrackingModal(true);

  } catch (error) {

    console.error(
      "SAVE J&T TRACKING ERROR:",
      error
    );

    inventoryNotify(error.message);

  } finally {

    savingTracking = false;

    saveButton.disabled = false;

    saveButton.innerHTML = originalText;

    trackingInput.disabled = false;

    updateOrderControlState();

    if (success) {

      /* RELOAD AND UPDATE ORDER CATEGORY */

      await loadPreparationOrders();

    } else {

      applyOrderFilters();
    }
  }
}


/* =========================================================
   44. INVENTORY STAFF LOGOUT
========================================================= */

function setupInventoryLogout() {
  const logoutBtn =
    document.getElementById("inventoryLogoutBtn");

  const logoutModal =
    document.getElementById("inventoryLogoutModal");

  const confirmLogout =
    document.getElementById("inventoryConfirmLogout");

  const cancelLogout =
    document.getElementById("inventoryCancelLogout");

  const logoutBackdrop =
    logoutModal?.querySelector(".logout-backdrop");

  if (
    !logoutBtn ||
    !logoutModal ||
    !confirmLogout ||
    !cancelLogout
  ) {
    return;
  }

  let previousOverflow = "";


  /* OPEN LOGOUT MODAL */

  function openInventoryLogout() {

    if (isInventoryPageBusy()) {
      inventoryNotify(
        "Please finish the current operation before logging out."
      );

      return;
    }

    if (
      !logoutModal.classList.contains("hidden")
    ) {
      return;
    }

    previousOverflow =
      document.body.style.overflow;

    logoutModal.classList.remove("hidden");

    logoutModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow = "hidden";

    cancelLogout.focus();
  }


  /* CLOSE LOGOUT MODAL */

  function closeInventoryLogout() {

    logoutModal.classList.add("hidden");

    logoutModal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.style.overflow =
      previousOverflow;

    logoutBtn.focus();
  }


  /* LOGOUT BUTTON */

  logoutBtn.addEventListener(
    "click",
    openInventoryLogout
  );


  /* CANCEL LOGOUT */

  cancelLogout.addEventListener(
    "click",
    closeInventoryLogout
  );


  /* CLICK OUTSIDE MODAL */

  logoutBackdrop?.addEventListener(
    "click",
    closeInventoryLogout
  );


  /* KEYBOARD CONTROLS */

  document.addEventListener("keydown", event => {

    if (
      logoutModal.classList.contains("hidden")
    ) {
      return;
    }

    if (event.key === "Escape") {

      event.preventDefault();

      closeInventoryLogout();
    }

    if (event.key === "Tab") {

      event.preventDefault();

      if (
        document.activeElement === confirmLogout
      ) {
        cancelLogout.focus();

      } else {
        confirmLogout.focus();
      }
    }
  });


  /* CONFIRM LOGOUT */

  confirmLogout.addEventListener("click", () => {

    if (isInventoryPageBusy()) {
      inventoryNotify(
        "Please finish the current operation first."
      );

      return;
    }

    confirmLogout.disabled = true;

    confirmLogout.textContent =
      "Logging out...";

    localStorage.removeItem("staffToken");

    localStorage.removeItem("staffUser");

    preparationChecklists.clear();

    window.location.replace(STAFF_LOGIN);
  });
}


/* =========================================================
   END OF ORDER PREPARATION JAVASCRIPT
========================================================= */