
const INVENTORY_API = "/api/inventory";
const SERVER_API = "";
const STAFF_LOGIN = "../../staff/html/staff-login.html";

let currentPage = 1;
let currentOrders = [];
let selectedTrackingOrder = null;

/* =========================================
   HTML SECURITY
========================================= */

function escapeInventoryHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

/* =========================================
   NOTIFICATION
========================================= */

function inventoryNotify(message) {
  const element =
    document.getElementById("notice") ||
    document.getElementById("notification");

  if (element) {
    element.textContent = message;
  }
}

/* =========================================
   STAFF SESSION
========================================= */

function checkInventorySession() {
  try {
    const user = JSON.parse(
      localStorage.getItem("staffUser") || "null"
    );

    const token = localStorage.getItem("staffToken");

    if (
      !token ||
      !user ||
      !["inventory_staff", "admin"].includes(user.role)
    ) {
      throw new Error("Login required");
    }

    return user;
  } catch (error) {
    window.location.replace(STAFF_LOGIN);
    return null;
  }
}

/* =========================================
   API REQUEST
========================================= */

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
      "Cannot connect to the server. Check Node.js on port 5000."
    );
  }

  if (response.status === 401) {
    localStorage.removeItem("staffToken");
    localStorage.removeItem("staffUser");

    window.location.replace(STAFF_LOGIN);

    throw new Error("Session expired.");
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Invalid server response.");
  }

  if (!response.ok || data.success === false) {
    const message = data.message || data.error ||
      `Request failed (${response.status}).`;
    console.error("INVENTORY API ERROR", {
      url: `${baseUrl}${path}`,
      status: response.status,
      message,
      details: data.details || null
    });
    throw new Error(message);
  }

  return data;
}

/* =========================================
   PAGE INITIALIZATION
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  const user = checkInventorySession();

  if (!user) return;

  const staffBadge = document.querySelector(".topbar .staff");

  if (staffBadge) {
    staffBadge.textContent =
      user.full_name ||
      user.username ||
      "Inventory Staff";
  }

  setupTrackingModal();
  loadPreparationOrders();
});

/* =========================================
   LOAD PREPARATION ORDERS
========================================= */

async function loadPreparationOrders() {
  const main = document.getElementById("main");

  if (!main) return;

  main.innerHTML = `
    <section class="panel">
      <p>Loading customer orders...</p>
    </section>
  `;

  try {
    const data = await inventoryRequest(
      `/orders?page=${currentPage}`
    );

    if (!Array.isArray(data.orders)) {
      throw new Error("The inventory orders API returned an invalid orders list.");
    }

    currentOrders = data.orders;

    main.innerHTML = `
      <section class="panel">

        <div class="section-head">
          <h2>Order Preparation</h2>

          <button
            type="button"
            id="refreshOrders"
          >
            Refresh
          </button>
        </div>

        <p>
          Verify ordered items before marking
          the order as ready for shipment.
        </p>

        <div id="preparationOrders"></div>

        <div class="toolbar" style="margin-top:20px">

          <button
            type="button"
            id="previousOrders"
            class="ghost"
            ${currentPage <= 1 ? "disabled" : ""}
          >
            Previous
          </button>

          <span>
            Page ${currentPage} · ${data.total || 0} records
          </span>

          <button
            type="button"
            id="nextOrders"
            class="ghost"
            ${
              currentPage * (data.limit || 10) >=
              (data.total || 0)
                ? "disabled"
                : ""
            }
          >
            Next
          </button>

        </div>

      </section>
    `;

    renderPreparationOrders();
    setupPreparationPagination(data);

  } catch (error) {
    console.error("PREPARATION ERROR:", error);

    main.innerHTML = `
      <section class="panel">

        <h2>Unable to load data</h2>

        <p>${escapeInventoryHtml(error.message)}</p>

        <button type="button" id="retryOrders">
          Retry
        </button>

      </section>
    `;

    document
      .getElementById("retryOrders")
      ?.addEventListener("click", loadPreparationOrders);
  }
}

/* =========================================
   DISPLAY ORDERS
========================================= */

