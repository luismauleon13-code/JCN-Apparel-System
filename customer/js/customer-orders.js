const API_URL = "http://localhost:5000";

let allOrders = [];
let myOrders = [];
let currentFilter = "All";


/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const loggedIn = checkLogin();

  if (!loggedIn) return;

  setupTabs();

  await loadOrders();

  const logoutBtn =
    document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener(
      "click",
      logoutCustomer
    );
  }
});


/* =========================================================
   LOGIN CHECK
========================================================= */

function checkLogin() {
  const token =
    localStorage.getItem("customerToken");

  const user =
    localStorage.getItem("customerUser");

  if (!token || !user) {
    Swal.fire({
      icon: "warning",
      title: "Login Required",
      text: "Please login first.",
      confirmButtonText: "OK",
      customClass: {
        popup: "jcn-popup",
        confirmButton: "jcn-confirm-btn"
      },
      buttonsStyling: false
    }).then(() => {
      window.location.href =
        "user-login.html";
    });

    return false;
  }

  return true;
}


/* =========================================================
   TABS
========================================================= */

function setupTabs() {
  document
    .querySelectorAll(".tab-btn")
    .forEach(btn => {
      btn.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".tab-btn")
            .forEach(b => {
              b.classList.remove("active");
            });

          btn.classList.add("active");

          currentFilter =
            btn.dataset.filter ||
            btn.dataset.status ||
            "All";

          displayOrders();

          const details =
            document.getElementById(
              "orderDetails"
            );

          if (details) {
            details.innerHTML = `
              <p class="empty">
                Select an order to view details.
              </p>
            `;
          }
        }
      );
    });
}


/* =========================================================
   LOAD CUSTOMER ORDERS
========================================================= */

async function loadOrders() {
  const ordersList =
    document.getElementById("ordersList");

  const user =
    JSON.parse(
      localStorage.getItem("customerUser")
    ) || {};

  if (!ordersList) return;

  if (!user.id) {
    ordersList.innerHTML = `
      <p class="empty">
        Customer information is missing.
      </p>
    `;

    return;
  }

  ordersList.innerHTML = `
    <p class="empty">
      Loading orders...
    </p>
  `;

  try {
    const response = await fetch(
      `${API_URL}/api/customer/orders/${user.id}`
    );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      ordersList.innerHTML = `
        <p class="empty">
          ${escapeHtml(
            data.message ||
            "Unable to load orders."
          )}
        </p>
      `;

      return;
    }

    allOrders =
      (data.orders || []).filter(
        order =>
          String(order.user_id) ===
          String(user.id)
      );

    displayOrders();

  } catch (error) {
    console.error(
      "LOAD ORDERS ERROR:",
      error
    );

    ordersList.innerHTML = `
      <p class="empty">
        Cannot connect to server.
      </p>
    `;
  }
}


/* =========================================================
   DISPLAY ORDERS
========================================================= */

