const userLoginForm = document.getElementById("userLoginForm");
const userRegisterForm = document.getElementById("userRegisterForm");
const adminLoginForm = document.getElementById("adminLoginForm");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

const API_URL = "http://localhost:5000/api/auth";



/* =========================
   CUSTOMER LOGIN
========================= */
if (userLoginForm) {
  userLoginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const message = document.getElementById("userLoginMessage");

    if (!username || !password) {
      message.style.color = "#ff8b8b";
      message.textContent = "Please enter username and password.";
      return;
    }

    try {
      const response = await fetch(`${API_URL}/customer-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("customerToken", data.token);
        localStorage.setItem("customerUser", JSON.stringify(data.user));

        message.style.color = "#9cffb0";
        message.textContent = "Login successful! Redirecting...";

        setTimeout(() => {
         window.location.href = "../html/dashboard.html";
        }, 1000);
      } else {
        message.style.color = "#ff8b8b";
        message.textContent = data.message || "Login failed.";
      }

    } catch (error) {
      console.error("Customer login error:", error);
      message.style.color = "#ff8b8b";
      message.textContent = "Cannot connect to server.";
    }
  });
}

/* =========================
   CUSTOMER REGISTER
========================= */
if (userRegisterForm) {
  userRegisterForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const firstName = document.getElementById("registerFirstName").value.trim();
    const middleName = document.getElementById("registerMiddleName").value.trim();
    const lastName = document.getElementById("registerLastName").value.trim();
    const phone = document.getElementById("registerPhone").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const confirmPassword = document.getElementById("registerConfirmPassword").value.trim();
    const otpMethod = document.querySelector('input[name="otpMethod"]:checked').value;

    const message = document.getElementById("userRegisterMessage");

    message.textContent = "";

    if (
      !firstName ||
      !lastName ||
      !phone ||
      !email ||
      !username ||
      !password ||
      !confirmPassword ||
      !otpMethod
    ) {
      message.style.color = "#ff8b8b";
      message.textContent = "Please fill in all required fields.";
      return;
    }

    if (!/^09\d{9}$/.test(phone)) {
      message.style.color = "#ff8b8b";
      message.textContent = "Phone number must be 11 digits and start with 09.";
      return;
    }

    if (password !== confirmPassword) {
      message.style.color = "#ff8b8b";
      message.textContent = "Passwords do not match.";
      return;
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

    if (!strongPassword.test(password)) {
      message.style.color = "#ff8b8b";
      message.textContent =
        "Password must contain uppercase, lowercase, number, special character, and minimum 8 characters.";
      return;
    }

    try {
      message.style.color = "#ffcc36";
      message.textContent =
        otpMethod === "sms"
          ? "Sending OTP to phone number..."
          : "Sending OTP to email...";

      const res = await fetch("http://localhost:5000/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          username,
          phone,
          otp_method: otpMethod
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        message.style.color = "#ff8b8b";
        message.textContent =
          data.message || "Email, username, or phone number already exists.";
        return;
      }

      localStorage.setItem("pendingFirstName", firstName);
      localStorage.setItem("pendingMiddleName", middleName);
      localStorage.setItem("pendingLastName", lastName);
      localStorage.setItem("pendingPhone", phone);
      localStorage.setItem("pendingEmail", email);
      localStorage.setItem("pendingUsername", username);
      localStorage.setItem("pendingPassword", password);
      localStorage.setItem("pendingOtpMethod", otpMethod);

      message.style.color = "#9cffb0";
      message.textContent =
        otpMethod === "sms"
          ? "OTP sent to your phone! Redirecting..."
          : "OTP sent to your email! Redirecting...";

      setTimeout(() => {
        window.location.href = "email-verification.html";
      }, 1000);

    } catch (error) {
      console.error("SEND OTP ERROR:", error);
      message.style.color = "#ff8b8b";
      message.textContent = "Server error. Please check if backend is running.";
    }
  });
}

/* =========================
   ADMIN LOGIN
========================= */
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value.trim();
    const message = document.getElementById("adminLoginMessage");

    if (!username || !password) {
      message.style.color = "#ff8b8b";
      message.textContent = "Please enter username and password.";
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminUser", JSON.stringify(data.user));

        message.style.color = "#9cffb0";
        message.textContent = "Admin login successful! Redirecting...";

        setTimeout(() => {
          window.location.href = "admin-dashboard.html";
        }, 1000);
      } else {
        message.style.color = "#ff8b8b";
        message.textContent = data.message || "Login failed.";
      }

    } catch (error) {
      console.error("Admin login error:", error);
      message.style.color = "#ff8b8b";
      message.textContent = "Cannot connect to server.";
    }
  });
}

/* =========================
   SHOW / HIDE PASSWORD
========================= */
document.addEventListener("DOMContentLoaded", () => {

  const passwordButtons = document.querySelectorAll(
    ".password-eye-btn, .toggle-password"
  );

  passwordButtons.forEach(button => {

    button.addEventListener("click", function () {

      const targetId = this.getAttribute("data-target");
      const input = document.getElementById(targetId);
      const icon = this.querySelector("i");

      if (!input || !icon) return;

      if (input.type === "password") {

        // SHOW PASSWORD
        input.type = "text";

        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");

      } else {

        // HIDE PASSWORD
        input.type = "password";

        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");

      }

    });

  });

});
/* =============================
   MANAGE USERS
============================= */

const usersTable = document.getElementById("usersTable");

function getRestrictionDays(user) {
  if (user.status !== "restricted" || !user.restriction_until) {
    return "";
  }

  const now = new Date();
  const until = new Date(user.restriction_until);

  const daysLeft = Math.ceil(
    (until - now) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft <= 0) {
    return "Restriction expired";
  }

  return `${daysLeft} day(s) left`;
}

async function loadUsers() {
  if (!usersTable) return;

  const res = await fetch("http://localhost:5000/api/admin/users");
  const data = await res.json();

  usersTable.innerHTML = "";

  data.users.forEach(user => {
    usersTable.innerHTML += `
      <tr>
        <td>${user.full_name || "Unknown"}</td>
        <td>${user.email || ""}</td>
        <td>${user.username || ""}</td>

        <td>
          <span class="${user.status === "restricted" ? "text-danger" : "text-success"}">
            ${user.status || "active"}
          </span>

          ${
            user.status === "restricted"
              ? `<small class="text-warning d-block mt-1">
                  ${getRestrictionDays(user)}
                </small>`
              : ""
          }
        </td>

        <td>
          <button class="btn btn-sm btn-warning" onclick="restrictUser('${user.id}')">
            Restrict
          </button>

          <button class="btn btn-sm btn-success" onclick="unrestrictUser('${user.id}')">
            Unrestrict
          </button>
        </td>
      </tr>
    `;
  });
}

if (usersTable) {
  loadUsers();
}

/* =========================
   FORGOT PASSWORD CUSTOMER
========================= */
let customerResetStep = 1;
let customerResetEmailValue = "";

const customerResetModal = document.getElementById("customerResetModal");
const customerResetText = document.getElementById("customerResetText");
const customerResetEmail = document.getElementById("customerResetEmail");
const customerResetOtp = document.getElementById("customerResetOtp");
const customerResetNewPassword = document.getElementById("customerResetNewPassword");
const customerResetConfirmPassword = document.getElementById("customerResetConfirmPassword");
const customerResetMessage = document.getElementById("customerResetMessage");
const customerResetNextBtn = document.getElementById("customerResetNextBtn");
const customerCancelResetBtn = document.getElementById("customerCancelResetBtn");
const customerSuccessModal = document.getElementById("customerSuccessModal");
const customerSuccessOkBtn = document.getElementById("customerSuccessOkBtn");

if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener("click", function (e) {
    e.preventDefault();

    customerResetStep = 1;
    customerResetEmailValue = "";

    customerResetText.textContent = "Enter your email to receive OTP.";
    customerResetNextBtn.textContent = "Send OTP";
    customerResetMessage.textContent = "";

    customerResetEmail.classList.remove("hidden");
    customerResetOtp.classList.add("hidden");
    customerResetNewPassword.classList.add("hidden");
    customerResetConfirmPassword.classList.add("hidden");

    customerResetEmail.value = "";
    customerResetOtp.value = "";
    customerResetNewPassword.value = "";
    customerResetConfirmPassword.value = "";

    customerResetModal.classList.remove("hidden");
  });
}

customerCancelResetBtn?.addEventListener("click", () => {
  customerResetModal.classList.add("hidden");
});

customerSuccessOkBtn?.addEventListener("click", () => {
  customerSuccessModal.classList.add("hidden");
});

customerResetNextBtn?.addEventListener("click", async () => {
  try {
    if (customerResetStep === 1) {
      const email = customerResetEmail.value.trim();

      if (!email) {
        customerResetMessage.textContent = "Please enter your email.";
        return;
      }

      const res = await fetch("http://localhost:5000/api/auth/forgot-password", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ email })
});

      const data = await res.json();

      if (!res.ok) {
        customerResetMessage.textContent =
          data.message || "Failed to send OTP.";
        return;
      }

      customerResetEmailValue = email;
      customerResetStep = 2;

      customerResetText.textContent = "Enter the OTP sent to your email.";
      customerResetEmail.classList.add("hidden");
      customerResetOtp.classList.remove("hidden");
      customerResetNextBtn.textContent = "Verify OTP";
      customerResetMessage.textContent = "OTP sent successfully.";
      return;
    }

    if (customerResetStep === 2) {
      if (!customerResetOtp.value.trim()) {
        customerResetMessage.textContent = "Please enter OTP.";
        return;
      }

      customerResetStep = 3;

      customerResetText.textContent = "Create your new password.";
      customerResetOtp.classList.add("hidden");
      customerResetNewPassword.classList.remove("hidden");
      customerResetConfirmPassword.classList.remove("hidden");
      customerResetNextBtn.textContent = "Reset Password";
      customerResetMessage.textContent = "";
      return;
    }

    if (customerResetStep === 3) {
      const newPassword = customerResetNewPassword.value.trim();
      const confirmPassword = customerResetConfirmPassword.value.trim();

      if (!newPassword || !confirmPassword) {
        customerResetMessage.textContent =
          "Please fill in both password fields.";
        return;
      }

      if (newPassword !== confirmPassword) {
        customerResetMessage.textContent =
          "Passwords do not match.";
        return;
      }

      const resetRes = await fetch("http://localhost:5000/api/auth/reset-password", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: customerResetEmailValue,
    otp: customerResetOtp.value.trim(),
    newPassword
  })
});

      const resetData = await resetRes.json();

      if (!resetRes.ok) {
        customerResetMessage.textContent =
          resetData.message || "Password reset failed.";
        return;
      }

      customerResetModal.classList.add("hidden");
      customerSuccessModal.classList.remove("hidden");
    }
  } catch (error) {
    console.error(error);
    customerResetMessage.textContent =
      "Server error. Please try again.";
  }
});

/* =========================
   FORGOT PASSWORD ADMIN
========================= */

let resetStep = 1;
let resetEmailValue = "";

const adminForgotPasswordBtn = document.getElementById("adminForgotPasswordBtn");
const resetModal = document.getElementById("resetModal");
const resetText = document.getElementById("resetText");
const resetEmail = document.getElementById("resetEmail");
const resetOtp = document.getElementById("resetOtp");
const resetNewPassword = document.getElementById("resetNewPassword");
const resetConfirmPassword = document.getElementById("resetConfirmPassword");
const resetMessage = document.getElementById("resetMessage");
const resetNextBtn = document.getElementById("resetNextBtn");
const cancelResetBtn = document.getElementById("cancelResetBtn");


adminForgotPasswordBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  resetStep = 1;
  resetEmailValue = "";
  resetText.textContent = "Enter your admin email to receive OTP.";
  resetNextBtn.textContent = "Send OTP";
  resetMessage.textContent = "";

  resetEmail.classList.remove("hidden");
  resetOtp.classList.add("hidden");
  resetNewPassword.classList.add("hidden");
  resetConfirmPassword.classList.add("hidden");

  resetEmail.value = "";
  resetOtp.value = "";
  resetNewPassword.value = "";
  resetConfirmPassword.value = "";

  resetModal.classList.remove("hidden");
});

cancelResetBtn?.addEventListener("click", () => {
  resetModal.classList.add("hidden");
});

resetNextBtn?.addEventListener("click", async () => {
  try {
    if (resetStep === 1) {
      const email = resetEmail.value.trim();

      if (!email) {
        resetMessage.textContent = "Please enter admin email.";
        return;
      }

      const res = await fetch("http://localhost:5000/api/auth/admin-forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        resetMessage.textContent = data.message || "Failed to send OTP.";
        return;
      }

      resetEmailValue = email;
      resetStep = 2;

      resetText.textContent = "Enter the OTP sent to your email.";
      resetEmail.classList.add("hidden");
      resetOtp.classList.remove("hidden");
      resetNextBtn.textContent = "Verify OTP";
      resetMessage.textContent = "OTP sent successfully.";
      return;
    }

    if (resetStep === 2) {
      if (!resetOtp.value.trim()) {
        resetMessage.textContent = "Please enter OTP.";
        return;
      }

      resetStep = 3;
      resetText.textContent = "Create your new admin password.";
      resetOtp.classList.add("hidden");
      resetNewPassword.classList.remove("hidden");
      resetConfirmPassword.classList.remove("hidden");
      resetNextBtn.textContent = "Reset Password";
      resetMessage.textContent = "";
      return;
    }

    if (resetStep === 3) {
      const newPassword = resetNewPassword.value.trim();
      const confirmPassword = resetConfirmPassword.value.trim();

      if (!newPassword || !confirmPassword) {
        resetMessage.textContent = "Please fill in both password fields.";
        return;
      }

      if (newPassword !== confirmPassword) {
        resetMessage.textContent = "Passwords do not match.";
        return;
      }

      const res = await fetch("http://localhost:5000/api/auth/admin-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmailValue,
          otp: resetOtp.value.trim(),
          newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        resetMessage.textContent = data.message || "Password reset failed.";
        return;
      }

      resetModal.classList.add("hidden");

document.getElementById("successModal").classList.remove("hidden");
document.getElementById("successOkBtn")?.addEventListener("click", () => {
  document.getElementById("successModal").classList.add("hidden");
});
    }
  } catch (error) {
    resetMessage.textContent = "Server error. Please try again.";
  }
});

// =============================
// MANAGE ORDERS
// =============================
const ordersTable = document.getElementById("ordersTable");
const searchInput = document.getElementById("searchInput");

let currentOrders = [];

/* LOAD ORDERS */
async function loadOrders() {
  try {
    const res = await fetch("http://localhost:5000/api/orders");
    const data = await res.json();

    if (!data.success) {
      console.log(data.message);
      return;
    }

    currentOrders = (data.orders || []).filter(order => {
  const status = (order.status || "").trim();
  return status !== "Cancelled";
});

renderOrders(currentOrders);

  } catch (error) {
    console.error(error);
  }
}

/* RENDER ORDERS */
function renderOrders(orders) {
  if (!ordersTable) return;

  ordersTable.innerHTML = "";

  if (!orders || orders.length === 0) {
    ordersTable.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-secondary py-4">
          No orders found.
        </td>
      </tr>
    `;
    return;
  }

  orders.forEach(order => {
    ordersTable.innerHTML += `
      <tr>
        <td>
          <span class="text-gold fw-bold">
            #${order.id.substring(0, 6)}
          </span>
        </td>

        <td class="text-light">
          ${order.customer_name || "Unknown"}<br>
          <small class="text-secondary">
            ${order.customer_email || ""}
          </small>
        </td>

        <td class="text-light">
          ₱${Number(order.total_amount || 0).toLocaleString()}
        </td>

        <td>
          <select
            class="form-select form-select-sm bg-dark text-light border-warning"
            onchange="updateStatus('${order.id}', this.value)"
          >
            <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
<option value="Preparing" ${order.status === "Preparing" ? "selected" : ""}>Preparing</option>
<option value="To Deliver" ${order.status === "To Deliver" ? "selected" : ""}>To Deliver</option>
<option value="Completed" ${order.status === "Completed" ? "selected" : ""}>Completed</option>
          </select>

          ${
            order.tracking_number
              ? `<small class="text-warning d-block mt-1">
                  J&T: ${order.tracking_number}
                </small>`
              : ""
          }
        </td>

        <td class="text-secondary">
          ${order.payment_method || "N/A"}<br>
          <small>${order.payment_status || "Pending"}</small>
        </td>

        <td class="text-end">
          <button
            class="btn btn-sm text-gold"
            onclick="addTracking('${order.id}')"
          >
            <i class="fa-solid fa-truck-fast"></i>
          </button>

          <button
            class="btn btn-sm text-danger ms-2"
            onclick="deleteOrder('${order.id}')"
          >
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  });
}



/* SEARCH ORDERS */
searchInput?.addEventListener("keyup", () => {
  const keyword = searchInput.value.toLowerCase().trim();

  const filtered = currentOrders.filter(order =>
    (order.customer_name || "").toLowerCase().includes(keyword) ||
    (order.customer_email || "").toLowerCase().includes(keyword) ||
    (order.customer_phone || "").toLowerCase().includes(keyword) ||
    (order.tracking_number || "").toLowerCase().includes(keyword)
  );

  renderOrders(filtered);
});

/* FILTER ORDERS */
function filterOrders(status) {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  const clickedBtn = [...document.querySelectorAll(".filter-btn")]
    .find(btn => btn.textContent.trim() === status);

  if (clickedBtn) clickedBtn.classList.add("active");

  if (status === "All") {
    renderOrders(currentOrders);
    return;
  }

  const filtered = currentOrders.filter(order =>
  (order.status || "").trim().toLowerCase() === status.toLowerCase()
);

  renderOrders(filtered);
}

/* UPDATE STATUS */
async function updateStatus(id, status) {
  try {
    const res = await fetch(`http://localhost:5000/api/orders/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    const data = await res.json();

    if (data.success) {
      loadOrders();
    } else {
      alert(data.message);
    }

  } catch (error) {
    console.error(error);
  }
}

/* ADD TRACKING */
let selectedTrackingOrderId = null;

/* OPEN TRACKING MODAL */
function addTracking(id) {
  selectedTrackingOrderId = id;

  const modal = document.getElementById("trackingModal");
  const input = document.getElementById("trackingInput");
  const message = document.getElementById("trackingMessage");

  if (!modal || !input || !message) {
    console.error("Tracking modal elements not found.");
    return;
  }

  input.value = "";
  message.textContent = "";

  modal.classList.remove("hidden");
}

/* CANCEL TRACKING */
document.getElementById("cancelTrackingBtn")?.addEventListener("click", () => {
  document.getElementById("trackingModal")?.classList.add("hidden");
});

/* SAVE TRACKING */
document.getElementById("saveTrackingBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("trackingInput");
  const message = document.getElementById("trackingMessage");
  const modal = document.getElementById("trackingModal");

  if (!input || !message || !modal) return;

  const tracking = input.value.trim();

  if (!tracking) {
    message.textContent = "Please enter J&T tracking number.";
    return;
  }

  if (!selectedTrackingOrderId) {
    message.textContent = "No order selected.";
    return;
  }

  try {
    message.textContent = "Saving tracking number...";

    const res = await fetch(
      `http://localhost:5000/api/orders/${selectedTrackingOrderId}/tracking`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tracking_number: tracking
        })
      }
    );

    const data = await res.json();

    if (!res.ok || !data.success) {
      message.textContent =
        data.message || "Failed to save tracking number.";
      return;
    }

    modal.classList.add("hidden");

    Swal.fire({
  icon: "success",
  title: "Tracking Added",
  html: `
    <b>Tracking Number:</b><br>
    ${trackingNumber}<br><br>
    Order status updated to <b>To Deliver</b>.
  `,
  confirmButtonColor: "#d4af37",
  background: "#111",
  color: "#fff"
});

    window.location.reload();

  } catch (error) {
    console.error("ADD TRACKING ERROR:", error);
    message.textContent = "Failed to connect to server.";
  }
});

