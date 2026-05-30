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
          window.location.href = "dashboard.html";
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
    const message = document.getElementById("userRegisterMessage");

    if (!firstName || !lastName || !phone || !email || !username || !password || !confirmPassword) {
      message.style.color = "#ff8b8b";
      message.textContent = "Please fill in all required fields.";
      return;
    }

    const phoneRegex = /^09\d{9}$/;

    if (!phoneRegex.test(phone)) {
      message.style.color = "#ff8b8b";
      message.textContent = "Phone number must be 11 digits and start with 09.";
      return;
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;

    if (!strongPassword.test(password)) {
      message.style.color = "#ff8b8b";
      message.textContent =
        "Password must contain uppercase, lowercase, number, special character, and minimum 8 characters.";
      return;
    }

    if (password !== confirmPassword) {
      message.style.color = "#ff8b8b";
      message.textContent = "Passwords do not match.";
      return;
    }

    message.style.color = "#9cffb0";
    message.textContent = "Please verify your account.";

    document.getElementById("otpModal").classList.add("active");
  });
}

/* CLOSE OTP MODAL */
document.getElementById("closeOtpModal")?.addEventListener("click", () => {
  document.getElementById("otpModal").classList.remove("active");
});

/* CHOOSE EMAIL OR SMS */
let selectedVerificationMethod = "email";

document.querySelectorAll(".verify-method").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".verify-method").forEach(b => {
      b.classList.remove("active");
    });

    btn.classList.add("active");
    selectedVerificationMethod = btn.dataset.method;

    const text = document.getElementById("otpSendText");

    if (selectedVerificationMethod === "email") {
      text.textContent = "Code will be sent to your email address.";
    } else {
      text.textContent = "SMS verification is not available yet. Please use Email.";
    }
  });
});

/* SEND OTP */
document.getElementById("sendOtpBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("registerEmail").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();
  const otpMessage = document.getElementById("otpMessage");

  if (selectedVerificationMethod === "sms") {
    otpMessage.style.color = "#ff8b8b";
    otpMessage.textContent = "SMS verification is not available yet. Please use Email.";
    return;
  }

  if (!email) {
    otpMessage.style.color = "#ff8b8b";
    otpMessage.textContent = "Please enter your email first.";
    return;
  }

  try {
    otpMessage.style.color = "#ffcc36";
    otpMessage.textContent = "Sending verification code...";

    const res = await fetch(`${API_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        phone,
        method: selectedVerificationMethod
      })
    });

    const data = await res.json();

    if (data.success) {
      otpMessage.style.color = "#9cffb0";
      otpMessage.textContent = "Verification code sent to your email.";
    } else {
      otpMessage.style.color = "#ff8b8b";
      otpMessage.textContent = data.message || "Failed to send verification code.";
    }

  } catch (error) {
    console.error("Send OTP error:", error);
    otpMessage.style.color = "#ff8b8b";
    otpMessage.textContent = "Cannot connect to server.";
  }
});

/* VERIFY OTP AND REGISTER */
document.getElementById("verifyOtpBtn")?.addEventListener("click", async () => {
  const firstName = document.getElementById("registerFirstName").value.trim();
  const middleName = document.getElementById("registerMiddleName").value.trim();
  const lastName = document.getElementById("registerLastName").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const username = document.getElementById("registerUsername").value.trim();
  const password = document.getElementById("registerPassword").value.trim();
  const otp = document.getElementById("registerOtp").value.trim();

  const otpMessage = document.getElementById("otpMessage");
  const message = document.getElementById("userRegisterMessage");

  if (!otp) {
    otpMessage.style.color = "#ff8b8b";
    otpMessage.textContent = "Please enter the verification code.";
    return;
  }

  try {
    otpMessage.style.color = "#ffcc36";
    otpMessage.textContent = "Verifying account...";

    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        firstName,
        middleName,
        lastName,
        phone,
        email,
        username,
        password,
        otp
      })
    });

    const data = await res.json();

    if (data.success) {
      otpMessage.style.color = "#9cffb0";
      otpMessage.textContent = "Account verified successfully!";

      message.style.color = "#9cffb0";
      message.textContent = "Registration successful! Redirecting...";

      setTimeout(() => {
        window.location.href = "user-login.html";
      }, 1000);

    } else {
      otpMessage.style.color = "#ff8b8b";
      otpMessage.textContent = data.message || "Verification failed.";
    }

  } catch (error) {
    console.error("Verify OTP error:", error);
    otpMessage.style.color = "#ff8b8b";
    otpMessage.textContent = "Cannot connect to server.";
  }
});

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

      const targetId =
        this.getAttribute("data-target");

      const input =
        document.getElementById(targetId);

      const icon =
        this.querySelector("i");

      if (!input || !icon) return;

      if (input.type === "password") {

        input.type = "text";

        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");

      } else {

        input.type = "password";

        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
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
   FORGOT PASSWORD
========================= */
if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener("click", function (e) {
    e.preventDefault();

    const email = prompt("Enter your email to reset password:");

    if (email && email.trim() !== "") {
      alert("Password reset feature will be added next.");
    }
  });
}

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

    currentOrders = data.orders;
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
    order.status === status
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
async function addTracking(id) {
  const tracking = prompt("Enter J&T Tracking Number:");

  if (!tracking) return;

  try {
    const res = await fetch(`http://localhost:5000/api/orders/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tracking_number: tracking,
        status: "To Deliver"
      })
    });

    const data = await res.json();

    if (data.success) {
      alert("Tracking number added.");
      loadOrders();
    } else {
      alert(data.message);
    }

  } catch (error) {
    console.error(error);
  }
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
   ANNOUNCEMENTS
