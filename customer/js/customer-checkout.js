/* =========================================================
   JCN APPAREL PRINTING SERVICES
   CUSTOMER CHECKOUT
   LIVE PAYPAL AND CASH ON DELIVERY
========================================================= */

const API_URL = "";
const DELIVERY_FEE = 80;

let checkoutSubmitting = false;
let checkoutNavigating = false;

let cart =
  JSON.parse(localStorage.getItem("checkoutItems")) ||
  JSON.parse(localStorage.getItem("customerCart")) ||
  [];


/* =========================================================
   01. PAGE LOAD
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("CHECKOUT JS LOADED");

  initializeCheckoutMobileSidebar();

  const loggedIn = await checkLogin();

  if (!loggedIn) return;

  if (await handlePayPalReturn()) return;

  fillCustomerInfo();
  loadOrderSummary();
  setupPaymentMethod();
  setupCheckoutForm();
  setupLogoutButton();
  setupOrderButton();
});


/* =========================================================
   02. ALERT
========================================================= */

async function showAlert(icon, title, text) {
  return Swal.fire({
    icon,
    title,
    text,

    confirmButtonText: "OK",

    customClass: {
      popup: "jcn-popup",

      title:
        icon === "error"
          ? "jcn-error-title"
          : icon === "success"
          ? "jcn-success-title"
          : "jcn-warning-title",

      confirmButton: "jcn-confirm-btn"
    },

    buttonsStyling: false
  });
}


/* =========================================================
   03. CUSTOMER LOGIN CHECK
========================================================= */

async function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const rawUser = localStorage.getItem("customerUser");

  if (!token || !rawUser) {
    await showAlert(
      "warning",
      "Login Required",
      "Please login first."
    );

    window.location.href = "user-login.html";

    return false;
  }

  const params = new URLSearchParams(
    window.location.search
  );

  const payment = params.get("payment");
  const paypal = params.get("paypal");

  if (!cart.length && !payment && !paypal) {
    await showAlert(
      "warning",
      "No Checkout Items",
      "Please select a product first."
    );

    window.location.href = "customer-shop.html";

    return false;
  }

  return true;
}


/* =========================================================
   04. CUSTOMER INFORMATION
========================================================= */

function fillCustomerInfo() {
  const user =
    JSON.parse(localStorage.getItem("customerUser")) || {};

  const fullNameInput =
    document.getElementById("fullName") ||
    document.getElementById("fullname");

  const emailInput =
    document.getElementById("email");

  const phoneInput =
    document.getElementById("phone");

  const addressInput =
    document.getElementById("address");

  if (fullNameInput) {
    fullNameInput.value =
      user.full_name ||
      user.fullname ||
      user.fullName ||
      user.username ||
      "";
  }

  if (emailInput) {
    emailInput.value = user.email || "";
  }

  if (phoneInput) {
    phoneInput.value = user.phone || "";
  }

  if (addressInput) {
    addressInput.value = user.address || "";
  }
}


/* =========================================================
   05. ORDER SUMMARY
========================================================= */

function loadOrderSummary() {
  const orderItems =
    document.getElementById("orderItems");

  if (!orderItems) {
    console.warn("#orderItems not found");
    return;
  }

  orderItems.innerHTML = "";

  if (!cart.length) {
    orderItems.innerHTML = `
      <p class="empty">
        No selected products.
      </p>
    `;

    updateTotals();
    return;
  }

  cart.forEach(item => {
    const quantity = Number(item.quantity || 1);
    const price = getItemPrice(item);

    orderItems.innerHTML += `
      <div class="order-item">

        <div class="order-item-info">

          <strong>
            ${escapeHtml(
              item.title ||
              item.name ||
              "Product"
            )}
          </strong>

          <p>
            Size: ${escapeHtml(item.size || "N/A")}

            &nbsp; | &nbsp;

            Color: ${escapeHtml(item.color || "N/A")}

            &nbsp; | &nbsp;

            Qty: ${quantity}
          </p>

        </div>

        <div class="order-item-price">
          ₱${(price * quantity).toFixed(2)}
        </div>

      </div>
    `;
  });

  updateTotals();
}


/* =========================================================
   06. GET PRODUCT PRICE
========================================================= */

function getItemPrice(item) {
  return Number(
    item.discounted_price ??
    item.discountedPrice ??
    item.final_price ??
    item.finalPrice ??
    item.price ??
    0
  );
}


