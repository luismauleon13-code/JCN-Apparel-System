const API_URL = "http://localhost:5000";
const DELIVERY_FEE = 80;

let cart =
  JSON.parse(localStorage.getItem("checkoutItems")) ||
  JSON.parse(localStorage.getItem("customerCart")) ||
  [];


/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  console.log("CHECKOUT JS LOADED");

  const loggedIn = await checkLogin();

  if (!loggedIn) return;

  fillCustomerInfo();
  loadOrderSummary();
  setupPaymentMethod();
  setupCheckoutForm();
  setupLogoutButton();
  setupOrderButton();

  await handlePayPalReturn();
});


/* =========================================================
   ALERT
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
   LOGIN CHECK
========================================================= */

async function checkLogin() {
  const token =
    localStorage.getItem("customerToken");

  const rawUser =
    localStorage.getItem("customerUser");

  if (!token || !rawUser) {
    await showAlert(
      "warning",
      "Login Required",
      "Please login first."
    );

    window.location.href =
      "user-login.html";

    return false;
  }


  /*
    Don't block PayPal return page.
  */

  const params =
    new URLSearchParams(
      window.location.search
    );

  const payment =
    params.get("payment");


  if (
    !cart.length &&
    payment !== "success" &&
    payment !== "cancelled"
  ) {
    await showAlert(
      "warning",
      "No Checkout Items",
      "Please select a product first."
    );

    window.location.href =
      "customer-shop.html";

    return false;
  }

  return true;
}


/* =========================================================
   CUSTOMER INFORMATION
========================================================= */

function fillCustomerInfo() {
  const user =
    JSON.parse(
      localStorage.getItem(
        "customerUser"
      )
    ) || {};


  const fullNameInput =
    document.getElementById(
      "fullName"
    ) ||
    document.getElementById(
      "fullname"
    );


  const emailInput =
    document.getElementById(
      "email"
    );

  const phoneInput =
    document.getElementById(
      "phone"
    );

  const addressInput =
    document.getElementById(
      "address"
    );


  if (fullNameInput) {
    fullNameInput.value =
      user.full_name ||
      user.fullname ||
      user.fullName ||
      user.username ||
      "";
  }


  if (emailInput) {
    emailInput.value =
      user.email || "";
  }


  if (phoneInput) {
    phoneInput.value =
      user.phone || "";
  }


  if (addressInput) {
    addressInput.value =
      user.address || "";
  }
}


/* =========================================================
   ORDER SUMMARY
========================================================= */