/* CANCEL ORDER */
async function cancelOrder(orderId) {
  if (!confirm("Cancel this order?")) return;

  const res = await fetch(`http://localhost:5000/api/orders/${orderId}/cancel`, {
    method: "PATCH"
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  alert("Order cancelled.");
  loadOrders();
}

/* DELETE ORDER */
async function deleteOrder(id) {
  const confirmDelete = confirm("Delete this order?");

  if (!confirmDelete) return;

  try {
    const res = await fetch(`http://localhost:5000/api/orders/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (data.success) {
      alert("Order deleted.");
      loadOrders();
    } else {
      alert(data.message);
    }

  } catch (error) {
    console.error(error);
  }
}

/* RUN ONLY ON MANAGE ORDERS PAGE */
if (ordersTable) {
  loadOrders();
}

async function loadOrders() {
  try {
    const res = await fetch("http://localhost:5000/api/orders");
    const data = await res.json();

    console.log("API DATA:", data);

    if (!data.success) {
      console.log(data.message);
      return;
    }

    currentOrders = (data.orders || []).filter(order => {
      const status = (order.status || "").trim();
      return status !== "Cancelled";
    });

    console.log("CURRENT ORDERS:", currentOrders);

    renderOrders(currentOrders);

  } catch (error) {
    console.error(error);
  }
}

/* =========================
   PRODUCT IMAGE PREVIEW
========================= */

const productImageInput = document.getElementById("productImage");
const previewImage = document.getElementById("previewImage");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");

if (productImageInput) {

  productImageInput.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {

      previewImage.src = e.target.result;

      previewImage.style.display = "block";

      uploadPlaceholder.style.display = "none";
    };

    reader.readAsDataURL(file);
  });
}


/* =============================
   ADMIN OVERVIEW
============================= */

const recentActivityBox =
  document.getElementById("recentActivityBox");

async function loadAdminOverview() {

  if (!recentActivityBox) return;

  try {

    const res = await fetch(
      "http://localhost:5000/api/admin/overview"
    );

    const data = await res.json();

    if (!data.success) {

      recentActivityBox.innerHTML = `
        <div class="activity-item">
          <h6>Error loading activity</h6>
          <p>${data.message}</p>
        </div>
      `;

      return;
    }

    const activities = [

      ...(data.recentAnnouncements || []).map(item => ({
        type: "announcement",
        title: item.title,
        message: item.message,
        date: item.created_at
      })),

      ...(data.recentOrders || []).map(item => ({
        type: "order",
        title: "New Order",
        message:
          `${item.customer_name || "Customer"} ordered ₱${Number(item.total_amount || 0).toLocaleString()}`,
        date: item.created_at
      }))

    ];

    activities.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    recentActivityBox.innerHTML = "";

    if (activities.length === 0) {

      recentActivityBox.innerHTML = `
        <div class="activity-item">
          <h6>No recent activity</h6>
          <p>No announcements or orders yet.</p>
        </div>
      `;
      return;
    }
    activities.slice(0, 8).forEach(item => {

      recentActivityBox.innerHTML += `
        <div class="activity-item">

          <div class="activity-icon">

            <i class="fa-solid ${
              item.type === "announcement"
                ? "fa-bullhorn"
                : "fa-cart-shopping"
            }"></i>

          </div>

          <div class="activity-content">

            <div class="activity-header">

              <h6>${item.title}</h6>

              <span>
                ${new Date(item.date).toLocaleString()}
              </span>

            </div>

            <p>${item.message}</p>

          </div>

        </div>
      `;
    });
  } catch (error) {
    console.error(error);
  }
}
loadAdminOverview();

/* =============================
   REPORTS PAGE
============================= */

const reportTable = document.getElementById("reportTable");
const exportReportBtn = document.getElementById("exportReportBtn");

let reportOrders = [];

function peso(value) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

async function loadReports() {
  if (!reportTable) return;

  try {
    const res = await fetch("http://localhost:5000/api/admin/reports");
    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Cannot load reports.");
      return;
    }

    reportOrders = data.orders || [];

    document.getElementById("reportTotalSales").textContent =
      peso(data.totalSales);

    document.getElementById("reportTotalOrders").textContent =
      data.totalOrders || 0;

    document.getElementById("reportTotalUsers").textContent =
      data.totalUsers || 0;

    document.getElementById("reportDelivered").textContent =
      data.delivered || 0;

    document.getElementById("statusPreparing").textContent =
      data.statusCounts?.Preparing || 0;

    document.getElementById("statusToDeliver").textContent =
      data.statusCounts?.["To Deliver"] || 0;

    document.getElementById("statusCompleted").textContent =
      data.statusCounts?.Completed || 0;

    document.getElementById("statusCancelled").textContent =
      data.statusCounts?.Cancelled || 0;

    reportTable.innerHTML = "";

    if (reportOrders.length === 0) {
      reportTable.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-secondary py-4">
            No report data found.
          </td>
        </tr>
      `;
    } else {
      reportOrders.slice(0, 10).forEach(order => {
        reportTable.innerHTML += `
          <tr>
            <td>#${order.id.slice(0, 8)}</td>
            <td>Order Report</td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td>${peso(order.total_amount)}</td>
            <td>
              <span class="status-badge">
                ${order.status || "N/A"}
              </span>
            </td>
          </tr>
        `;
      });
    }

    renderMonthlySalesChart();

  } catch (error) {
    console.error(error);
    alert("Cannot load reports. Make sure backend is running.");
  }
}

/* RENDER MONTHLY SALES CHART */
function renderMonthlySalesChart() {
  const monthlySalesChart = document.getElementById("monthlySalesChart");

  if (!monthlySalesChart) return;

  const monthlySales = Array(12).fill(0);

  reportOrders.forEach(order => {
    if (order.status === "Completed") {
      const date = new Date(order.created_at);
      const monthIndex = date.getMonth();

      monthlySales[monthIndex] += Number(order.total_amount || 0);
    }
  });

  const maxSales = Math.max(...monthlySales, 1);

  const months = [
    "Jan", "Feb", "Mar", "Apr",
    "May", "Jun", "Jul", "Aug",
    "Sep", "Oct", "Nov", "Dec"
  ];

  monthlySalesChart.innerHTML = "";

  months.forEach((month, index) => {
    const height = Math.max(
      (monthlySales[index] / maxSales) * 100,
      8
    );

    monthlySalesChart.innerHTML += `
      <div class="bar" style="height:${height}%">
        <small class="bar-value">
          ₱${monthlySales[index].toLocaleString()}
        </small>
        <span>${month}</span>
      </div>
    `;
  });
}

/* EXPORT REPORT AS PDF */
exportReportBtn?.addEventListener("click", () => {
  if (!reportOrders || reportOrders.length === 0) {
    alert("No report data to export.");
    return;
  }

  if (!window.jspdf) {
    alert("PDF library not loaded. Add jsPDF scripts in reports.html.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("landscape");

  const totalSales = reportOrders
    .filter(order => order.status === "Completed")
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  doc.setFontSize(18);
  doc.text("JCN Apparel Full Report", 14, 15);

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  doc.text(`Total Sales: PHP ${totalSales.toLocaleString()}`, 14, 31);
  doc.text(`Total Orders: ${reportOrders.length}`, 14, 38);

  const rows = reportOrders.map(order => [
    order.id?.slice(0, 8) || "",
    order.customer_name || "Unknown",
    order.customer_email || "",
    order.customer_phone || "",
    `PHP ${Number(order.total_amount || 0).toLocaleString()}`,
    order.payment_method || "",
    order.payment_status || "",
    order.status || "",
    order.tracking_number || "",
    new Date(order.created_at).toLocaleString()
  ]);

  doc.autoTable({
    startY: 46,
    head: [[
      "Order ID",
      "Customer",
      "Email",
      "Phone",
      "Amount",
      "Method",
      "Payment",
      "Status",
      "Tracking",
      "Date"
    ]],
    body: rows,
    styles: {
      fontSize: 8
    },
    headStyles: {
      fillColor: [214, 165, 29],
      textColor: [0, 0, 0]
    }
  });

  doc.save("jcn-full-report.pdf");
});

loadReports();