/* =========================================================
   07. CALCULATE SUBTOTAL
========================================================= */

function calculateSubtotal() {
  return cart.reduce((total, item) => {
    const price = getItemPrice(item);
    const quantity = Number(item.quantity || 1);

    return total + price * quantity;
  }, 0);
}


/* =========================================================
   08. UPDATE CHECKOUT TOTALS
========================================================= */

function updateTotals() {
  const subtotal = calculateSubtotal();

  const deliveryFee =
    cart.length ? DELIVERY_FEE : 0;

  const grandTotal = subtotal + deliveryFee;

  const subtotalElement =
    document.getElementById("subtotal");

  const deliveryElement =
    document.getElementById("deliveryFee");

  const grandTotalElement =
    document.getElementById("grandTotal");

  if (subtotalElement) {
    subtotalElement.textContent =
      `₱${subtotal.toFixed(2)}`;
  }

  if (deliveryElement) {
    deliveryElement.textContent =
      `₱${deliveryFee.toFixed(2)}`;
  }

  if (grandTotalElement) {
    grandTotalElement.textContent =
      `₱${grandTotal.toFixed(2)}`;
  }

  return grandTotal;
}


/* =========================================================
   09. GENERATE ORDER NUMBER
========================================================= */

function generateOrderNumber() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const random = Math.floor(
    100000 + Math.random() * 900000
  );

  return `JCN-${year}${month}${day}-${random}`;
}


/* =========================================================
   10. PAYMENT METHOD SELECTION
========================================================= */

function setupPaymentMethod() {
  const paymentCards =
    document.querySelectorAll(".payment-card");

  const paymentInput =
    document.getElementById("paymentMethod");

  const confirmBtn =
    document.querySelector(".confirm-btn");

  if (!paymentInput) {
    console.error("paymentMethod input not found");
    return;
  }

  if (!paymentInput.value) {
    paymentInput.value = "COD";
  }

  paymentCards.forEach(card => {
    card.addEventListener("click", () => {
      if (checkoutSubmitting || checkoutNavigating) {
        return;
      }

      paymentCards.forEach(current => {
        current.classList.remove("active");
      });

      card.classList.add("active");

      const method = card.dataset.method;

      console.log("PAYMENT SELECTED:", method);

      paymentInput.value = method;

      if (!confirmBtn) return;

      confirmBtn.textContent =
        method === "PayPal"
          ? "Pay with PayPal"
          : "Confirm Order";
    });
  });
}


/* =========================================================
   11. CHECKOUT FORM
========================================================= */

function setupCheckoutForm() {
  const checkoutForm =
    document.getElementById("checkoutForm");

  if (!checkoutForm) {
    console.error("ERROR: checkoutForm not found.");
    return;
  }

  console.log("Checkout form connected.");

  checkoutForm.addEventListener(
    "submit",
    confirmOrder
  );
}


/* =========================================================
   12. CONFIRM ORDER
   PREVENT REPEATED SUBMISSIONS
========================================================= */

async function confirmOrder(event) {
  event.preventDefault();

  if (checkoutSubmitting || checkoutNavigating) {
    return;
  }

  checkoutSubmitting = true;

  try {
    const paymentMethod =
      document.getElementById("paymentMethod")?.value ||
      "COD";

    if (paymentMethod === "PayPal") {
      await createPayPalOrder();
    } else {
      await createCODOrder();
    }

  } finally {
    if (!checkoutNavigating) {
      checkoutSubmitting = false;
      setCheckoutLoading(false);
    }
  }
}


/* =========================================================
   13. CASH ON DELIVERY
========================================================= */