function loadOrderSummary() {
  const orderItems =
    document.getElementById(
      "orderItems"
    );

  if (!orderItems) {
    console.warn(
      "#orderItems not found"
    );

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
    const quantity =
      Number(
        item.quantity || 1
      );


    const price =
      getItemPrice(item);


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
            Size:
            ${escapeHtml(
              item.size || "N/A"
            )}

            &nbsp; | &nbsp;

            Color:
            ${escapeHtml(
              item.color || "N/A"
            )}

            &nbsp; | &nbsp;

            Qty:
            ${quantity}
          </p>

        </div>

        <div class="order-item-price">
          ₱${(
            price * quantity
          ).toFixed(2)}
        </div>

      </div>
    `;
  });


  updateTotals();
}


/* =========================================================
   PRICE
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
   TOTAL
========================================================= */

function calculateSubtotal() {
  return cart.reduce(
    (total, item) => {

      const price =
        getItemPrice(item);

      const quantity =
        Number(
          item.quantity || 1
        );


      return (
        total +
        price * quantity
      );

    },

    0
  );
}


function updateTotals() {
  const subtotal =
    calculateSubtotal();


  const deliveryFee =
    cart.length
      ? DELIVERY_FEE
      : 0;


  const grandTotal =
    subtotal +
    deliveryFee;


  const subtotalElement =
    document.getElementById(
      "subtotal"
    );

  const deliveryElement =
    document.getElementById(
      "deliveryFee"
    );

  const grandTotalElement =
    document.getElementById(
      "grandTotal"
    );


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
   ORDER NUMBER
========================================================= */

function generateOrderNumber() {
  const date =
    new Date();


  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");


  const day =
    String(
      date.getDate()
    ).padStart(2, "0");


  const random =
    Math.floor(
      100000 +
      Math.random() * 900000
    );


  return (
    `JCN-${year}${month}${day}-${random}`
  );
}


/* =========================================================
   PAYMENT METHOD
========================================================= */

function setupPaymentMethod() {
  const paymentCards =
    document.querySelectorAll(
      ".payment-card"
    );


  const paymentInput =
    document.getElementById(
      "paymentMethod"
    );


  const confirmBtn =
    document.querySelector(
      ".confirm-btn"
    );


  if (!paymentInput) {
    console.error(
      "paymentMethod input not found"
    );

    return;
  }


  /*
    Default COD
  */

  if (!paymentInput.value) {
    paymentInput.value =
      "COD";
  }


  paymentCards.forEach(card => {

    card.addEventListener(
      "click",
      () => {

        paymentCards.forEach(
          current => {
            current.classList.remove(
              "active"
            );
          }
        );


        card.classList.add(
          "active"
        );


        const method =
          card.dataset.method;


        console.log(
          "PAYMENT SELECTED:",
          method
        );


        paymentInput.value =
          method;


        if (!confirmBtn) {
          return;
        }


        if (
          method === "PayPal"
        ) {
          confirmBtn.textContent =
            "Pay with PayPal";
        } else {
          confirmBtn.textContent =
            "Confirm Order";
        }

      }
    );
  });
}


/* =========================================================
   CHECKOUT FORM
========================================================= */

function setupCheckoutForm() {
  const checkoutForm =
    document.getElementById(
      "checkoutForm"
    );


  if (!checkoutForm) {
    console.error(
      "ERROR: checkoutForm not found."
    );

    return;
  }


  console.log(
    "Checkout form connected."
  );


  checkoutForm.addEventListener(
    "submit",
    confirmOrder
  );
}


/* =========================================================
   CONFIRM ORDER
========================================================= */

async function confirmOrder(event) {
  event.preventDefault();


  console.log(
    "CONFIRM ORDER CLICKED"
  );


  const paymentMethod =
    document.getElementById(
      "paymentMethod"
    )?.value || "COD";


  console.log(
    "METHOD:",
    paymentMethod
  );


  if (
    paymentMethod === "PayPal"
  ) {
    await createPayPalOrder();

    return;
  }


  await createCODOrder();
}


/* =========================================================
   COD
========================================================= */

async function createCODOrder() {
  const result =
    await Swal.fire({

      title:
        "Confirm Order",

      text:
        "Do you want to place this Cash on Delivery order?",

      icon:
        "question",

      showCancelButton:
        true,

      confirmButtonText:
        "Place Order",

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


  setCheckoutLoading(
    true,
    "Creating Order..."
  );


  try {

    const data =
      await createSystemOrder(
        "COD"
      );


    if (!data) {
      return;
    }


    removeCheckedOutItemsFromCart();


    localStorage.removeItem(
      "checkoutItems"
    );


    const orderNumber =
      data.order?.order_number ||
      data.order_number ||
      data.orderNumber ||
      "N/A";


    await Swal.fire({

      icon:
        "success",

      title:
        "Order Confirmed!",

      html: `
        <p>
          Your COD order has been placed.
        </p>

        <p>
          Order Number:
        </p>

        <strong style="
          color:#d4af37;
          font-size:22px;
        ">
          ${escapeHtml(
            orderNumber
          )}
        </strong>
      `,

      confirmButtonText:
        "View My Orders",

      customClass: {
        popup:
          "jcn-popup",

        title:
          "jcn-success-title",

        confirmButton:
          "jcn-confirm-btn"
      },

      buttonsStyling:
        false
    });


    window.location.href =
      "customer-orders.html";


  } catch (error) {

    console.error(
      "COD ERROR:",
      error
    );


    await showAlert(
      "error",
      "Order Failed",
      error.message ||
      "Unable to create COD order."
    );

  } finally {

    setCheckoutLoading(
      false
    );
  }
}


/* =========================================================
   PAYPAL
========================================================= */

async function createPayPalOrder() {
  const result =
    await Swal.fire({

      title:
        "PayPal Payment",

      text:
        "Continue to PayPal to complete your payment.",

      icon:
        "info",

      showCancelButton:
        true,

      confirmButtonText:
        "Continue to PayPal",

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


  setCheckoutLoading(
    true,
    "Connecting to PayPal..."
  );


  try {

    /*
      First create JCN/Supabase order
    */

    const orderData =
      await createSystemOrder(
        "PayPal"
      );


    if (!orderData) {
      return;
    }


    const systemOrderId =
      orderData.order?.id ||
      orderData.order_id ||
      orderData.id;


    const orderNumber =
      orderData.order?.order_number ||
      orderData.order_number ||
      orderData.orderNumber;


    if (!systemOrderId) {

      console.error(
        "INVALID ORDER RESPONSE:",
        orderData
      );


      throw new Error(
        "Order ID was not returned by server."
      );
    }


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


    /*
      Then create PayPal order.
    */

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
                systemOrderId

            })
        }
      );


    let data;


    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        "Invalid response from PayPal server."
      );
    }


    console.log(
      "PAYPAL CREATE RESPONSE:",
      data
    );


    if (!response.ok) {
      throw new Error(
        data.message ||
        `Server returned ${response.status}`
      );
    }


    if (
      !data.success ||
      !data.approve_url
    ) {
      throw new Error(
        data.message ||
        "PayPal approval URL was not returned."
      );
    }


    if (
      data.paypal_order_id
    ) {
      localStorage.setItem(
        "paypalOrderId",
        data.paypal_order_id
      );
    }


    /*
      Redirect to PayPal
    */

    window.location.href =
      data.approve_url;


  } catch (error) {

    console.error(
      "PAYPAL ERROR:",
      error
    );


    await showAlert(
      "error",
      "PayPal Error",
      error.message ||
      "Unable to connect to PayPal."
    );

  } finally {

    setCheckoutLoading(
      false
    );
  }
}


/* =========================================================
   CREATE SYSTEM ORDER
========================================================= */

async function createSystemOrder(
  paymentMethod
) {

  cart =
    JSON.parse(
      localStorage.getItem(
        "checkoutItems"
      )
    ) ||

    JSON.parse(
      localStorage.getItem(
        "customerCart"
      )
    ) ||

    [];


  if (!cart.length) {

    await showAlert(
      "warning",
      "No Products",
      "Your checkout is empty."
    );

    return null;
  }


  const rawUser =
    localStorage.getItem(
      "customerUser"
    );


  if (!rawUser) {

    await showAlert(
      "warning",
      "Login Required",
      "Please login again."
    );

    return null;
  }


  const user =
    JSON.parse(rawUser);


  const fullNameInput =
    document.getElementById(
      "fullName"
    ) ||
    document.getElementById(
      "fullname"
    );


  const customerName =
    fullNameInput?.value?.trim() ||
    user.full_name ||
    user.fullname ||
    user.username ||
    "";


  const customerEmail =
    document
      .getElementById(
        "email"
      )
      ?.value
      ?.trim() ||
    user.email ||
    "";


  const customerPhone =
    document
      .getElementById(
        "phone"
      )
      ?.value
      ?.trim() ||
    user.phone ||
    "";


  const shippingAddress =
    document
      .getElementById(
        "address"
      )
      ?.value
      ?.trim() ||
    user.address ||
    "";


  if (!customerName) {

    await showAlert(
      "warning",
      "Missing Name",
      "Please enter your full name."
    );

    return null;
  }


  if (!customerEmail) {

    await showAlert(
      "warning",
      "Missing Email",
      "Please enter your email address."
    );

    return null;
  }


  if (!customerPhone) {

    await showAlert(
      "warning",
      "Missing Phone",
      "Please enter your phone number."
    );

    return null;
  }


  if (!shippingAddress) {

    await showAlert(
      "warning",
      "Missing Address",
      "Please enter your shipping address."
    );

    return null;
  }


  if (!user.id) {

    console.error(
      "CUSTOMER USER:",
      user
    );


    await showAlert(
      "error",
      "Account Error",
      "Customer ID is missing. Please logout and login again."
    );

    return null;
  }


  const totalAmount =
    updateTotals();


  if (
    !Number.isFinite(
      totalAmount
    ) ||
    totalAmount <= 0
  ) {

    await showAlert(
      "error",
      "Invalid Total",
      "The order total is invalid."
    );

    return null;
  }


  const orderNumber =
    generateOrderNumber();


  const requestBody = {

    user_id:
      user.id,

    order_number:
      orderNumber,

    customer_name:
      customerName,

    customer_email:
      customerEmail,

    customer_phone:
      customerPhone,

    shipping_address:
      shippingAddress,

    total_amount:
      totalAmount,

    payment_method:
      paymentMethod,

    payment_status:
      paymentMethod === "PayPal"
        ? "Unpaid"
        : "Pending",

    status:
      paymentMethod === "PayPal"
        ? "Pending Payment"
        : "Preparing",

    items:
      cart
  };


  console.log(
    "ORDER REQUEST:",
    requestBody
  );


  try {

    const response =
      await fetch(
        `${API_URL}/api/orders`,
        {

          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${
                localStorage.getItem(
                  "customerToken"
                ) || ""
              }`
          },

          body:
            JSON.stringify(
              requestBody
            )
        }
      );


    let data;


    try {

      data =
        await response.json();

    } catch {

      const text =
        await response.text();

      console.error(
        "SERVER RESPONSE:",
        text
      );


      throw new Error(
        "Server returned an invalid response."
      );
    }


    console.log(
      "ORDER RESPONSE:",
      data
    );


    if (!response.ok) {

      throw new Error(
        data.message ||
        `Request failed (${response.status})`
      );
    }


    if (!data.success) {

      throw new Error(
        data.message ||
        "Order could not be created."
      );
    }


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
      error
    );


    await showAlert(
      "error",
      "Order Failed",
      error.message ||
      "Cannot connect to the server."
    );


    return null;
  }
}