============================= */

const announcementTitle = document.getElementById("announcementTitle");
const announcementMessage = document.getElementById("announcementMessage");
const postAnnouncementBtn = document.getElementById("postAnnouncementBtn");
const announcementHistory = document.getElementById("announcementHistory");

async function loadAnnouncements() {
  if (!announcementHistory) return;

  const res = await fetch("http://localhost:5000/api/announcements");
  const data = await res.json();

  announcementHistory.innerHTML = "";

  if (!data.success || data.announcements.length === 0) {
    announcementHistory.innerHTML = `
      <p class="text-secondary">No announcements yet.</p>
    `;
    return;
  }

  data.announcements.forEach(item => {
    announcementHistory.innerHTML += `
  <div class="announcement-item">
    <div class="announcement-icon">
      <i class="fa-solid fa-bullhorn"></i>
    </div>

    <div class="announcement-content">
      <div class="announcement-header">
        <h6 class="announcement-title">${item.title}</h6>
        <span class="announcement-date">
          ${new Date(item.created_at).toLocaleString()}
        </span>
      </div>

      <p class="announcement-message">
        ${item.message}
      </p>
    </div>
  </div>
`;
  });
}

postAnnouncementBtn?.addEventListener("click", async () => {
  const title = announcementTitle.value.trim();
  const message = announcementMessage.value.trim();

  if (!title || !message) {
    alert("Please enter title and message.");
    return;
  }

  const res = await fetch("http://localhost:5000/api/admin/announcements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      message
    })
  });

  const data = await res.json();

  if (data.success) {
    alert("Announcement posted.");

    announcementTitle.value = "";
    announcementMessage.value = "";

    loadAnnouncements();
  } else {
    alert(data.message);
  }
});

loadAnnouncements();

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

let currentSettingsId = null;

async function loadAdminSettings() {
  const adminName = document.getElementById("adminName");
  if (!adminName) return;

  const res = await fetch("http://localhost:5000/api/admin/settings");
  const data = await res.json();

  if (!data.success) {
    alert(data.message);
    return;
  }

  const s = data.settings;
  currentSettingsId = s.id;

  adminName.value = s.admin_name || "";
  document.getElementById("adminEmail").value = s.email || "";
  document.getElementById("adminContact").value = s.contact_number || "";
  document.getElementById("shopName").value = s.shop_name || "";
  document.getElementById("shopAddress").value = s.shop_address || "";
  document.getElementById("businessEmail").value = s.business_email || "";

  document.getElementById("emailNotifications").checked = !!s.email_notifications;
  document.getElementById("autoReports").checked = !!s.auto_generate_reports;
  document.getElementById("maintenanceMode").checked = !!s.maintenance_mode;
  document.getElementById("allowRegistration").checked = !!s.allow_registration;
}

document.getElementById("saveSettingsBtn")?.addEventListener("click", async () => {
  const res = await fetch("http://localhost:5000/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: currentSettingsId,
      admin_name: document.getElementById("adminName").value,
      email: document.getElementById("adminEmail").value,
      contact_number: document.getElementById("adminContact").value,
      shop_name: document.getElementById("shopName").value,
      shop_address: document.getElementById("shopAddress").value,
      business_email: document.getElementById("businessEmail").value,
      email_notifications: document.getElementById("emailNotifications").checked,
      auto_generate_reports: document.getElementById("autoReports").checked,
      maintenance_mode: document.getElementById("maintenanceMode").checked,
      allow_registration: document.getElementById("allowRegistration").checked
    })
  });

  const data = await res.json();
  alert(data.message);
});

document.getElementById("cancelSettingsBtn")?.addEventListener("click", loadAdminSettings);

document.getElementById("resetSettingsBtn")?.addEventListener("click", () => {
  if (confirm("Reset settings to default?")) {
    document.getElementById("adminName").value = "Admin User";
    document.getElementById("shopName").value = "JCN Apparel Printing Services";
    document.getElementById("shopAddress").value = "Quezon City, Philippines";
  }
});
loadAdminSettings();
