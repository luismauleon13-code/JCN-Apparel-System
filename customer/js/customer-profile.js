
const API_URL = "";

document.addEventListener("DOMContentLoaded", () => {
  if (!checkLogin()) return;

  loadProfile();

  document
    .getElementById("profileForm")
    ?.addEventListener("submit", updateProfile);

  document
    .getElementById("passwordForm")
    ?.addEventListener("submit", changePassword);

  document.querySelectorAll(".toggle-password").forEach(icon => {
    icon.addEventListener("click", togglePassword);
  });
});

// =============================================
// HELPERS
// =============================================

function getCustomer() {
  try {
    return JSON.parse(
      localStorage.getItem("customerUser") || "{}"
    );
  } catch (error) {
    console.error("Invalid customer data:", error);
    return {};
  }
}

function getToken() {
  return localStorage.getItem("customerToken") || "";
}

function setField(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value ?? "";
  }
}

function getField(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function notify(icon, title, message) {
  return Swal.fire({
    icon,
    title,
    text: message,
    confirmButtonText: "OK",
    background: "#111",
    color: "#fff",
    confirmButtonColor: "#d4af37"
  });
}

async function readResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.message ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

// =============================================
// CUSTOMER AUTHENTICATION
// =============================================

function checkLogin() {
  const token = getToken();
  const user = getCustomer();

  if (!token || !user.id) {
    notify(
      "warning",
      "Login Required",
      "Please login first."
    ).then(() => {
      window.location.href = "user-login.html";
    });

    return false;
  }

  return true;
}

// =============================================
// DISPLAY CUSTOMER PROFILE
// =============================================

function displayProfile(user) {
  const name =
    user.full_name ||
    user.fullname ||
    user.username ||
    "Customer";

  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");

  if (profileName) {
    profileName.textContent = name;
  }

  if (profileEmail) {
    profileEmail.textContent = user.email || "No email";
  }

  setField("fullName", name);
  setField("email", user.email);
  setField("phone", user.phone);
  setField("username", user.username);

  setField("houseStreet", user.house_street);
  setField("barangay", user.barangay);
  setField("city", user.city);
  setField("province", user.province);
}

// =============================================
// LOAD PROFILE FROM SUPABASE THROUGH BACKEND
// =============================================

async function loadProfile() {
  const savedUser = getCustomer();

  // Display cached data immediately.
  displayProfile(savedUser);

  if (!savedUser.id) return;

  try {
    const response = await fetch(
      `${API_URL}/api/customer/profile/${encodeURIComponent(savedUser.id)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${getToken()}`
        },
        cache: "no-store"
      }
    );

    const data = await readResponse(response);

    if (!data.user) {
      throw new Error("Customer profile was not returned.");
    }

    const updatedUser = {
      ...savedUser,
      ...data.user,
      full_name:
        data.user.full_name ||
        data.user.fullname ||
        savedUser.full_name ||
        "",
      fullname:
        data.user.full_name ||
        data.user.fullname ||
        savedUser.fullname ||
        ""
    };

    localStorage.setItem(
      "customerUser",
      JSON.stringify(updatedUser)
    );

    displayProfile(updatedUser);

    console.log("Customer profile loaded successfully.");

  } catch (error) {
    console.error("LOAD PROFILE ERROR:", error);

    // Cached profile stays visible if the server fails.
    // Do not overwrite saved values with blank fields.
    notify(
      "warning",
      "Profile Loading Issue",
      error.message
    );
  }
}

// =============================================
// UPDATE CUSTOMER PROFILE
// =============================================