/* =========================================================
   PAYPAL RETURN / CAPTURE
========================================================= */

async function handlePayPalReturn() {
  const params =
    new URLSearchParams(
      window.location.search
    );


  const payment =
    params.get("payment");


  /*
    Customer cancelled PayPal
  */

  if (
    payment === "cancelled"
  ) {

    await showAlert(
      "info",
      "Payment Cancelled",
      "Your PayPal payment was cancelled."
    );


    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );


    return;
  }


  if (
    payment !== "success"
  ) {
    return;
  }


  /*
    PayPal normally returns PayPal order
    ID as token.
  */

  const paypalOrderId =
    params.get("token") ||
    localStorage.getItem(
      "paypalOrderId"
    );


  const systemOrderId =
    params.get(
      "system_order_id"
    ) ||
    localStorage.getItem(
      "lastOrderId"
    );


  console.log(
    "PAYPAL RETURN:",
    {
      paypalOrderId,
      systemOrderId
    }
  );


  if (
    !paypalOrderId ||
    !systemOrderId
  ) {

    await showAlert(
      "error",
      "Payment Error",
      "Payment information is incomplete."
    );

    return;
  }


  try {

    Swal.fire({

      title:
        "Confirming Payment",

      text:
        "Please wait while we confirm your PayPal payment.",

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
        `${API_URL}/api/paypal/capture-order`,
        {

          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              paypal_order_id:
                paypalOrderId,

              system_order_id:
                systemOrderId

            })
        }
      );


    const data =
      await response.json();


    console.log(
      "CAPTURE RESPONSE:",
      data
    );


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.message ||
        "PayPal payment could not be captured."
      );
    }


    removeCheckedOutItemsFromCart();


    localStorage.removeItem(
      "checkoutItems"
    );

    localStorage.removeItem(
      "paypalOrderId"
    );

    localStorage.removeItem(
      "lastOrderId"
    );


    const orderNumber =
      data.order_number ||
      localStorage.getItem(
        "lastOrderNumber"
      ) ||
      "N/A";


    localStorage.removeItem(
      "lastOrderNumber"
    );


    await Swal.fire({

      icon:
        "success",

      title:
        "Payment Successful!",

      html: `
        <p>
          Your PayPal payment has
          been completed.
        </p>

        <p>
          Order Number:
        </p>

        <strong style="
          color:#d4af37;
          font-size:22px;
        ">
          ${escapeHtml(
            orderNumber
          )}
        </strong>
      `,

      confirmButtonText:
        "View My Orders",

      customClass: {
        popup:
          "jcn-popup",

        title:
          "jcn-success-title",

        confirmButton:
          "jcn-confirm-btn"
      },

      buttonsStyling:
        false
    });


    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );


    window.location.href =
      "customer-orders.html";


  } catch (error) {

    Swal.close();


    console.error(
      "PAYPAL CAPTURE ERROR:",
      error
    );


    await showAlert(
      "error",
      "Payment Error",
      error.message ||
      "Unable to confirm PayPal payment."
    );
  }
}


