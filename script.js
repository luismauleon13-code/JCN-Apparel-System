const userLoginForm = document.getElementById("userLoginForm");
const userRegisterForm = document.getElementById("userRegisterForm");
const adminLoginForm = document.getElementById("adminLoginForm");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

const API_URL = "http://localhost:5000/api/auth";

/* CUSTOMER LOGIN */
if (userLoginForm) {
  userLoginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const message = document.getElementById("userLoginMessage");

    if (username === "" || password === "") {
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
        message.textContent = data.message;
      }

    } catch (error) {
      message.style.color = "#ff8b8b";
      message.textContent = "Cannot connect to server.";
      console.error(error);
    }
  });
}

/* CUSTOMER REGISTER */
/* CUSTOMER REGISTER */
if (userRegisterForm) {
  userRegisterForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const fullname = document.getElementById("registerFullName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const confirmPassword = document.getElementById("registerConfirmPassword").value.trim();
    const message = document.getElementById("userRegisterMessage");

    if (!fullname || !email || !username || !password || !confirmPassword) {
      message.style.color = "#ff8b8b";
      message.textContent = "Please fill in all fields.";
      return;
    }

    if (password !== confirmPassword) {
      message.style.color = "#ff8b8b";
      message.textContent = "Passwords do not match.";
      return;
    }

    try {

      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullname,
          email,
          username,
          password
        })
      });

      const data = await response.json();

      if (response.ok) {

        message.style.color = "#9cffb0";
        message.textContent = "Registration successful! Redirecting...";

        setTimeout(() => {
          window.location.href = "user-login.html";
        }, 1000);

      } else {

        message.style.color = "#ff8b8b";
        message.textContent = data.message || "Registration failed.";

      }

    } catch (error) {

      console.error(error);

      message.style.color = "#ff8b8b";
      message.textContent = "Cannot connect to server.";

    }
  });
}


/* ADMIN LOGIN */
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value.trim();
    const message = document.getElementById("adminLoginMessage");

    if (username === "" || password === "") {
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
        message.textContent = data.message;
      }

    } catch (error) {
      message.style.color = "#ff8b8b";
      message.textContent = "Cannot connect to server.";
      console.error(error);
    }
  });
}

/* FORGOT PASSWORD */
if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener("click", function (e) {
    e.preventDefault();

    const email = prompt("Enter your email to reset password:");

    if (email && email.trim() !== "") {
      alert("Password reset feature will be added next.");
    }
  });
}