async function updateProfile(event) {
  event.preventDefault();

  const user = getCustomer();

  if (!user.id) {
    await notify(
      "error",
      "Session Error",
      "Please login again."
    );
    return;
  }

  const houseStreet = getField("houseStreet");
  const barangay = getField("barangay");
  const city = getField("city");
  const province = getField("province");

  const updatedUser = {
    full_name: getField("fullName"),
    email: getField("email").toLowerCase(),
    username: getField("username"),
    phone: getField("phone"),

    house_street: houseStreet,
    barangay: barangay,
    city: city,
    province: province,

    address: [
      houseStreet,
      barangay,
      city,
      province
    ].filter(Boolean).join(", ")
  };

  if (
    !updatedUser.full_name ||
    !updatedUser.email ||
    !updatedUser.username
  ) {
    await notify(
      "warning",
      "Missing Information",
      "Full name, email, and username are required."
    );
    return;
  }

  if (
    updatedUser.phone &&
    !/^09\d{9}$/.test(updatedUser.phone)
  ) {
    await notify(
      "warning",
      "Invalid Phone Number",
      "Enter a valid 11-digit Philippine mobile number starting with 09."
    );
    return;
  }

  const saveButton =
    document.querySelector('#profileForm [type="submit"]');

  if (saveButton) {
    saveButton.disabled = true;
  }

  try {
    const response = await fetch(
      `${API_URL}/api/customer/profile/${encodeURIComponent(user.id)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify(updatedUser)
      }
    );

    const data = await readResponse(response);

    if (!data.user) {
      throw new Error("Updated profile was not returned.");
    }

    const newLocalUser = {
      ...user,
      ...data.user,

      full_name:
        data.user.full_name || updatedUser.full_name,

      fullname:
        data.user.full_name || updatedUser.full_name,

      email: data.user.email ?? updatedUser.email,
      username: data.user.username ?? updatedUser.username,
      phone: data.user.phone ?? updatedUser.phone,

      house_street:
        data.user.house_street ?? updatedUser.house_street,

      barangay:
        data.user.barangay ?? updatedUser.barangay,

      city:
        data.user.city ?? updatedUser.city,

      province:
        data.user.province ?? updatedUser.province,

      address:
        data.user.address ?? updatedUser.address
    };

    localStorage.setItem(
      "customerUser",
      JSON.stringify(newLocalUser)
    );

    displayProfile(newLocalUser);

    await notify(
      "success",
      "Profile Updated",
      "Your profile has been updated successfully."
    );

  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);

    await notify(
      "error",
      "Update Failed",
      error.message
    );

  } finally {
    if (saveButton) {
      saveButton.disabled = false;
    }
  }
}

// =============================================
// CHANGE CUSTOMER PASSWORD
// =============================================

async function changePassword(event) {
  event.preventDefault();

  const user = getCustomer();

  const currentPassword =
    document.getElementById("currentPassword")?.value || "";

  const newPassword =
    document.getElementById("newPassword")?.value || "";

  const confirmPassword =
    document.getElementById("confirmPassword")?.value || "";

  if (
    !currentPassword ||
    !newPassword ||
    !confirmPassword
  ) {
    await notify(
      "warning",
      "Missing Fields",
      "Please fill in all password fields."
    );
    return;
  }

  if (newPassword.length < 6) {
    await notify(
      "warning",
      "Weak Password",
      "New password must be at least 6 characters."
    );
    return;
  }

  if (newPassword !== confirmPassword) {
    await notify(
      "warning",
      "Password Mismatch",
      "New password and confirmation do not match."
    );
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/api/customer/change-password/${encodeURIComponent(user.id)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      }
    );

    await readResponse(response);

    await notify(
      "success",
      "Password Updated",
      "Your password has been changed successfully."
    );

    document.getElementById("passwordForm")?.reset();

  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);

    await notify(
      "error",
      "Password Update Failed",
      error.message
    );
  }
}

// =============================================
// SHOW / HIDE PASSWORD
// =============================================

function togglePassword(event) {
  const icon = event.currentTarget;
  const targetId = icon.dataset.target;
  const input = document.getElementById(targetId);

  if (!input) return;

  const visible = input.type === "password";

  input.type = visible ? "text" : "password";

  icon.classList.toggle("fa-eye", !visible);
  icon.classList.toggle("fa-eye-slash", visible);
}

// =============================================
// LOGOUT
// =============================================

// Existing customer logout modal remains unchanged.
// Do not clear customerCart here.

/* =========================================================
   JCN PROFILE — MOBILE SIDEBAR
   Additive module: existing profile data/password logic untouched.
========================================================= */
(() => {
  function initProfileMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main');
    if (!sidebar || !main) return;
    if (sidebar.dataset.jcnProfileMobileReady === 'true') return;
    sidebar.dataset.jcnProfileMobileReady = 'true';

    if (!sidebar.id) sidebar.id = 'jcnProfileSidebar';

    let bar = document.querySelector('.jcn-profile-mobile-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'jcn-profile-mobile-bar';
      bar.innerHTML = `
        <button type="button" class="jcn-profile-menu-toggle" aria-label="Open navigation menu" aria-expanded="false" aria-controls="${sidebar.id}">
          <i class="fa-solid fa-bars" aria-hidden="true"></i>
        </button>
        <span class="jcn-profile-mobile-logo" aria-hidden="true">J</span>
        <span class="jcn-profile-mobile-name">JCN Apparel</span>
      `;
      main.prepend(bar);
    }
    const menuBtn = bar.querySelector('.jcn-profile-menu-toggle');
    if (!menuBtn) return;
    menuBtn.setAttribute('aria-controls', sidebar.id);

    let closeBtn = sidebar.querySelector('.jcn-profile-sidebar-close');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'jcn-profile-sidebar-close';
      closeBtn.setAttribute('aria-label', 'Close navigation menu');
      closeBtn.innerHTML = '&times;';
      sidebar.prepend(closeBtn);
    }
    let overlay = document.querySelector('.jcn-profile-menu-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'jcn-profile-menu-overlay';
      document.body.appendChild(overlay);
    }

    function closeMenu() {
      document.body.classList.remove('jcn-profile-menu-open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-label', 'Open navigation menu');
    }
    function openMenu() {
      if (window.innerWidth > 800) return;
      document.body.classList.add('jcn-profile-menu-open');
      menuBtn.setAttribute('aria-expanded', 'true');
      menuBtn.setAttribute('aria-label', 'Close navigation menu');
    }
    menuBtn.addEventListener('click', event => {
      event.preventDefault();
      if (document.body.classList.contains('jcn-profile-menu-open')) closeMenu();
      else openMenu();
    });
    closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
    sidebar.querySelectorAll('.menu a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 800) closeMenu();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfileMobileSidebar);
  } else {
    initProfileMobileSidebar();
  }
})();