function renderPreparationOrders() {
  const container =
    document.getElementById("preparationOrders");

  if (!container) return;

  if (!currentOrders.length) {
    container.innerHTML = `
      <p class="empty">
        No orders awaiting dispatch.
      </p>
    `;

    return;
  }

  container.innerHTML = currentOrders.map((order, index) => {
    let items = Array.isArray(order.inventory_items)
      ? order.inventory_items
      : [];

    // Some existing databases store inventory_items as JSON text.
    if (typeof order.inventory_items === "string") {
      try {
        const parsed = JSON.parse(order.inventory_items);
        items = Array.isArray(parsed) ? parsed : [];
      } catch {
        items = [];
      }
    }

    const method = String(order.payment_method || "").trim().toLowerCase();
    const payment = String(order.payment_status || "").trim().toLowerCase();
    const eligible = method === "cod" ||
      (method === "paypal" && payment === "paid");

    const preparationStatus = String(
      order.inventory_preparation || "Queued"
    ).trim();
    const normalizedPreparation = preparationStatus.toLowerCase();
    const isReady = ["ready", "ready to ship", "prepared"]
      .includes(normalizedPreparation);

    const trackingNumber =
      order.tracking_number || "";

    const canPrepare =
      eligible &&
      items.length > 0 &&
      ["queued", "preparing"].includes(normalizedPreparation);

    return `
      <article class="order" data-index="${index}">

        <div class="section-head">

          <h3>
            Order ${escapeInventoryHtml(
              order.order_number || order.id
            )}
          </h3>

          <span class="badge">
            ${escapeInventoryHtml(preparationStatus)}
          </span>

        </div>

        <p>
          ${escapeInventoryHtml(order.customer_name || "Customer")}
          ·
          ${escapeInventoryHtml(order.payment_method || "N/A")}
          /
          ${escapeInventoryHtml(order.payment_status || "Pending")}
        </p>

        ${
          !eligible
            ? `
              <p class="negative">
                Payment confirmation required.
              </p>
            `
            : ""
        }

        <div class="preparation-items">

          ${
            items.length
              ? items.map((item, itemIndex) => `
                <label class="check">

                  <input
                    type="checkbox"
                    value="${itemIndex}"
                    ${
                      preparationStatus !== "Preparing" || !eligible
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
                      ${escapeInventoryHtml(item.size || "N/A")}
                      /
                      ${escapeInventoryHtml(item.color || "N/A")}
                      ·
                      ${escapeInventoryHtml(
                        item.quantity ?? item.qty ?? 1
                      )} unit(s)
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

        <footer class="preparation-actions">

          ${
            canPrepare
              ? `
                <button
                  type="button"
                  data-action="${
                    preparationStatus === "Queued"
                      ? "start"
                      : "ready"
                  }"
                  ${
                    preparationStatus === "Preparing"
                      ? "disabled"
                      : ""
                  }
                >
                  ${
                    preparationStatus === "Queued"
                      ? "Start Preparation"
                      : "Mark Ready to Ship"
                  }
                </button>
              `
              : ""
          }

          ${
            isReady && !trackingNumber
              ? `
                <button
                  type="button"
                  class="jnt-add-btn"
                  data-action="add-tracking"
                >
                  Add J&T Tracking
                </button>
              `
              : ""
          }

          ${
            trackingNumber
              ? `
                <div class="jnt-tracking-saved">

                  <p>
                    J&T Tracking:
                    <strong>
                      ${escapeInventoryHtml(trackingNumber)}
                    </strong>
                  </p>

                  ${
                    isReady && eligible
                      ? `
                        <button
                          type="button"
                          class="jnt-add-btn"
                          data-action="edit-tracking"
                        >
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
  }).join("");

  setupPreparationActions();
}

/* =========================================
   PREPARATION ACTIONS
========================================= */

function setupPreparationActions() {
  document.querySelectorAll(".order").forEach(card => {
    const index = Number(card.dataset.index);
    const order = currentOrders[index];

    if (!order) return;

    const preparationButton = card.querySelector(
      '[data-action="start"], [data-action="ready"]'
    );

    const checkboxes = [
      ...card.querySelectorAll('input[type="checkbox"]')
    ];

    if (preparationButton) {
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener("change", () => {
          preparationButton.disabled =
            checkboxes.some(item => !item.checked);
        });
      });

      preparationButton.addEventListener("click", async () => {
        const action = preparationButton.dataset.action;

        preparationButton.disabled = true;

        try {
          await inventoryRequest(
            `/orders/${encodeURIComponent(order.id)}/preparation`,
            "PATCH",
            {
              action,
              revision: order.inventory_revision,
              checked: checkboxes
                .filter(item => item.checked)
                .map(item => Number(item.value))
            }
          );

          inventoryNotify(
            action === "ready"
              ? "Order marked ready for shipment."
              : "Order preparation started."
          );

          await loadPreparationOrders();
        } catch (error) {
          inventoryNotify(error.message);
          preparationButton.disabled = false;
        }
      });
    }

    card.querySelectorAll(
      '[data-action="add-tracking"], [data-action="edit-tracking"]'
    ).forEach(button => {
      button.addEventListener("click", () => {
        openJntTrackingModal(order);
      });
    });
  });
}