/* =========================================================
   REMOVE PURCHASED ITEMS
========================================================= */

function removeCheckedOutItemsFromCart() {
  const customerCart =
    JSON.parse(
      localStorage.getItem(
        "customerCart"
      )
    ) || [];


  const purchasedKeys =
    cart.map(item =>

      item.cartKey ||

      `${
        item.product_id ||
        item.id
      }-${item.size}-${item.color}`

    );


  const remainingCart =
    customerCart.filter(
      item => {

        const key =
          item.cartKey ||

          `${
            item.product_id ||
            item.id
          }-${item.size}-${item.color}`;


        return (
          !purchasedKeys.includes(
            key
          )
        );
      }
    );


  localStorage.setItem(
    "customerCart",
    JSON.stringify(
      remainingCart
    )
  );
}


/* =========================================================
   CHECKOUT BUTTON LOADING
========================================================= */

function setCheckoutLoading(
  loading,
  text = "Please wait..."
) {

  const button =
    document.querySelector(
      ".confirm-btn"
    );


  if (!button) {
    return;
  }


  if (loading) {

    button.dataset.originalText =
      button.textContent;

    button.disabled =
      true;

    button.textContent =
      text;

  } else {

    button.disabled =
      false;


    const paymentMethod =
      document.getElementById(
        "paymentMethod"
      )?.value;


    if (
      paymentMethod ===
      "PayPal"
    ) {

      button.textContent =
        "Pay with PayPal";

    } else {

      button.textContent =
        "Confirm Order";
    }
  }
}


/* =========================================================
   MY ORDERS BUTTON
========================================================= */

function setupOrderButton() {
  const button =
    document.getElementById(
      "goOrdersBtn"
    );


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    () => {

      window.location.href =
        "customer-orders.html";

    }
  );
}


/* =========================================================
   LOGOUT
========================================================= */

function setupLogoutButton() {
  const logoutBtn =
    document.getElementById(
      "logoutBtn"
    );


  if (!logoutBtn) {
    return;
  }


  logoutBtn.addEventListener(
    "click",

    async event => {

      event.preventDefault();


      const result =
        await Swal.fire({

          title:
            "Logout?",

          text:
            "Are you sure you want to logout?",

          icon:
            "question",

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


      if (
        !result.isConfirmed
      ) {
        return;
      }


      localStorage.removeItem(
        "customerToken"
      );

      localStorage.removeItem(
        "customerUser"
      );


      window.location.href =
        "user-login.html";
    }
  );
}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(value) {
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