async function createCODOrder() {
  const result = await Swal.fire({
    title: "Confirm Order",

    text:
      "Do you want to place this Cash on Delivery order?",

    icon: "question",

    showCancelButton: true,

    confirmButtonText: "Place Order",
    cancelButtonText: "Cancel",

    customClass: {
      popup: "jcn-popup",
      title: "jcn-title",
      confirmButton: "jcn-confirm-btn",
      cancelButton: "jcn-cancel-btn"
    },

    buttonsStyling: false
  });

  if (!result.isConfirmed) return;

  setCheckoutLoading(
    true,
    "Creating Order..."
  );

  try {
    const data = await createSystemOrder("COD");

    if (!data) return;

    removeCheckedOutItemsFromCart();

    localStorage.removeItem("checkoutItems");

    const orderNumber =
      data.order?.order_number ||
      data.order_number ||
      data.orderNumber ||
      "N/A";

    await Swal.fire({
      icon: "success",

      title: "Order Confirmed!",

      html: `
        <p>
          Your COD order has been placed.
        </p>

        <p>
          Order Number:
        </p>

        <strong style="
          color: #d4af37;
          font-size: 22px;
        ">
          ${escapeHtml(orderNumber)}
        </strong>
      `,

      confirmButtonText: "View My Orders",

      customClass: {
        popup: "jcn-popup",
        title: "jcn-success-title",
        confirmButton: "jcn-confirm-btn"
      },

      buttonsStyling: false
    });

    checkoutNavigating = true;

    window.location.href =
      "customer-orders.html";

  } catch (error) {
    console.error("COD ERROR:", error.message);

    await showAlert(
      "error",
      "Order Failed",
      error.message || "Unable to create COD order."
    );

  } finally {
    if (!checkoutNavigating) {
      setCheckoutLoading(false);
    }
  }
}


/* =========================================================
   14. PAYPAL ATTEMPT STORAGE
========================================================= */

function getPayPalAttemptKey() {
  const user = JSON.parse(
    localStorage.getItem("customerUser") || "null"
  );

  if (!user?.id) {
    throw new Error("Please log in again.");
  }

  return `jcnPendingPayPal_${user.id}`;
}


/* =========================================================
   15. REDIRECT TO MY ORDERS
========================================================= */

function goToOrders() {
  checkoutNavigating = true;

  setCheckoutLoading(
    true,
    "Opening My Orders..."
  );

  window.location.replace(
    "customer-orders.html"
  );
}


/* =========================================================
   16. CHECKOUT ITEM SIGNATURE

   Compare actual products, sizes, colors and quantities.
   Do not compare only the total price.
========================================================= */

function checkoutItemSignature(items) {
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const counts = new Map();

  for (const item of items) {
    const id = item?.product_id || item?.id;

    const size = String(item?.size || "")
      .trim()
      .toLowerCase();

    const color = String(item?.color || "")
      .trim()
      .toLowerCase();

    const qty = Number(
      item?.quantity ?? item?.qty ?? 1
    );

    if (
      !id ||
      !size ||
      !Number.isSafeInteger(qty) ||
      qty < 1
    ) {
      return null;
    }

    const key = JSON.stringify([
      String(id),
      size,
      color
    ]);

    counts.set(
      key,
      (counts.get(key) || 0) + qty
    );
  }

  return JSON.stringify(
    [...counts.entries()].sort(
      ([a], [b]) => a.localeCompare(b)
    )
  );
}


/* =========================================================
   17. CHECK EXISTING PAYPAL PAYMENT ATTEMPT

   FIX:
   Allow separate new purchases even when earlier
   PayPal orders are still pending.
========================================================= */