/* =========================================
   PAGINATION
========================================= */

function setupPreparationPagination(data) {
  document
    .getElementById("previousOrders")
    ?.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadPreparationOrders();
      }
    });

  document
    .getElementById("nextOrders")
    ?.addEventListener("click", () => {
      if (
        currentPage * (data.limit || 10) <
        (data.total || 0)
      ) {
        currentPage++;
        loadPreparationOrders();
      }
    });

  document
    .getElementById("refreshOrders")
    ?.addEventListener("click", loadPreparationOrders);
}

/* =========================================
   INITIALIZE J&T MODAL
========================================= */

function setupTrackingModal() {
  const modal = document.getElementById("jntTrackingModal");
  const form = document.getElementById("jntTrackingForm");

  if (!modal || !form) {
    console.warn(
      "J&T tracking modal not found in order-preparation.html"
    );

    return;
  }

  document
    .getElementById("closeJntModal")
    ?.addEventListener("click", closeJntTrackingModal);

  document
    .getElementById("cancelJntTracking")
    ?.addEventListener("click", closeJntTrackingModal);

  modal
    .querySelector(".jnt-modal-overlay")
    ?.addEventListener("click", closeJntTrackingModal);

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      !modal.classList.contains("hidden")
    ) {
      closeJntTrackingModal();
    }
  });

  form.addEventListener("submit", saveJntTracking);
}

/* =========================================
   OPEN J&T TRACKING MODAL
========================================= */

function openJntTrackingModal(order) {
  const modal = document.getElementById("jntTrackingModal");

  if (!modal) {
    inventoryNotify("J&T tracking form is missing.");
    return;
  }

  selectedTrackingOrder = order;

  document.getElementById("jntOrderId").value = order.id;

  document.getElementById("jntOrderNumber").textContent =
    order.order_number || `Order ${order.id}`;

  document.getElementById("jntTrackingNumber").value =
    order.tracking_number || "";

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  document.getElementById("jntTrackingNumber").focus();
}

/* =========================================
   CLOSE J&T TRACKING MODAL
========================================= */

function closeJntTrackingModal() {
  const modal = document.getElementById("jntTrackingModal");

  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");

  selectedTrackingOrder = null;
}

/* =========================================
   SAVE J&T TRACKING
========================================= */

async function saveJntTracking(event) {
  event.preventDefault();

  if (!selectedTrackingOrder) return;

  const trackingNumber = document
    .getElementById("jntTrackingNumber")
    .value.trim();

  const saveButton = document.getElementById("saveJntTracking");

  if (!/^[A-Za-z0-9-]{6,50}$/.test(trackingNumber)) {
    inventoryNotify(
      "Enter a valid tracking number from the J&T waybill."
    );

    return;
  }

  const originalText = saveButton.textContent;

  saveButton.disabled = true;
  saveButton.textContent = "Registering Tracking...";

  try {
    /*
      IMPORTANT:
      Backend must allow inventory_staff and admin
      to register tracking numbers using this route.
    */

    await inventoryRequest(
      `/api/orders/${encodeURIComponent(selectedTrackingOrder.id)}/tracking`,
      "POST",
      {
        tracking_number: trackingNumber,
        courier: "J&T Express"
      },
      SERVER_API
    );

    inventoryNotify(
      "J&T tracking registered successfully."
    );

    closeJntTrackingModal();

    await loadPreparationOrders();

  } catch (error) {
    console.error("SAVE J&T TRACKING ERROR:", error);

    inventoryNotify(error.message);

  } finally {
    saveButton.disabled = false;
    saveButton.textContent = originalText;
  }
}
