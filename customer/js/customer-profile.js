const API_URL = "http://localhost:5000";

document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  loadProfile();

  document.getElementById("profileForm").addEventListener("submit", updateProfile);
  document.getElementById("passwordForm").addEventListener("submit", changePassword);
  document.getElementById("logoutBtn").addEventListener("click", logoutCustomer);

  document.querySelectorAll(".toggle-password").forEach(icon => {
    icon.addEventListener("click", togglePassword);
  });
});

function checkLogin() {
  const token = localStorage.getItem("customerToken");
  const user = localStorage.getItem("customerUser");

  if (!token || !user) {
    alert("Please login first.");
    window.location.href = "user-login.html";
  }
}

function loadProfile() {
  const user = JSON.parse(localStorage.getItem("customerUser")) || {};

  document.getElementById("profileName").textContent =
    user.fullname || user.full_name || user.username || "Customer";

  document.getElementById("profileEmail").textContent =
    user.email || "No email";

  document.getElementById("fullName").value =
    user.fullname || user.full_name || "";

  document.getElementById("email").value =
    user.email || "";

  document.getElementById("houseStreet").value =
    user.house_street || "";

  document.getElementById("barangay").value =
    user.barangay || "";

  document.getElementById("city").value =
    user.city || "";

  document.getElementById("province").value =
    user.province || "";

  document.getElementById("phone").value =
    user.phone || "";

  document.getElementById("username").value =
    user.username || "";
}

async function updateProfile(e) {
  e.preventDefault();

  const user = JSON.parse(localStorage.getItem("customerUser")) || {};

  const houseStreet = document.getElementById("houseStreet").value.trim();
  const barangay = document.getElementById("barangay").value.trim();
  const city = document.getElementById("city").value.trim();
  const province = document.getElementById("province").value.trim();

  const updatedUser = {
    full_name: document.getElementById("fullName").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    username: document.getElementById("username").value.trim(),

    house_street: houseStreet,
    barangay: barangay,
    city: city,
    province: province,
    address: `${houseStreet}, ${barangay}, ${city}, ${province}`
  };

  if (!updatedUser.full_name || !updatedUser.email || !updatedUser.username) {
    alert("Full name, email, and username are required.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/customer/profile/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatedUser)
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Failed to update profile.");
      return;
    }

    const newLocalUser = {
      ...user,
      fullname: data.user.full_name,
      full_name: data.user.full_name,
      email: data.user.email,
      phone: data.user.phone,
      username: data.user.username,

      house_street: data.user.house_street,
      barangay: data.user.barangay,
      city: data.user.city,
      province: data.user.province,
      address: data.user.address
    };

    localStorage.setItem("customerUser", JSON.stringify(newLocalUser));

    Swal.fire({
  icon: "success",
  title: "Profile Updated",
  text: "Profile updated successfully.",
  confirmButtonText: "OK",
  background: "#111",
  color: "#fff",
  confirmButtonColor: "#d4af37"
});
    loadProfile();

  } catch (error) {
    console.error(error);
    Swal.fire({
  icon: "error",
  title: "Update Failed",
  text: "Cannot connect to server.",
  confirmButtonText: "OK",
  background: "#111",
  color: "#fff",
  confirmButtonColor: "#d4af37"
});
  }
}

async function changePassword(e) {
  e.preventDefault();

  const user = JSON.parse(localStorage.getItem("customerUser")) || {};

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    alert("Please fill all password fields.");
    return;
  }

  if (newPassword.length < 6) {
    alert("New password must be at least 6 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    alert("New password and confirm password do not match.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/customer/change-password/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Failed to change password.");
      return;
    }

    alert("Password changed successfully.");
    document.getElementById("passwordForm").reset();

  } catch (error) {
    console.error(error);
    alert("Cannot connect to server.");
  }
}

function togglePassword(e) {
  const targetId = e.target.dataset.target;
  const input = document.getElementById(targetId);

  if (input.type === "password") {
    input.type = "text";
    e.target.classList.remove("fa-eye");
    e.target.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    e.target.classList.remove("fa-eye-slash");
    e.target.classList.add("fa-eye");
  }
}
