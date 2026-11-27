/* =========================================================
   JCN APPAREL PRINTING SERVICES
   INVENTORY - ORDER PREPARATION
========================================================= */

const INVENTORY_API = "/api/inventory";
const SERVER_API = "";
const STAFF_LOGIN = "../../staff/html/staff-login.html";

let currentPage = 1;
let currentOrders = [];
let selectedTrackingOrder = null;

let loadingOrders = false;
let savingTracking = false;

const processingOrders = new Set();


/* =========================================================
   01. HTML SECURITY
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
   02. NORMALIZE VALUES
========================================================= */

function normalizeInventoryValue(value) {

  return String(value ?? "")
    .trim()
    .toLowerCase();

}


/* =========================================================
   03. NOTIFICATION
========================================================= */

function inventoryNotify(message) {

  const element =
    document.getElementById("notice") ||
    document.getElementById("notification");

  if (element) {

    element.textContent = message;
    element.hidden = !message;

  } else {

    console.log(message);

  }

}


/* =========================================================
   04. STAFF SESSION
========================================================= */

function checkInventorySession() {

  try {

    const user = JSON.parse(
      localStorage.getItem("staffUser") || "null"
    );

    const token =
      localStorage.getItem("staffToken");

    const role =
      normalizeInventoryValue(user?.role);

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
   05. API REQUEST
========================================================= */

async function inventoryRequest(
  path,
  method = "GET",
  body,
  baseUrl = INVENTORY_API
) {

  let response;

  try {

    response = await fetch(
      `${baseUrl}${path}`,
      {

        method,

        cache: "no-store",

        headers: {

          Authorization:
            `Bearer ${localStorage.getItem("staffToken") || ""}`,

          ...(body !== undefined
            ? {
                "Content-Type": "application/json"
              }
            : {})

        },

        ...(body !== undefined
          ? {
              body: JSON.stringify(body)
            }
          : {})

      }
    );

  } catch (error) {

    throw new Error(
      "Cannot connect to the server. Please check your connection."
    );

  }


  /* -----------------------------------------
     EXPIRED SESSION
  ----------------------------------------- */

  if (response.status === 401) {

    localStorage.removeItem("staffToken");
    localStorage.removeItem("staffUser");

    window.location.replace(STAFF_LOGIN);

    throw new Error("Session expired.");

  }


  /* -----------------------------------------
     READ SERVER RESPONSE
  ----------------------------------------- */

  let data;

  try {

    data = await response.json();

  } catch (error) {

    throw new Error(
      "Invalid server response."
    );

  }


  /* -----------------------------------------
     HANDLE SERVER ERRORS
  ----------------------------------------- */

  if (
    !response.ok ||
    !data ||
    data.success === false
  ) {

    const message =

      data?.message ||

      data?.error ||

      `Request failed (${response.status}).`;

    console.error(
      "INVENTORY API ERROR",
      {

        url: `${baseUrl}${path}`,

        status: response.status,

        message,

        details: data?.details || null

      }
    );

    throw new Error(message);

  }

  return data;

}


/* =========================================================
   06. PAGE INITIALIZATION
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const user =
      checkInventorySession();

    if (!user) return;

    const staffBadge =
      document.querySelector(".topbar .staff");

    if (staffBadge) {

      staffBadge.textContent =

        user.full_name ||

        user.username ||

        "Inventory Staff";

    }

    setupTrackingModal();

    loadPreparationOrders();

  }
);


/* =========================================================
   07. GET READABLE ORDER NUMBER
========================================================= */

function getInventoryOrderNumber(order) {

  return String(

    order.order_number ||

    order.id ||

    "Unknown Order"

  );

}


/* =========================================================
   08. GET SAVED INVENTORY ITEMS
========================================================= */

function getInventoryOrderItems(order) {

  let items = order.inventory_items;

  if (typeof items === "string") {

    try {

      items = JSON.parse(items);

    } catch (error) {

      console.error(
        "INVALID INVENTORY ITEMS:",
        error
      );

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
   09. CASHIER VERIFICATION
========================================================= */

function isCashierVerified(order) {

  return Boolean(
    order.cashier_verified_at
  );

}


/* =========================================================
   10. PAYMENT ELIGIBILITY
========================================================= */

function isInventoryPaymentEligible(order) {

  const method =
    normalizeInventoryValue(
      order.payment_method
    );

  const payment =
    normalizeInventoryValue(
      order.payment_status
    );

  // COD DOES NOT REQUIRE ADVANCE PAYMENT

  if (method === "cod") {

    return true;

  }

  // PAYPAL MUST BE PAID

  if (method === "paypal") {

    return payment === "paid";

  }

  return false;

}


/* =========================================================
   11. GET PREPARATION STATUS
========================================================= */

function getInventoryPreparationStatus(order) {

  return String(

    order.inventory_preparation ||

    "Queued"

  ).trim();

}


/* =========================================================
   12. CHECK IF INVENTORY IS READY
========================================================= */

function isInventoryReady(order) {

  const preparation =
    normalizeInventoryValue(
      getInventoryPreparationStatus(order)
    );

  return [

    "ready",

    "ready to ship",

    "prepared"

  ].includes(preparation);

}


/* =========================================================
   13. ORDER PREPARATION ELIGIBILITY

   CORRECT WORKFLOW:

   Customer:
   Pending / Queued

   Cashier Verify:
   Pending / Queued / Verified

   Inventory Start:
   Preparing / Preparing

   Inventory Complete:
   To Ship / Ready
========================================================= */

function getPreparationEligibility(order) {

  const orderStatus =
    normalizeInventoryValue(
      order.status
    );

  const preparationStatus =
    normalizeInventoryValue(
      getInventoryPreparationStatus(order)
    );

  const verified =
    isCashierVerified(order);

  const paymentEligible =
    isInventoryPaymentEligible(order);

  const items =
    getInventoryOrderItems(order);

  const blocked = reason => ({

    allowed: false,

    action: null,

    reason

  });


  /* -----------------------------------------
     CLOSED ORDERS
  ----------------------------------------- */

  if (

    [
      "cancelled",
      "canceled",
      "completed"
    ].includes(orderStatus)

  ) {

    return blocked(
      "This order is already closed."
    );

  }


  /* -----------------------------------------
     RELEASED ORDERS
  ----------------------------------------- */

  if (

    order.cashier_released_at ||

    order.released_at

  ) {

    return blocked(
      "This order has already been released."
    );

  }


  /* -----------------------------------------
     CASHIER VERIFICATION REQUIRED
  ----------------------------------------- */

  if (!verified) {

    return blocked(
      "Waiting for cashier verification."
    );

  }


  /* -----------------------------------------
     PAYMENT VALIDATION
  ----------------------------------------- */

  if (!paymentEligible) {

    return blocked(
      "Waiting for successful payment confirmation."
    );

  }


  /* -----------------------------------------
     VALIDATE INVENTORY ITEMS
  ----------------------------------------- */

  if (
    !items.length ||
    items.length > 200
  ) {

    return blocked(
      "Valid saved inventory items are required."
    );

  }


  /* -----------------------------------------
     VALIDATE INVENTORY REVISION
  ----------------------------------------- */

  if (

    !Number.isInteger(
      order.inventory_revision
    ) ||

    order.inventory_revision < 0 ||

    order.inventory_revision >= 2147483647

  ) {

    return blocked(
      "Invalid inventory revision. Refresh this page."
    );

  }


  /* =========================================
     START PREPARATION

     IMPORTANT:
     Verified Pending orders are allowed.

     Cashier does not change the order status.
     Inventory starts the preparation.
  ========================================= */

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

    if (
      order.can_start_preparation === false
    ) {

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


  /* =========================================
     MARK READY TO SHIP
  ========================================= */

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

    if (
      order.can_mark_ready === false
    ) {

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


  /* -----------------------------------------
     COMPLETED PREPARATION
  ----------------------------------------- */

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
   14. J&T TRACKING ELIGIBILITY
========================================================= */

function canManageInventoryTracking(order) {

  const orderStatus =
    normalizeInventoryValue(
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
   15. LOAD PREPARATION ORDERS
========================================================= */

async function loadPreparationOrders() {

  const main =
    document.getElementById("main");

  if (!main || loadingOrders) {

    return;

  }

  loadingOrders = true;

  main.innerHTML = `

    <section class="panel">

      <p>
        Loading verified customer orders...
      </p>

    </section>

  `;

  try {

    /* ---------------------------------------
       GET VERIFIED ORDERS FROM BACKEND
    --------------------------------------- */

    const data = await inventoryRequest(

      `/orders?page=${currentPage}`

    );


    /* ---------------------------------------
       VALIDATE RESPONSE
    --------------------------------------- */

    if (!Array.isArray(data.orders)) {

      throw new Error(

        "The inventory orders API returned an invalid orders list."

      );

    }


    /* ---------------------------------------
       STORE ORDER DATA
    --------------------------------------- */

    currentOrders = data.orders;

    const total =
      Number(data.total) || 0;

    const limit =
      Number(data.limit) || 10;

    currentPage =
      Number(data.page) || currentPage;


    /* ---------------------------------------
       PAGE CONTENT
    --------------------------------------- */

    main.innerHTML = `

      <section class="panel">

        <div class="section-head">

          <h2>
            Order Preparation
          </h2>

          <button
            type="button"
            id="refreshOrders"
          >
            Refresh
          </button>

        </div>

        <p>

          Prepare customer orders that have
          been verified by the cashier.

          Check all ordered items before
          marking them as ready for shipment.

        </p>

        <div id="preparationOrders"></div>


        <!-- PAGINATION -->

        <div
          class="toolbar"
          style="margin-top:20px"
        >

          <button
            type="button"
            id="previousOrders"
            class="ghost"

            ${currentPage <= 1
              ? "disabled"
              : ""}

          >
            Previous
          </button>

          <span>

            Page ${currentPage}

            ·

            ${total} records

          </span>

          <button
            type="button"
            id="nextOrders"
            class="ghost"

            ${
              currentPage * limit >= total
                ? "disabled"
                : ""
            }

          >
            Next
          </button>

        </div>

      </section>

    `;


    /* ---------------------------------------
       DISPLAY ORDERS
    --------------------------------------- */

    renderPreparationOrders();

    setupPreparationPagination({

      total,

      limit

    });

  } catch (error) {

    console.error(
      "PREPARATION ERROR:",
      error
    );

    currentOrders = [];

    main.innerHTML = `

      <section class="panel">

        <h2>
          Unable to load data
        </h2>

        <p>
          ${escapeInventoryHtml(error.message)}
        </p>

        <button
          type="button"
          id="retryOrders"
        >
          Retry
        </button>

      </section>

    `;

    document
      .getElementById("retryOrders")
      ?.addEventListener(
        "click",
        loadPreparationOrders
      );

  } finally {

    loadingOrders = false;

  }

}


/* =========================================================
   16. DISPLAY PREPARATION ORDERS
========================================================= */

function renderPreparationOrders() {

  const container =
    document.getElementById(
      "preparationOrders"
    );

  if (!container) return;


  /* -----------------------------------------
     EMPTY ORDER LIST
  ----------------------------------------- */

  if (!currentOrders.length) {

    container.innerHTML = `

      <p class="empty">

        No verified orders awaiting preparation.

      </p>

    `;

    return;

  }


  /* =========================================
     RENDER ORDER CARDS
  ========================================= */

  container.innerHTML = currentOrders.map(

    (order, index) => {

      const items =
        getInventoryOrderItems(order);

      const verified =
        isCashierVerified(order);

      const paymentEligible =
        isInventoryPaymentEligible(order);

      const eligibility =
        getPreparationEligibility(order);

      const preparationStatus =
        getInventoryPreparationStatus(order);

      const normalizedPreparation =
        normalizeInventoryValue(
          preparationStatus
        );

      const isQueued =
        normalizedPreparation === "queued";

      const isPreparing =
        normalizedPreparation === "preparing";

      const isReady =
        isInventoryReady(order);

      const canPrepare =
        eligibility.allowed;

      const canTrack =
        canManageInventoryTracking(order);

      const trackingNumber =
        order.tracking_number || "";

      const shippingAddress = String(

        order.shipping_address ?? ""

      ).trim();

      const orderStatus =
        order.status || "Pending";

      const isBusy =
        processingOrders.has(order.id);


      /* =====================================
         ORDER CARD TEMPLATE
      ===================================== */

      return `

        <article
          class="order"
          data-index="${index}"
        >


          <!-- ORDER NUMBER -->

          <div class="section-head">

            <h3>

              Order ${escapeInventoryHtml(

                getInventoryOrderNumber(order)

              )}

            </h3>

            <span class="badge">

              ${escapeInventoryHtml(
                preparationStatus
              )}

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

            <strong>
              Order Status:
            </strong>

            ${escapeInventoryHtml(
              orderStatus
            )}

          </p>


          <!-- CUSTOMER PHONE -->

          <p>

            <strong>
              Contact Number:
            </strong>

            ${escapeInventoryHtml(

              order.customer_phone ||

              "Not available"

            )}

          </p>


          <!-- SHIPPING ADDRESS -->

          <p style="overflow-wrap:anywhere">

            <strong>
              Shipping Address:
            </strong>

            ${escapeInventoryHtml(

              shippingAddress ||

              "No shipping address saved"

            )}

          </p>


          <!-- CASHIER VERIFICATION -->

          <p>

            <strong>
              Cashier Verification:
            </strong>

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

                  Check all ordered items
                  to complete preparation.

                </p>

              `

              : ""
          }


          <!-- READY ORDER MESSAGE -->

          ${
            isReady

              ? `

                <p class="positive">

                  Inventory preparation completed.

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

                ? items.map(

                  (item, itemIndex) => `

                    <label class="check">

                      <input

                        type="checkbox"

                        value="${itemIndex}"

                        ${
                          isReady
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

                  `

                ).join("")

                : `

                  <p class="negative">

                    No saved item details.

                    Preparation is blocked
                    until verified items
                    are recovered.

                  </p>

                `
            }

          </div>


          <!-- PREPARATION ACTION BUTTONS -->

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

                        ? "Start Preparation"

                        : "Mark Ready to Ship"
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

  ).join("");


  /* -----------------------------------------
     INITIALIZE ORDER ACTIONS
  ----------------------------------------- */

  setupPreparationActions();

}


/* =========================================================
   17. PREPARATION ACTIONS
========================================================= */

function setupPreparationActions() {

  document

    .querySelectorAll(
      "#preparationOrders .order"
    )

    .forEach(card => {

      const index =
        Number(card.dataset.index);

      const order =
        currentOrders[index];

      if (!order) return;


      /* -------------------------------------
         GET PREPARATION BUTTON
      ------------------------------------- */

      const preparationButton =
        card.querySelector(

          '[data-action="start"], [data-action="ready"]'

        );


      /* -------------------------------------
         GET CHECKLIST
      ------------------------------------- */

      const checkboxes = [

        ...card.querySelectorAll(

          'input[type="checkbox"]'

        )

      ];


      /* =====================================
         PREPARATION BUTTON LOGIC
      ===================================== */

      if (preparationButton) {


        /* -----------------------------------
           ENABLE READY WHEN ALL ITEMS CHECKED
        ----------------------------------- */

        const updatePreparationButton = () => {

          const action =
            preparationButton.dataset.action;

          if (
            processingOrders.has(order.id)
          ) {

            preparationButton.disabled = true;

            return;

          }

          if (action === "ready") {

            preparationButton.disabled =

              checkboxes.length === 0 ||

              checkboxes.some(
                item => !item.checked
              );

          } else {

            preparationButton.disabled = false;

          }

        };


        /* -----------------------------------
           CHECKBOX CHANGE EVENTS
        ----------------------------------- */

        checkboxes.forEach(checkbox => {

          checkbox.addEventListener(

            "change",

            updatePreparationButton

          );

        });


        /* -----------------------------------
           BUTTON CLICK
        ----------------------------------- */

        preparationButton.addEventListener(

          "click",

          async () => {

            if (
              processingOrders.has(order.id)
            ) {

              return;

            }


            /* -------------------------------
               VALIDATE CURRENT ELIGIBILITY
            ------------------------------- */

            const eligibility =
              getPreparationEligibility(order);

            if (!eligibility.allowed) {

              inventoryNotify(
                eligibility.reason
              );

              return;

            }

            const action =
              preparationButton.dataset.action;

            if (
              action !== eligibility.action
            ) {

              inventoryNotify(

                "Order status changed. Please refresh the page."

              );

              return;

            }


            /* -------------------------------
               GET CHECKED ITEMS
            ------------------------------- */

            const checkedItems = checkboxes

              .filter(
                item => item.checked
              )

              .map(
                item => Number(item.value)
              );


            /* -------------------------------
               VALIDATE CHECKLIST
            ------------------------------- */

            if (

              action === "ready" &&

              (
                !checkboxes.length ||

                checkedItems.length !==
                  checkboxes.length
              )

            ) {

              inventoryNotify(

                "Please check all ordered items before marking the order ready."

              );

              return;

            }


            /* -------------------------------
               DISABLE DUPLICATE SUBMISSION
            ------------------------------- */

            processingOrders.add(order.id);

            preparationButton.disabled = true;

            const originalText =
              preparationButton.textContent;

            preparationButton.textContent =

              action === "start"

                ? "Starting Preparation..."

                : "Completing Preparation...";


            checkboxes.forEach(item => {

              item.disabled = true;

            });


            try {


              /* =============================
                 SEND PREPARATION ACTION

                 Backend handles:
                 Pending -> Preparing
                 Preparing -> To Ship

                 No direct client DB update.
              ============================= */

              await inventoryRequest(

                `/orders/${encodeURIComponent(order.id)}/preparation`,

                "PATCH",

                {

                  action,

                  revision:
                    order.inventory_revision,

                  checked:

                    action === "start"

                      ? []

                      : checkedItems

                }

              );


              /* -----------------------------
                 SUCCESS NOTIFICATION
              ----------------------------- */

              inventoryNotify(

                action === "ready"

                  ? "Order marked ready for shipment."

                  : "Order preparation started successfully."

              );


              /* -----------------------------
                 RELOAD SERVER DATA
              ----------------------------- */

              processingOrders.delete(order.id);

              await loadPreparationOrders();

            } catch (error) {

              console.error(

                "PREPARATION ACTION ERROR:",

                error

              );

              inventoryNotify(
                error.message
              );


              /* -----------------------------
                 RESTORE CHECKBOXES ON ERROR
              ----------------------------- */

              checkboxes.forEach(item => {

                item.disabled =
                  action !== "ready";

              });

            } finally {

              processingOrders.delete(
                order.id
              );

              preparationButton.textContent =
                originalText;

              updatePreparationButton();

            }

          }

        );


        /* -----------------------------------
           INITIAL BUTTON STATE
        ----------------------------------- */

        updatePreparationButton();

      }


      /* =====================================
         J&T TRACKING BUTTONS
      ===================================== */

      card

        .querySelectorAll(

          '[data-action="add-tracking"], [data-action="edit-tracking"]'

        )

        .forEach(button => {

          button.addEventListener(

            "click",

            () => {

              openJntTrackingModal(order);

            }

          );

        });

    });

}


/* =========================================================
   18. PAGINATION
========================================================= */

function setupPreparationPagination(data) {

  const total =
    Number(data.total) || 0;

  const limit =
    Number(data.limit) || 10;


  /* -----------------------------------------
     PREVIOUS PAGE
  ----------------------------------------- */

  document

    .getElementById("previousOrders")

    ?.addEventListener(

      "click",

      () => {

        if (
          currentPage > 1 &&
          !loadingOrders &&
          !processingOrders.size
        ) {

          currentPage--;

          loadPreparationOrders();

        }

      }

    );


  /* -----------------------------------------
     NEXT PAGE
  ----------------------------------------- */

  document

    .getElementById("nextOrders")

    ?.addEventListener(

      "click",

      () => {

        if (

          !loadingOrders &&

          !processingOrders.size &&

          currentPage * limit < total

        ) {

          currentPage++;

          loadPreparationOrders();

        }

      }

    );


  /* -----------------------------------------
     REFRESH ORDERS
  ----------------------------------------- */

  document

    .getElementById("refreshOrders")

    ?.addEventListener(

      "click",

      () => {

        if (

          loadingOrders ||

          processingOrders.size ||

          savingTracking

        ) {

          return;

        }

        loadPreparationOrders();

      }

    );

}


/* =========================================================
   19. INITIALIZE J&T TRACKING MODAL
========================================================= */

function setupTrackingModal() {

  const modal =
    document.getElementById(
      "jntTrackingModal"
    );

  const form =
    document.getElementById(
      "jntTrackingForm"
    );

  if (!modal || !form) {

    console.warn(

      "J&T tracking modal not found in order-preparation.html"

    );

    return;

  }


  /* -----------------------------------------
     CLOSE MODAL
  ----------------------------------------- */

  document

    .getElementById("closeJntModal")

    ?.addEventListener(

      "click",

      closeJntTrackingModal

    );


  /* -----------------------------------------
     CANCEL TRACKING
  ----------------------------------------- */

  document

    .getElementById("cancelJntTracking")

    ?.addEventListener(

      "click",

      closeJntTrackingModal

    );


  /* -----------------------------------------
     CLICK OUTSIDE MODAL
  ----------------------------------------- */

  modal

    .querySelector(".jnt-modal-overlay")

    ?.addEventListener(

      "click",

      closeJntTrackingModal

    );


  /* -----------------------------------------
     ESCAPE KEY
  ----------------------------------------- */

  document.addEventListener(

    "keydown",

    event => {

      if (

        event.key === "Escape" &&

        !modal.classList.contains("hidden")

      ) {

        closeJntTrackingModal();

      }

    }

  );


  /* -----------------------------------------
     SUBMIT TRACKING NUMBER
  ----------------------------------------- */

  form.addEventListener(

    "submit",

    saveJntTracking

  );

}


/* =========================================================
   20. OPEN J&T TRACKING MODAL
========================================================= */

function openJntTrackingModal(order) {

  if (savingTracking) {

    return;

  }

  const modal =
    document.getElementById(
      "jntTrackingModal"
    );

  const orderIdInput =
    document.getElementById(
      "jntOrderId"
    );

  const orderNumberElement =
    document.getElementById(
      "jntOrderNumber"
    );

  const trackingInput =
    document.getElementById(
      "jntTrackingNumber"
    );

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


  /* -----------------------------------------
     VALIDATE TRACKING ELIGIBILITY
  ----------------------------------------- */

  if (!canManageInventoryTracking(order)) {

    inventoryNotify(

      "Complete inventory preparation before registering tracking."

    );

    return;

  }


  /* -----------------------------------------
     SAVE SELECTED ORDER
  ----------------------------------------- */

  selectedTrackingOrder = order;


  /* -----------------------------------------
     INTERNAL ORDER UUID
  ----------------------------------------- */

  orderIdInput.value =
    order.id;


  /* -----------------------------------------
     READABLE JCN ORDER NUMBER
  ----------------------------------------- */

  orderNumberElement.textContent =
    getInventoryOrderNumber(order);


  /* -----------------------------------------
     EXISTING TRACKING NUMBER
  ----------------------------------------- */

  trackingInput.value =
    order.tracking_number || "";


  /* -----------------------------------------
     OPEN MODAL
  ----------------------------------------- */

  modal.classList.remove("hidden");

  modal.setAttribute(

    "aria-hidden",

    "false"

  );

  trackingInput.focus();

}


/* =========================================================
   21. CLOSE J&T TRACKING MODAL
========================================================= */

function closeJntTrackingModal(force = false) {

  if (
    savingTracking &&
    force !== true
  ) {

    return;

  }

  const modal =
    document.getElementById(
      "jntTrackingModal"
    );

  if (!modal) return;

  modal.classList.add("hidden");

  modal.setAttribute(

    "aria-hidden",

    "true"

  );

  selectedTrackingOrder = null;

}


/* =========================================================
   22. SAVE J&T TRACKING NUMBER
========================================================= */

async function saveJntTracking(event) {

  event.preventDefault();

  if (

    !selectedTrackingOrder ||

    savingTracking

  ) {

    return;

  }

  const order =
    selectedTrackingOrder;


  /* -----------------------------------------
     VALIDATE ORDER
  ----------------------------------------- */

  if (!canManageInventoryTracking(order)) {

    inventoryNotify(

      "Tracking is unavailable for this order."

    );

    return;

  }


  /* -----------------------------------------
     GET TRACKING INPUT
  ----------------------------------------- */

  const trackingInput =
    document.getElementById(
      "jntTrackingNumber"
    );

  const saveButton =
    document.getElementById(
      "saveJntTracking"
    );

  if (!trackingInput || !saveButton) {

    inventoryNotify(

      "Tracking form is incomplete."

    );

    return;

  }

  const trackingNumber =
    trackingInput.value.trim();


  /* -----------------------------------------
     VALIDATE TRACKING NUMBER
  ----------------------------------------- */

  if (

    !/^[A-Za-z0-9-]{6,50}$/.test(
      trackingNumber
    )

  ) {

    inventoryNotify(

      "Enter a valid tracking number from the J&T waybill."

    );

    return;

  }


  /* -----------------------------------------
     DISABLE DUPLICATE SUBMISSIONS
  ----------------------------------------- */

  savingTracking = true;

  const originalText =
    saveButton.textContent;

  saveButton.disabled = true;

  saveButton.textContent =
    "Registering Tracking...";

  trackingInput.disabled = true;


  try {


    /* =======================================
       REGISTER J&T TRACKING NUMBER
    ======================================= */

    await inventoryRequest(

      `/api/orders/${encodeURIComponent(order.id)}/tracking`,

      "POST",

      {

        tracking_number:
          trackingNumber,

        courier:
          "J&T Express"

      },

      SERVER_API

    );


    /* ---------------------------------------
       SUCCESS MESSAGE
    --------------------------------------- */

    inventoryNotify(

      "J&T tracking registered successfully."

    );


    /* ---------------------------------------
       CLOSE MODAL
    --------------------------------------- */

    closeJntTrackingModal(true);


    /* ---------------------------------------
       RELOAD ORDERS
    --------------------------------------- */

    await loadPreparationOrders();

  } catch (error) {

    console.error(

      "SAVE J&T TRACKING ERROR:",

      error

    );

    inventoryNotify(
      error.message
    );

  } finally {

    savingTracking = false;

    saveButton.disabled = false;

    saveButton.textContent =
      originalText;

    trackingInput.disabled = false;

  }

}