function displayOrders() {
  const ordersList =
    document.getElementById("ordersList");

  if (!ordersList) return;

  myOrders =
    allOrders.filter(order => {

      const status =
        normalizeStatus(
          order.status
        );

      const paymentStatus =
        order.payment_status || "";

      const isCancelled =
        status === "Cancelled" ||
        paymentStatus === "Cancelled";

      const isToPay =
        !isCancelled &&
        (
          order.status ===
            "Pending Payment" ||

          paymentStatus ===
            "Unpaid"
        );


      if (
        currentFilter === "All"
      ) {
        return true;
      }


      if (
        currentFilter === "Pending"
      ) {
        return isToPay;
      }


      if (
        currentFilter ===
        "Processing"
      ) {
        return (
          !isCancelled &&
          status === "Processing"
        );
      }


      if (
        currentFilter ===
        "ToShip"
      ) {
        return (
          !isCancelled &&
          status === "To Ship"
        );
      }


      if (
        currentFilter ===
        "ToReceive"
      ) {
        return (
          !isCancelled &&
          status === "To Receive"
        );
      }


      if (
        currentFilter ===
        "Completed"
      ) {
        return (
          !isCancelled &&
          status === "Completed"
        );
      }


      if (
        currentFilter ===
        "Cancelled"
      ) {
        return isCancelled;
      }


      return true;
    });


  if (!myOrders.length) {
    ordersList.innerHTML = `
      <p class="empty">
        No orders found.
      </p>
    `;

    return;
  }


  ordersList.innerHTML = "";


  myOrders.forEach(
    (order, index) => {

      let status =
        normalizeStatus(
          order.status
        );


      const isCancelled =
        status === "Cancelled";


      const isWaitingPayment =
        !isCancelled &&
        order.payment_method ===
          "PayPal" &&
        (
          order.status ===
            "Pending Payment" ||
          order.payment_status ===
            "Unpaid"
        );


      if (isCancelled) {
        status = "Cancelled";
      }

      else if (
        isWaitingPayment
      ) {
        status =
          "Waiting Payment";
      }


      ordersList.innerHTML += `
        <div
          class="order-card"
          onclick="window.selectOrder(${index})"
        >

          <h3>
            ${
              escapeHtml(
                order.order_number ||
                `Order #${order.id}`
              )
            }
          </h3>

          <p>
            Total:
            ₱${Number(
              order.total_amount || 0
            ).toFixed(2)}
          </p>

          <p>
            Payment:
            ${escapeHtml(
              order.payment_method ||
              "N/A"
            )}
            -
            ${escapeHtml(
              order.payment_status ||
              "Pending"
            )}
          </p>

          <p>
            Date:
            ${formatDate(
              order.created_at
            )}
          </p>

          ${
            order.tracking_number
              ? `
                <p class="order-tracking-number">
                  <i class="fa-solid fa-truck"></i>
                  J&T:
                  ${escapeHtml(
                    order.tracking_number
                  )}
                </p>
              `
              : ""
          }

          <span
            class="status ${
              status
                .toLowerCase()
                .replaceAll(
                  " ",
                  "-"
                )
            }"
          >
            ${escapeHtml(status)}
          </span>

        </div>
      `;
    }
  );
}


/* =========================================================
   SELECT ORDER
========================================================= */

async function selectOrder(index) {
  const order =
    myOrders[index];

  if (!order) {
    return;
  }


  const details =
    document.getElementById(
      "orderDetails"
    );


  if (!details) {
    return;
  }


  const status =
    normalizeStatus(
      order.status
    );


  const isCancelled =
    status === "Cancelled";


  const isPayPalUnpaid =
    !isCancelled &&
    order.payment_method ===
      "PayPal" &&
    order.payment_status ===
      "Unpaid";


  details.innerHTML = `

    <div class="detail-row">

      <span>
        Order Number
      </span>

      <strong>
        ${
          escapeHtml(
            order.order_number ||
            `Order #${order.id}`
          )
        }
      </strong>

    </div>


    <div class="detail-row">

      <span>
        Customer
      </span>

      <strong>
        ${
          escapeHtml(
            order.customer_name ||
            "Customer"
          )
        }
      </strong>

    </div>


    <div class="detail-row">

      <span>
        Payment Method
      </span>

      <strong>
        ${
          escapeHtml(
            order.payment_method ||
            "N/A"
          )
        }
      </strong>

    </div>


    <div class="detail-row">

      <span>
        Payment Status
      </span>

      <strong>
        ${
          escapeHtml(
            order.payment_status ||
            "Pending"
          )
        }
      </strong>

    </div>


    <div class="detail-row">

      <span>
        Total
      </span>

      <strong>
        ₱${Number(
          order.total_amount || 0
        ).toFixed(2)}
      </strong>

    </div>


    <div class="detail-row">

      <span>
        Status
      </span>

      <strong>
        ${
          isPayPalUnpaid
            ? "Waiting Payment"
            : escapeHtml(status)
        }
      </strong>

    </div>


    <!-- =====================================
         J&T TRACKING
    ====================================== -->

    <div
      id="jntLatestUpdate"
      class="jnt-latest-update"
    >
      ${
        order.tracking_number
          ? `
            <div class="jnt-loading">
              <i class="fa-solid fa-spinner fa-spin"></i>
              Getting latest J&T update...
            </div>
          `
          : `
            <div class="jnt-no-tracking">

              <i class="fa-solid fa-truck"></i>

              <div>

                <strong>
                  No J&T tracking yet
                </strong>

                <p>
                  Tracking information will
                  appear here after the admin
                  adds a J&T tracking number.
                </p>

              </div>

            </div>
          `
      }
    </div>


    <!-- =====================================
         ORDER PROGRESS
    ====================================== -->

    <div class="tracker">

      ${
        isCancelled

          ? `

            <div
              class="step cancelled active"
            >

              <span class="dot"></span>

              <div>

                <strong>
                  Cancelled
                </strong>

                <p>
                  This order has been cancelled.
                </p>

              </div>

            </div>

          `

          : isPayPalUnpaid

          ? `

            <div class="step active">

              <span class="dot"></span>

              <div>

                <strong>
                  Waiting Payment
                </strong>

                <p>
                  Waiting for PayPal payment.
                </p>

              </div>

            </div>


            <div class="step">

              <span class="dot"></span>

              <div>

                <strong>
                  Processing
                </strong>

                <p>
                  Your order is being prepared.
                </p>

              </div>

            </div>


            <div class="step">

              <span class="dot"></span>

              <div>

                <strong>
                  To Ship
                </strong>

                <p>
                  Your order is ready to ship.
                </p>

              </div>

            </div>


            <div class="step">

              <span class="dot"></span>

              <div>

                <strong>
                  To Receive
                </strong>

                <p>
                  Your order is on the way.
                </p>

              </div>

            </div>


            <div class="step">

              <span class="dot"></span>

              <div>

                <strong>
                  Completed
                </strong>

                <p>
                  Your order has been completed.
                </p>

              </div>

            </div>

          `

          : `

            ${statusStep(
              "Processing",
              status
            )}

            ${statusStep(
              "To Ship",
              status
            )}

            ${statusStep(
              "To Receive",
              status
            )}

            ${statusStep(
              "Completed",
              status
            )}

          `
      }

    </div>


    <!-- =====================================
         ACTION BUTTONS
    ====================================== -->

    <div class="order-actions">

      ${
        isPayPalUnpaid
          ? `
            <button
              type="button"
              class="pay-btn"
              onclick="
                window.continueToPay(
                  '${order.id}'
                )
              "
            >
              Continue to Pay
            </button>
          `
          : ""
      }


      ${
        canCancelOrder(order)
          ? `
            <button
              type="button"
              class="cancel-btn"
              onclick="
                window.cancelOrder(
                  '${order.id}'
                )
              "
            >
              Cancel Order
            </button>
          `
          : ""
      }


      <button
        type="button"
        class="complete-btn"

        onclick="
          window.completeOrder(
            '${order.id}'
          )
        "

        ${
          status !== "To Receive"
            ? "disabled"
            : ""
        }
      >

        Order Received /
        Complete Order

      </button>

    </div>
  `;


  /*
    Fetch latest J&T info after
    rendering the order panel.
  */

  if (
    order.tracking_number &&
    !isCancelled
  ) {
    await loadLatestJntUpdate(
      order
    );
  }
}


/* =========================================================
   LATEST J&T UPDATE
========================================================= */

async function loadLatestJntUpdate(
  order
) {

  const container =
    document.getElementById(
      "jntLatestUpdate"
    );


  if (!container) {
    return;
  }


  if (!order.tracking_number) {

    container.innerHTML = `

      <div class="jnt-no-tracking">

        <i class="fa-solid fa-truck"></i>

        <div>

          <strong>
            No J&T tracking yet
          </strong>

          <p>
            Waiting for the administrator
            to add a tracking number.
          </p>

        </div>

      </div>
    `;

    return;
  }


  container.innerHTML = `

    <div class="jnt-loading">

      <i
        class="fa-solid
        fa-spinner
        fa-spin"
      ></i>

      Getting latest J&T update...

    </div>
  `;


  try {

    const response =
      await fetch(
        `${API_URL}/api/orders/${order.id}/tracking`
      );


    let data;


    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "Invalid tracking server response."
      );
    }


    console.log(
      "J&T TRACKING RESPONSE:",
      data
    );


    if (
      !response.ok ||
      !data.success
    ) {

      container.innerHTML = `

        <div class="jnt-error">

          <i
            class="fa-solid
            fa-triangle-exclamation"
          ></i>

          <div>

            <strong>
              Tracking unavailable
            </strong>

            <p>
              ${
                escapeHtml(
                  data.message ||
                  "Unable to retrieve J&T tracking."
                )
              }
            </p>

          </div>

        </div>
      `;

      return;
    }


    const tracking =
      data.tracking || {};


    const latestLocation =
      tracking.latest_location ||
      "Location not yet available";


    const latestMessage =
      tracking.latest_message ||
      "Waiting for J&T update.";


    const latestDate =
      tracking.latest_date
        ? formatTrackingDate(
            tracking.latest_date
          )
        : "Waiting for update";


    const trackingNumber =
      tracking.tracking_number ||
      order.tracking_number;


    const trackingStatus =
      tracking.status ||
      "In Transit";


    container.innerHTML = `

      <div class="jnt-update-card">


        <!-- HEADER -->

        <div class="jnt-update-header">

          <div class="jnt-title">

            <i
              class="fa-solid
              fa-truck-fast"
            ></i>

            <span>
              Latest J&T Update
            </span>

          </div>


          <span class="jnt-live-badge">
            LIVE
          </span>

        </div>


        <!-- STATUS -->

        <div class="jnt-current-status">

          <span>
            Shipment Status
          </span>

          <strong>
            ${
              escapeHtml(
                trackingStatus
              )
            }
          </strong>

        </div>


        <!-- LOCATION -->

        <div class="jnt-location">

          <div class="jnt-location-icon">

            <i
              class="fa-solid
              fa-location-dot"
            ></i>

          </div>


          <div class="jnt-location-info">

            <small>
              Latest Location
            </small>

            <strong>
              ${
                escapeHtml(
                  latestLocation
                )
              }
            </strong>

            <p>
              ${
                escapeHtml(
                  latestMessage
                )
              }
            </p>

          </div>

        </div>


        <!-- DATE -->

        <div class="jnt-update-footer">

          <div>

            <i
              class="fa-regular
              fa-clock"
            ></i>

            ${
              escapeHtml(
                latestDate
              )
            }

          </div>


          <div>

            Tracking:

            <strong>
              ${
                escapeHtml(
                  trackingNumber
                )
              }
            </strong>

          </div>

        </div>


        ${
          tracking.estimated_delivery
            ? `

              <div class="jnt-estimated">

                <i
                  class="fa-solid
                  fa-calendar-check"
                ></i>

                Estimated Delivery:

                <strong>

                  ${
                    escapeHtml(
                      formatTrackingDate(
                        tracking
                          .estimated_delivery
                      )
                    )
                  }

                </strong>

              </div>

            `
            : ""
        }


        ${
          Array.isArray(
            tracking.history
          ) &&
          tracking.history.length

            ? `

              <button
                type="button"
                class="jnt-history-btn"
                onclick="
                  window.toggleJntHistory()
                "
              >

                <i
                  class="fa-solid
                  fa-clock-rotate-left"
                ></i>

                View Tracking History

              </button>


              <div
                id="jntTrackingHistory"
                class="jnt-tracking-history"
                style="display:none;"
              >

                ${
                  buildTrackingHistory(
                    tracking.history
                  )
                }

              </div>

            `

            : ""
        }


      </div>
    `;


  } catch (error) {

    console.error(
      "J&T TRACKING ERROR:",
      error
    );


    container.innerHTML = `

      <div class="jnt-error">

        <i
          class="fa-solid
          fa-circle-exclamation"
        ></i>

        <div>

          <strong>
            Cannot load tracking
          </strong>

          <p>
            ${
              escapeHtml(
                error.message ||
                "Unable to connect to J&T tracking server."
              )
            }
          </p>

        </div>

      </div>
    `;
  }
}


/* =========================================================
   BUILD J&T HISTORY
========================================================= */

function buildTrackingHistory(
  history
) {

  if (
    !Array.isArray(history) ||
    !history.length
  ) {

    return `
      <p class="jnt-no-history">
        No tracking history available yet.
      </p>
    `;
  }


  return history
    .map(
      (checkpoint, index) => `

        <div
          class="
            jnt-history-item
            ${
              index === 0
                ? "latest"
                : ""
            }
          "
        >

          <div
            class="jnt-history-marker"
          >

            <span
              class="jnt-history-dot"
            ></span>

            ${
              index <
              history.length - 1

                ? `
                  <span
                    class="jnt-history-line"
                  ></span>
                `

                : ""
            }

          </div>


          <div
            class="jnt-history-content"
          >

            <strong>

              ${
                escapeHtml(
                  checkpoint.location ||
                  "Location not provided"
                )
              }

            </strong>


            <p>

              ${
                escapeHtml(
                  checkpoint.message ||
                  "Shipment updated"
                )
              }

            </p>


            <small>

              ${
                escapeHtml(
                  formatTrackingDate(
                    checkpoint.date
                  )
                )
              }

            </small>

          </div>

        </div>
      `
    )
    .join("");
}


/* =========================================================
   TOGGLE J&T HISTORY
========================================================= */

function toggleJntHistory() {

  const history =
    document.getElementById(
      "jntTrackingHistory"
    );


  if (!history) {
    return;
  }


  if (
    history.style.display ===
    "none"
  ) {

    history.style.display =
      "block";

  } else {

    history.style.display =
      "none";

  }
}


/* =========================================================
   CONTINUE PAYPAL PAYMENT
========================================================= */

async function continueToPay(
  orderId
) {

  try {

    Swal.fire({

      title:
        "Connecting to PayPal",

      text:
        "Please wait...",

      allowOutsideClick:
        false,

      allowEscapeKey:
        false,

      didOpen() {
        Swal.showLoading();
      }

    });


    const response =
      await fetch(
        `${API_URL}/api/paypal/create-redirect-order`,
        {

          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              system_order_id:
                orderId
            })

        }
      );


    const data =
      await response.json();


    Swal.close();


    if (
      !response.ok ||
      !data.success ||
      !data.approve_url
    ) {

      await showError(
        data.message ||
        "Cannot continue PayPal payment."
      );

      return;
    }


    localStorage.setItem(
      "lastOrderId",
      orderId
    );


    if (
      data.paypal_order_id
    ) {

      localStorage.setItem(
        "paypalOrderId",
        data.paypal_order_id
      );

    }


    window.location.href =
      data.approve_url;


  } catch (error) {

    Swal.close();

    console.error(
      "PAYPAL ERROR:",
      error
    );


    await showError(
      "Cannot connect to PayPal server."
    );

  }
}


/* =========================================================
   CAN CANCEL?
========================================================= */

function canCancelOrder(order) {

  const status =
    normalizeStatus(
      order.status
    );


  if (
    status === "Cancelled" ||
    status === "To Ship" ||
    status === "To Receive" ||
    status === "Completed"
  ) {
    return false;
  }


  return (

    status === "Pending" ||

    status === "Processing" ||

    order.status ===
      "Pending Payment" ||

    order.payment_status ===
      "Unpaid"

  );
}


/* =========================================================
   STATUS STEP
========================================================= */

function statusStep(
  step,
  currentStatus
) {

  if (
    currentStatus ===
    "Cancelled"
  ) {

    return `

      <div class="step">

        <span class="dot"></span>

        <div>

          <strong>
            ${step}
          </strong>

          <p>
            ${getStatusText(step)}
          </p>

        </div>

      </div>
    `;
  }


  const orderSteps = [

    "Pending",

    "Processing",

    "To Ship",

    "To Receive",

    "Completed"

  ];


  const currentIndex =
    orderSteps.indexOf(
      currentStatus
    );


  const stepIndex =
    orderSteps.indexOf(
      step
    );


  const active =
    currentIndex >= 0 &&
    stepIndex >= 0 &&
    stepIndex <= currentIndex;


  return `

    <div
      class="
        step
        ${active ? "active" : ""}
      "
    >

      <span class="dot"></span>

      <div>

        <strong>
          ${step}
        </strong>

        <p>
          ${getStatusText(step)}
        </p>

      </div>

    </div>
  `;
}


/* =========================================================
   STATUS TEXT
========================================================= */

function getStatusText(
  status
) {

  if (
    status === "Pending"
  ) {
    return "Waiting for payment.";
  }


  if (
    status === "Processing"
  ) {
    return "Your order is being prepared.";
  }


  if (
    status === "To Ship"
  ) {
    return "Your order is ready to ship.";
  }


  if (
    status === "To Receive"
  ) {
    return "Your order is on the way.";
  }


  if (
    status === "Completed"
  ) {
    return "Your order has been completed.";
  }


  return "";
}


/* =========================================================
   NORMALIZE STATUS
========================================================= */

function normalizeStatus(
  status
) {

  if (!status) {
    return "Pending";
  }


  if (
    status === "Preparing"
  ) {
    return "Processing";
  }


  if (
    status === "Processing"
  ) {
    return "Processing";
  }


  if (
    status === "To Pay"
  ) {
    return "Pending";
  }


  if (
    status === "Pending"
  ) {
    return "Pending";
  }


  if (
    status ===
    "Pending Payment"
  ) {
    return "Pending";
  }


  if (
    status === "To Ship"
  ) {
    return "To Ship";
  }


  if (
    status ===
    "To Deliver"
  ) {
    return "To Receive";
  }


  if (
    status === "Shipped"
  ) {
    return "To Receive";
  }


  if (
    status ===
    "To Receive"
  ) {
    return "To Receive";
  }


  if (
    status === "Completed"
  ) {
    return "Completed";
  }


  if (
    status === "Delivered"
  ) {
    return "Completed";
  }


  if (
    status === "Cancelled" ||
    status === "Canceled"
  ) {
    return "Cancelled";
  }


  return status;
}


/* =========================================================
   CANCEL ORDER
========================================================= */

async function cancelOrder(
  orderId
) {

  const result =
    await Swal.fire({

      title:
        "Cancel Order",

      text:
        "Are you sure you want to cancel this order?",

      icon:
        "warning",

      showCancelButton:
        true,

      confirmButtonText:
        "Yes, Cancel Order",

      cancelButtonText:
        "Keep Order",

      customClass: {

        popup:
          "jcn-popup",

        title:
          "jcn-warning-title",

        confirmButton:
          "jcn-danger-btn",

        cancelButton:
          "jcn-cancel-btn"

      },

      buttonsStyling:
        false

    });


  if (!result.isConfirmed) {
    return;
  }


  try {

    const response =
      await fetch(
        `${API_URL}/api/customer/orders/${orderId}/cancel`,
        {
          method:
            "PATCH"
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      await showError(
        data.message ||
        "Failed to cancel order."
      );

      return;
    }


    showSuccess(
      "Order cancelled successfully."
    );


    await loadOrders();


    const details =
      document.getElementById(
        "orderDetails"
      );


    if (details) {

      details.innerHTML = `

        <p class="empty">
          Select an order to view details.
        </p>
      `;

    }


  } catch (error) {

    console.error(
      "CANCEL ERROR:",
      error
    );


    await showError(
      "Cannot connect to server."
    );

  }
}


/* =========================================================
   COMPLETE ORDER
========================================================= */

async function completeOrder(
  orderId
) {

  const result =
    await Swal.fire({

      title:
        "Complete Order",

      text:
        "Confirm that you already received this order?",

      icon:
        "question",

      showCancelButton:
        true,

      confirmButtonText:
        "Yes, I Received It",

      cancelButtonText:
        "Cancel",

      customClass: {

        popup:
          "jcn-popup",

        title:
          "jcn-title",

        confirmButton:
          "jcn-confirm-btn",

        cancelButton:
          "jcn-cancel-btn"

      },

      buttonsStyling:
        false

    });


  if (!result.isConfirmed) {
    return;
  }


  try {

    const response =
      await fetch(
        `${API_URL}/api/customer/orders/${orderId}/complete`,
        {
          method:
            "PATCH"
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      await showError(
        data.message ||
        "Failed to complete order."
      );

      return;
    }


    showSuccess(
      "Order received successfully."
    );


    await loadOrders();


    const details =
      document.getElementById(
        "orderDetails"
      );


    if (details) {

      details.innerHTML = `

        <p class="empty">
          Select an order to view details.
        </p>
      `;

    }


  } catch (error) {

    console.error(
      "COMPLETE ORDER ERROR:",
      error
    );


    await showError(
      "Cannot connect to server."
    );

  }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutCustomer(
  event
) {

  if (event) {
    event.preventDefault();
  }


  const result =
    await Swal.fire({

      icon:
        "question",

      title:
        "Logout?",

      text:
        "Are you sure you want to logout?",

      showCancelButton:
        true,

      confirmButtonText:
        "Logout",

      cancelButtonText:
        "Cancel",

      customClass: {

        popup:
          "jcn-popup",

        confirmButton:
          "jcn-confirm-btn",

        cancelButton:
          "jcn-cancel-btn"

      },

      buttonsStyling:
        false

    });


  if (!result.isConfirmed) {
    return;
  }


  localStorage.removeItem(
    "customerToken"
  );


  localStorage.removeItem(
    "customerUser"
  );


  /*
    Keep customerCart if you want
    cart contents to remain.
  */


  window.location.href =
    "../../index.html";
}


/* =========================================================
   SUCCESS TOAST
========================================================= */

function showSuccess(
  message
) {

  const oldToast =
    document.querySelector(
      ".jcn-success-toast"
    );


  if (oldToast) {
    oldToast.remove();
  }


  const toast =
    document.createElement(
      "div"
    );


  toast.className =
    "jcn-success-toast";


  toast.innerHTML = `

    <i
      class="fa-solid
      fa-circle-check"
    ></i>

    <span>
      ${escapeHtml(message)}
    </span>
  `;


  document.body.appendChild(
    toast
  );


  setTimeout(
    () => {
      toast.classList.add(
        "show"
      );
    },
    50
  );


  setTimeout(
    () => {

      toast.classList.remove(
        "show"
      );


      setTimeout(
        () => {
          toast.remove();
        },
        300
      );

    },
    2500
  );
}


/* =========================================================
   ERROR ALERT
========================================================= */

async function showError(
  message
) {

  await Swal.fire({

    icon:
      "error",

    title:
      "Error",

    text:
      message,

    confirmButtonText:
      "OK",

    customClass: {

      popup:
        "jcn-popup",

      title:
        "jcn-error-title",

      confirmButton:
        "jcn-confirm-btn"

    },

    buttonsStyling:
      false

  });
}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(
  dateValue
) {

  if (!dateValue) {
    return "N/A";
  }


  const date =
    new Date(
      dateValue
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return dateValue;
  }


  return date.toLocaleDateString(
    "en-PH",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric"
    }
  );
}


/* =========================================================
   J&T DATE/TIME FORMAT
========================================================= */

function formatTrackingDate(
  dateValue
) {

  if (!dateValue) {
    return "Waiting for update";
  }


  const date =
    new Date(
      dateValue
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return dateValue;
  }


  return date.toLocaleString(
    "en-PH",
    {

      timeZone:
        "Asia/Manila",

      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      hour12:
        true

    }
  );
}


/* =========================================================
   HTML SECURITY
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );
}


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.selectOrder =
  selectOrder;

window.continueToPay =
  continueToPay;

window.cancelOrder =
  cancelOrder;

window.completeOrder =
  completeOrder;

window.toggleJntHistory =
  toggleJntHistory;