async function checkExistingPayPalAttempt(token, key) {
  const user = JSON.parse(
    localStorage.getItem("customerUser") || "null"
  );

  if (!user?.id || !token) {
    throw new Error("Please log in again.");
  }

  const saved = JSON.parse(
    localStorage.getItem(key) || "null"
  );

  const response = await fetch(
    `${API_URL}/api/customer/orders/${encodeURIComponent(user.id)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },

      cache: "no-store"
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    !data.success ||
    !Array.isArray(data.orders)
  ) {
    throw new Error(
      "Unable to verify previous orders. Please check My Orders."
    );
  }

  const orders = data.orders.filter(order =>
    String(order.user_id) === String(user.id)
  );


  // CHECK SAVED PAYMENT REFERENCE

  const previous = saved?.orderId
    ? orders.find(order =>
        String(order.id) === String(saved.orderId)
      )
    : null;

  if (saved?.orderId && !previous) {
    throw new Error(
      "Previous payment reference could not be verified. " +
      "Contact JCN support."
    );
  }


  // CLEAR PREVIOUS VERIFIED PAYMENT REFERENCE

  if (
    previous &&
    String(previous.payment_status)
      .trim()
      .toLowerCase() === "paid" &&
    previous.paypal_capture_id
  ) {
    localStorage.removeItem(key);
  }


  // FIND UNRESOLVED PAYPAL ORDERS

  const unresolved = orders.filter(order => {
    const method = String(order.payment_method || "")
      .trim()
      .toLowerCase();

    const status = String(order.status || "")
      .trim()
      .toLowerCase();

    const payment = String(order.payment_status || "")
      .trim()
      .toLowerCase();

    if (method !== "paypal") {
      return false;
    }

    if (
      payment === "paid" &&
      order.paypal_capture_id &&
      !["cancelled", "canceled"].includes(status)
    ) {
      return false;
    }

    if (
      ["cancelled", "canceled"].includes(status) &&
      !order.paypal_order_id &&
      !order.paypal_capture_id
    ) {
      return false;
    }

    return true;
  });


  // NO PREVIOUS UNRESOLVED PAYMENT

  if (!unresolved.length) {
    return false;
  }


  // IDENTIFY CURRENT CHECKOUT PRODUCTS

  const signature = checkoutItemSignature(cart);

  if (!signature) {
    throw new Error(
      "Unable to identify checkout items. Please review your cart."
    );
  }


  // CHECK POSSIBLE DUPLICATE PURCHASE

  const matching = unresolved.find(order => {
    const other = checkoutItemSignature(
      order.inventory_items
    );

    return !other || other === signature;
  });


  // MATCHING OR INCOMPLETE PREVIOUS ORDER

  if (matching) {
    const result = await Swal.fire({
      icon: "warning",

      title: "Review Existing PayPal Order",

      text:
        "A previous PayPal order matches these items " +
        "or has incomplete item details. " +
        "Review it before paying again.",

      showCancelButton: true,

      confirmButtonText: "View My Orders",

      cancelButtonText: "Stay in Checkout",

      customClass: {
        popup: "jcn-popup",
        confirmButton: "jcn-confirm-btn",
        cancelButton: "jcn-cancel-btn"
      },

      buttonsStyling: false
    });

    if (result.isConfirmed) {
      goToOrders();
    }

    return true;
  }


  // ALLOW A SEPARATE NEW PURCHASE

  const result = await Swal.fire({
    icon: "info",

    title: "Separate New Order",

    text:
      "You have earlier PayPal orders with different items. " +
      "Continue only if this is a separate new purchase. " +
      "Earlier payments remain subject to verification.",

    showCancelButton: true,
    showDenyButton: true,

    confirmButtonText: "Continue New Order",

    denyButtonText: "View My Orders",

    cancelButtonText: "Cancel",

    customClass: {
      popup: "jcn-popup",
      confirmButton: "jcn-confirm-btn",
      denyButton: "jcn-cancel-btn",
      cancelButton: "jcn-cancel-btn"
    },

    buttonsStyling: false
  });

  if (result.isDenied) {
    goToOrders();
  }

  return !result.isConfirmed;
}


/* =========================================================
   18. LIVE PAYPAL ORDER CREATION
========================================================= */

async function createPayPalOrder() {
  let systemOrderId = null;

  try {

    // VERIFY CUSTOMER AUTHENTICATION

    const customerToken =
      localStorage.getItem("customerToken");

    if (!customerToken) {
      throw new Error(
        "Your session has expired. Please log in again."
      );
    }

    const expectedSignature =
      checkoutItemSignature(cart);


    // CHECK EXISTING PAYPAL ORDERS

    const attemptKey = getPayPalAttemptKey();

    if (
      await checkExistingPayPalAttempt(
        customerToken,
        attemptKey
      )
    ) {
      return;
    }


    // CONFIRM PAYPAL PAYMENT

    const result = await Swal.fire({
      title: "PayPal Payment",

      text:
        "Continue to PayPal to complete your payment.",

      icon: "info",

      showCancelButton: true,

      confirmButtonText: "Continue to PayPal",

      cancelButtonText: "Cancel",

      customClass: {
        popup: "jcn-popup",
        title: "jcn-title",
        confirmButton: "jcn-confirm-btn",
        cancelButton: "jcn-cancel-btn"
      },

      buttonsStyling: false
    });

    if (!result.isConfirmed) {
      return;
    }

    setCheckoutLoading(
      true,
      "Connecting to PayPal..."
    );


    // CREATE SYSTEM ORDER IN SUPABASE

    const orderData = await createSystemOrder(
      "PayPal",
      expectedSignature
    );

    if (!orderData) {
      return;
    }

    systemOrderId =
      orderData.order?.id ||
      orderData.order_id ||
      orderData.id;

    const orderNumber =
      orderData.order?.order_number ||
      orderData.order_number ||
      orderData.orderNumber;

    if (!systemOrderId) {
      throw new Error(
        "Order ID missing. Check My Orders before trying again."
      );
    }


    // PRESERVE PREVIOUS PAYMENT REFERENCES

    const previousAttempt = JSON.parse(
      localStorage.getItem(attemptKey) || "null"
    );

    if (
      previousAttempt?.orderId &&
      String(previousAttempt.orderId) !==
        String(systemOrderId)
    ) {
      localStorage.setItem(
        `${attemptKey}_${previousAttempt.orderId}`,
        JSON.stringify(previousAttempt)
      );
    }


    // SAVE CURRENT SYSTEM ORDER

    const attempt = {
      orderId: String(systemOrderId),
      orderNumber: orderNumber || null
    };

    localStorage.setItem(
      attemptKey,
      JSON.stringify(attempt)
    );

    localStorage.setItem(
      "lastOrderId",
      String(systemOrderId)
    );

    if (orderNumber) {
      localStorage.setItem(
        "lastOrderNumber",
        orderNumber
      );
    }


    /* =====================================================
       CREATE AUTHORIZED PAYPAL REDIRECT ORDER
    ===================================================== */

    const response = await fetch(
      `${API_URL}/api/paypal/create-redirect-order`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "Authorization": `Bearer ${customerToken}`
        },

        body: JSON.stringify({
          system_order_id: systemOrderId
        })
      }
    );


    // READ SERVER RESPONSE

    const data = await response
      .json()
      .catch(() => null);

    console.log("PAYPAL CREATE RESPONSE:", {
      success: data?.success,
      status: response.status,
      message: data?.message
    });


    // CHECK CUSTOMER AUTHENTICATION

    if (response.status === 401) {
      throw new Error(
        "Your session is invalid or expired. " +
        "Please log in again."
      );
    }


    // CHECK PAYPAL RESPONSE

    if (
      !response.ok ||
      !data?.success ||
      !data.approve_url
    ) {
      throw new Error(
        data?.message ||
        "Unable to create PayPal payment."
      );
    }


    // VALIDATE LIVE PAYPAL URL

    const url = new URL(data.approve_url);

    if (
      url.protocol !== "https:" ||
      ![
        "www.paypal.com",
        "paypal.com"
      ].includes(url.hostname) ||
      url.username ||
      url.password
    ) {
      throw new Error(
        "Invalid live PayPal approval URL."
      );
    }


    // SAVE PAYPAL ORDER ID

    if (data.paypal_order_id) {
      attempt.paypalOrderId =
        data.paypal_order_id;

      localStorage.setItem(
        attemptKey,
        JSON.stringify(attempt)
      );

      localStorage.setItem(
        "paypalOrderId",
        data.paypal_order_id
      );
    }


    /* =====================================================
       REDIRECT CUSTOMER TO PAYPAL

       Server handles payment capture.
    ===================================================== */

    checkoutNavigating = true;

    window.location.assign(url.href);


  } catch (error) {
    console.error("PAYPAL ERROR:", error.message);

    const message =
      error.message || "Unable to connect to PayPal.";

    await showAlert(
      "error",
      "PayPal Error",

      message +
      (
        systemOrderId
          ? " Your order already exists. " +
            "Check My Orders before paying again."
          : ""
      )
    );

    if (systemOrderId) {
      goToOrders();
    }

  } finally {
    if (!checkoutNavigating) {
      setCheckoutLoading(false);
    }
  }
}


/* =========================================================
   19. CREATE SYSTEM ORDER

   SUPPORTS PAYPAL AND CASH ON DELIVERY
========================================================= */

async function createSystemOrder(
  paymentMethod,
  expectedSignature = null
) {

  // RETRIEVE CHECKOUT ITEMS

  cart =
    JSON.parse(localStorage.getItem("checkoutItems")) ||
    JSON.parse(localStorage.getItem("customerCart")) ||
    [];


  // VALIDATE CHECKOUT ITEMS

  if (!cart.length) {
    await showAlert(
      "warning",
      "No Products",
      "Your checkout is empty."
    );

    return null;
  }


  // PREVENT CHANGED ITEMS AFTER CONFIRMATION

  if (
    paymentMethod === "PayPal" &&
    (
      !expectedSignature ||
      checkoutItemSignature(cart) !== expectedSignature
    )
  ) {
    await showAlert(
      "warning",
      "Checkout Changed",
      "Your checkout items have changed. Please review them again."
    );

    loadOrderSummary();

    return null;
  }


  // VALIDATE CUSTOMER ACCOUNT

  const rawUser =
    localStorage.getItem("customerUser");

  const customerToken =
    localStorage.getItem("customerToken");

  if (!rawUser || !customerToken) {
    await showAlert(
      "warning",
      "Login Required",
      "Please login again."
    );

    return null;
  }

  const user = JSON.parse(rawUser);


  // GET CUSTOMER INFORMATION

  const fullNameInput =
    document.getElementById("fullName") ||
    document.getElementById("fullname");

  const customerName =
    fullNameInput?.value?.trim() ||
    user.full_name ||
    user.fullname ||
    user.username ||
    "";

  const customerEmail =
    document.getElementById("email")
      ?.value?.trim() ||
    user.email ||
    "";

  const customerPhone =
    document.getElementById("phone")
      ?.value?.trim() ||
    user.phone ||
    "";

  const shippingAddress =
    document.getElementById("address")
      ?.value?.trim() ||
    user.address ||
    "";


  // VALIDATE CUSTOMER NAME

  if (!customerName) {
    await showAlert(
      "warning",
      "Missing Name",
      "Please enter your full name."
    );

    return null;
  }


  // VALIDATE CUSTOMER EMAIL

  if (!customerEmail) {
    await showAlert(
      "warning",
      "Missing Email",
      "Please enter your email address."
    );

    return null;
  }


  // VALIDATE CUSTOMER PHONE

  if (!customerPhone) {
    await showAlert(
      "warning",
      "Missing Phone",
      "Please enter your phone number."
    );

    return null;
  }


  // VALIDATE SHIPPING ADDRESS

  if (!shippingAddress) {
    await showAlert(
      "warning",
      "Missing Address",
      "Please enter your shipping address."
    );

    return null;
  }


  // VALIDATE CUSTOMER ID

  if (!user.id) {
    await showAlert(
      "error",
      "Account Error",
      "Customer ID is missing. Please logout and login again."
    );

    return null;
  }


  // VALIDATE TOTAL AMOUNT

  const totalAmount = updateTotals();

  if (
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0
  ) {
    await showAlert(
      "error",
      "Invalid Total",
      "The order total is invalid."
    );

    return null;
  }


  // GENERATE ORDER NUMBER

  const orderNumber = generateOrderNumber();


  /* =====================================================
     PREPARE ORDER REQUEST
  ===================================================== */

  const requestBody = {
    user_id: user.id,

    order_number: orderNumber,

    customer_name: customerName,

    customer_email: customerEmail,

    customer_phone: customerPhone,

    shipping_address: shippingAddress,

    total_amount: totalAmount,

    payment_method: paymentMethod,

    payment_status:
      paymentMethod === "PayPal"
        ? "Unpaid"
        : "Pending",

    status:
      paymentMethod === "PayPal"
        ? "Pending Payment"
        : "Preparing",

    items: cart
  };


  /* =====================================================
     SEND ORDER TO SERVER
  ===================================================== */

  try {
    const response = await fetch(
      `${API_URL}/api/orders`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "Authorization": `Bearer ${customerToken}`
        },

        body: JSON.stringify(requestBody)
      }
    );

    let data;

    try {
      data = await response.json();

    } catch {
      throw new Error(
        "Server returned an invalid response."
      );
    }


    // HANDLE SERVER ERROR

    if (!response.ok) {
      throw new Error(
        data.message ||
        `Request failed (${response.status})`
      );
    }


    // VALIDATE ORDER CREATION

    if (!data.success) {
      throw new Error(
        data.message ||
        "Order could not be created."
      );
    }


    // RETURN CREATED ORDER

    return {
      ...data,

      order_number:
        data.order?.order_number ||
        data.order_number ||
        orderNumber
    };

  } catch (error) {
    console.error(
      "CREATE ORDER ERROR:",
      error.message
    );

    await showAlert(
      "error",
      "Order Failed",
      error.message || "Cannot connect to the server."
    );

    return null;
  }
}


/* =========================================================
   20. PAYPAL RETURN HANDLING

   Payment capture is handled by server.js.
   Do not capture the transaction again from checkout.
========================================================= */

async function handlePayPalReturn() {
  const params = new URLSearchParams(
    window.location.search
  );

  const payment = params.get("payment");

  const paypal = params.get("paypal");

  if (!payment && !paypal) {
    return false;
  }


  // PAYMENT CANCELLED

  if (
    payment === "cancelled" ||
    paypal === "cancelled"
  ) {
    await showAlert(
      "info",
      "Payment Cancelled",

      "You returned from PayPal. Check your existing " +
      "order before starting another payment."
    );


  // PAYMENT SUCCESS RETURN

  } else if (payment === "success") {
    await showAlert(
      "info",
      "Payment Returned",

      "Open My Orders to check your verified payment status."
    );


  // PAYMENT FAILED OR REQUIRES REVIEW

  } else {
    await showAlert(
      "warning",
      "Payment Needs Review",

      "Check My Orders and your PayPal activity. " +
      "Do not pay again until the previous transaction is verified."
    );
  }


  // OPEN CUSTOMER ORDERS

  goToOrders();

  return true;
}


/* =========================================================
   21. REMOVE PURCHASED ITEMS FROM CART

   Used after successful COD order creation.
   PayPal cleanup requires verified payment status.
========================================================= */

function removeCheckedOutItemsFromCart() {
  const customerCart =
    JSON.parse(localStorage.getItem("customerCart")) ||
    [];

  const purchasedKeys = cart.map(item =>
    item.cartKey ||
    `${item.product_id || item.id}-${item.size}-${item.color}`
  );

  const remainingCart = customerCart.filter(item => {
    const key =
      item.cartKey ||
      `${item.product_id || item.id}-${item.size}-${item.color}`;

    return !purchasedKeys.includes(key);
  });

  localStorage.setItem(
    "customerCart",
    JSON.stringify(remainingCart)
  );
}


/* =========================================================
   22. CHECKOUT BUTTON LOADING
========================================================= */

function setCheckoutLoading(
  loading,
  text = "Please wait..."
) {
  const button =
    document.querySelector(".confirm-btn");

  if (!button) return;

  if (loading || checkoutNavigating) {
    button.dataset.originalText =
      button.textContent;

    button.disabled = true;

    button.textContent = text;

  } else {
    button.disabled = false;

    const paymentMethod =
      document.getElementById("paymentMethod")?.value;

    button.textContent =
      paymentMethod === "PayPal"
        ? "Pay with PayPal"
        : "Confirm Order";
  }
}


/* =========================================================
   23. MY ORDERS BUTTON
========================================================= */

function setupOrderButton() {
  const button =
    document.getElementById("goOrdersBtn");

  if (!button) return;

  button.addEventListener("click", () => {
    window.location.href =
      "customer-orders.html";
  });
}


/* =========================================================
   24. CUSTOMER LOGOUT
========================================================= */

function setupLogoutButton() {
  const logoutBtn =
    document.getElementById("logoutBtn");

  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async event => {
    event.preventDefault();

    if (checkoutSubmitting || checkoutNavigating) {
      return;
    }

    const result = await Swal.fire({
      title: "Logout?",

      text:
        "Are you sure you want to logout?",

      icon: "question",

      showCancelButton: true,

      confirmButtonText: "Logout",

      cancelButtonText: "Cancel",

      customClass: {
        popup: "jcn-popup",
        confirmButton: "jcn-confirm-btn",
        cancelButton: "jcn-cancel-btn"
      },

      buttonsStyling: false
    });

    if (!result.isConfirmed) {
      return;
    }


    // CLEAR CUSTOMER SESSION ONLY

    localStorage.removeItem("customerToken");

    localStorage.removeItem("customerUser");


    // KEEP THEME AND PAYMENT REFERENCES

    window.location.href =
      "user-login.html";
  });
}


/* =========================================================
   25. HTML SECURITY
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   26. CUSTOMER CHECKOUT MOBILE SIDEBAR
========================================================= */

function initializeCheckoutMobileSidebar() {
  const sidebar =
    document.querySelector(".sidebar");

  const main =
    document.querySelector(".main");

  if (!sidebar || !main) {
    console.warn(
      "Checkout mobile sidebar: .sidebar or .main is missing."
    );

    return;
  }


  // PREVENT DUPLICATE INITIALIZATION

  if (
    sidebar.dataset.checkoutMenuInitialized === "true"
  ) {
    return;
  }

  sidebar.dataset.checkoutMenuInitialized = "true";


  // CREATE MOBILE TOP BAR

  let mobileBar = document.querySelector(
    ".jcn-checkout-mobile-bar"
  );

  if (!mobileBar) {
    mobileBar = document.createElement("div");

    mobileBar.className =
      "jcn-checkout-mobile-bar";

    main.prepend(mobileBar);
  }


  // CREATE MOBILE MENU BUTTON

  let menuBtn = mobileBar.querySelector(
    ".jcn-checkout-menu-toggle"
  );

  if (!menuBtn) {
    menuBtn = document.createElement("button");

    menuBtn.type = "button";

    menuBtn.className =
      "jcn-checkout-menu-toggle";

    menuBtn.innerHTML = `
      <i
        class="fa-solid fa-bars"
        aria-hidden="true">
      </i>
    `;

    mobileBar.prepend(menuBtn);
  }


  // MOBILE JCN LOGO

  if (
    !mobileBar.querySelector(
      ".jcn-checkout-mobile-logo"
    )
  ) {
    const logo = document.createElement("span");

    logo.className =
      "jcn-checkout-mobile-logo";

    logo.textContent = "J";

    mobileBar.appendChild(logo);
  }


  // MOBILE BRAND NAME

  if (
    !mobileBar.querySelector(
      ".jcn-checkout-mobile-name"
    )
  ) {
    const name = document.createElement("span");

    name.className =
      "jcn-checkout-mobile-name";

    name.textContent = "JCN Apparel";

    mobileBar.appendChild(name);
  }


  // MOBILE ACCESSIBILITY

  if (!sidebar.id) {
    sidebar.id = "jcnCheckoutSidebar";
  }

  menuBtn.setAttribute(
    "aria-controls",
    sidebar.id
  );

  menuBtn.setAttribute(
    "aria-expanded",
    "false"
  );

  menuBtn.setAttribute(
    "aria-label",
    "Open navigation menu"
  );


  // SIDEBAR CLOSE BUTTON

  let closeBtn = sidebar.querySelector(
    ".jcn-checkout-sidebar-close"
  );

  if (!closeBtn) {
    closeBtn = document.createElement("button");

    closeBtn.type = "button";

    closeBtn.className =
      "jcn-checkout-sidebar-close";

    closeBtn.setAttribute(
      "aria-label",
      "Close navigation menu"
    );

    closeBtn.innerHTML = "&times;";

    sidebar.prepend(closeBtn);
  }


  // MOBILE MENU OVERLAY

  let overlay = document.querySelector(
    ".jcn-checkout-menu-overlay"
  );

  if (!overlay) {
    overlay = document.createElement("div");

    overlay.className =
      "jcn-checkout-menu-overlay";

    document.body.appendChild(overlay);
  }

  overlay.setAttribute(
    "aria-hidden",
    "true"
  );


  // CLOSE SIDEBAR

  function closeSidebar(restoreFocus = false) {
    const wasOpen =
      document.body.classList.contains(
        "jcn-checkout-menu-open"
      );

    document.body.classList.remove(
      "jcn-checkout-menu-open"
    );

    menuBtn.setAttribute(
      "aria-expanded",
      "false"
    );

    menuBtn.setAttribute(
      "aria-label",
      "Open navigation menu"
    );

    if (
      restoreFocus &&
      wasOpen &&
      window.innerWidth <= 800
    ) {
      menuBtn.focus();
    }
  }


  // OPEN SIDEBAR

  function openSidebar() {
    if (window.innerWidth > 800) {
      return;
    }

    document.body.classList.add(
      "jcn-checkout-menu-open"
    );

    menuBtn.setAttribute(
      "aria-expanded",
      "true"
    );

    menuBtn.setAttribute(
      "aria-label",
      "Close navigation menu"
    );

    closeBtn.focus();
  }


  // MOBILE MENU TOGGLE

  menuBtn.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    if (
      document.body.classList.contains(
        "jcn-checkout-menu-open"
      )
    ) {
      closeSidebar();

    } else {
      openSidebar();
    }
  });


  // CLOSE BUTTON EVENT

  closeBtn.addEventListener(
    "click",
    () => closeSidebar(true)
  );


  // OVERLAY EVENT

  overlay.addEventListener(
    "click",
    () => closeSidebar()
  );


  // CLOSE WHEN SELECTING MENU LINK

  sidebar.querySelectorAll(".menu a")
    .forEach(link => {
      link.addEventListener(
        "click",
        () => closeSidebar()
      );
    });


  // ESCAPE KEY SUPPORT

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      document.body.classList.contains(
        "jcn-checkout-menu-open"
      )
    ) {
      closeSidebar(true);
    }
  });


  // WINDOW RESIZE SUPPORT

  window.addEventListener("resize", () => {
    if (window.innerWidth > 800) {
      closeSidebar();
    }
  });
}