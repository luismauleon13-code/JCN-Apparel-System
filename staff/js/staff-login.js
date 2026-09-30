// =========================================================
// JCN APPAREL - STAFF LOGIN
// File: staff/js/staff-login.js
// =========================================================

const API_BASE_URL = "http://localhost:5000";

document.addEventListener("DOMContentLoaded", () => {

    // =====================================================
    // GET HTML ELEMENTS
    // =====================================================

    const loginForm = document.getElementById("staffLoginForm");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");
    const loginButton = document.getElementById("loginButton");
    const loginMessage = document.getElementById("loginMessage");


    // =====================================================
    // CHECK REQUIRED ELEMENTS
    // =====================================================

    if (!loginForm) {
        console.error("ERROR: #staffLoginForm not found.");
        return;
    }

    if (!usernameInput) {
        console.error("ERROR: #username not found.");
        return;
    }

    if (!passwordInput) {
        console.error("ERROR: #password not found.");
        return;
    }


    // =====================================================
    // IMPORTANT:
    // DO NOT AUTO REDIRECT EXISTING STAFF SESSION
    // =====================================================

    /*
        Dati may checkExistingSession() dito.

        Tinanggal natin iyon para kapag pinindot ang
        "Staff Login", palaging Staff Login page muna
        ang makikita.

        Hindi na automatic pupunta sa Inventory dashboard.
    */


    // =====================================================
    // SHOW / HIDE PASSWORD
    // =====================================================

    if (togglePassword) {

        togglePassword.addEventListener("click", () => {

            const icon = togglePassword.querySelector("i");

            if (passwordInput.type === "password") {

                passwordInput.type = "text";

                if (icon) {
                    icon.classList.remove("fa-eye");
                    icon.classList.add("fa-eye-slash");
                }

                togglePassword.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            } else {

                passwordInput.type = "password";

                if (icon) {
                    icon.classList.remove("fa-eye-slash");
                    icon.classList.add("fa-eye");
                }

                togglePassword.setAttribute(
                    "aria-label",
                    "Show password"
                );
            }
        });
    }


    // =====================================================
    // STAFF LOGIN FORM
    // =====================================================

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        clearMessage();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;


        // =================================================
        // VALIDATE USERNAME
        // =================================================

        if (!username) {

            showError("Please enter your username.");

            usernameInput.focus();

            return;
        }


        // =================================================
        // VALIDATE PASSWORD
        // =================================================

        if (!password) {

            showError("Please enter your password.");

            passwordInput.focus();

            return;
        }


        // =================================================
        // START LOADING
        // =================================================

        setLoading(true);


        try {

            console.log("=================================");
            console.log("JCN STAFF LOGIN");
            console.log("Username:", username);
            console.log(
                "API:",
                `${API_BASE_URL}/api/staff/login`
            );
            console.log("=================================");


            // =================================================
            // SEND LOGIN REQUEST TO NODE.JS
            // =================================================

            const response = await fetch(
                `${API_BASE_URL}/api/staff/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                }
            );


            // =================================================
            // CONVERT RESPONSE TO JSON
            // =================================================

            let data;

            try {

                data = await response.json();

            } catch (jsonError) {

                console.error(
                    "Invalid JSON response:",
                    jsonError
                );

                throw new Error(
                    "Invalid response from the server."
                );
            }


            console.log("Server response:", data);


            // =================================================
            // CHECK LOGIN RESULT
            // =================================================

            if (!response.ok || data.success !== true) {

                throw new Error(
                    data.message ||
                    "Invalid username or password."
                );
            }


            // =================================================
            // CHECK TOKEN
            // =================================================

            if (!data.token) {

                throw new Error(
                    "Login successful, but authentication token is missing."
                );
            }


            // =================================================
            // CHECK USER INFORMATION
            // =================================================

            if (!data.user) {

                throw new Error(
                    "Login successful, but staff information is missing."
                );
            }


            // =================================================
            // NORMALIZE ROLE
            // =================================================

            const role = String(
                data.user.role || ""
            )
                .trim()
                .toLowerCase();


            // =================================================
            // NORMALIZE STATUS
            // =================================================

            const status = String(
                data.user.status || ""
            )
                .trim()
                .toLowerCase();


            console.log("Staff ID:", data.user.id);
            console.log(
                "Staff username:",
                data.user.username
            );
            console.log("Staff role:", role);
            console.log("Staff status:", status);


            // =================================================
            // CHECK STAFF STATUS
            // =================================================

            if (status !== "active") {

                clearStaffSession();

                throw new Error(
                    "Your staff account is inactive or restricted."
                );
            }


            
// =================================================
// INVENTORY STAFF
// =================================================

if (role === "inventory_staff") {

    // Remove old staff session
    clearStaffSession();

    // Save authenticated Inventory Staff session
    saveStaffSession(
        data.token,
        data.user
    );

    console.log(
        "Inventory Staff login successful."
    );

    console.log(
        "Redirecting to Inventory Product page..."
    );

    showSuccess(
        "Welcome Inventory Staff!",
        "Login successful. Opening Inventory Management..."
    );

    // Redirect to the EXISTING Inventory page
    setTimeout(() => {

        window.location.href =
            "../../Inventory/html/inventory-product.html";

    }, 800);

    return;
}


            // =================================================
            // GRAPHIC DESIGNER
            // =================================================

            if (role === "graphic_designer") {

                clearStaffSession();

                throw new Error(
                    "Graphic Designer Dashboard is not available yet."
                );
            }


            // =================================================
            // CASHIER
            // =================================================

            if (role === "cashier") {

                clearStaffSession();

                throw new Error(
                    "Cashier Dashboard is not available yet."
                );
            }


            // =================================================
            // ADMIN
            // =================================================

            if (role === "admin") {

                clearStaffSession();

                throw new Error(
                    "Admin accounts must use the Admin Login."
                );
            }


            // =================================================
            // UNKNOWN ROLE
            // =================================================

            clearStaffSession();

            throw new Error(
                `Unknown or unauthorized staff role: ${
                    data.user.role || "No role"
                }`
            );


        } catch (error) {

            console.error(
                "STAFF LOGIN ERROR:",
                error
            );


            showError(
                error.message ||
                "Unable to login. Please try again."
            );


            setLoading(false);
        }
    });


    // =====================================================
    // SAVE STAFF SESSION
    // =====================================================

    function saveStaffSession(token, user) {

        localStorage.setItem(
            "staffToken",
            token
        );


        localStorage.setItem(
            "staffUser",
            JSON.stringify(user)
        );


        console.log(
            "Staff session saved successfully."
        );
    }


    // =====================================================
    // CLEAR STAFF SESSION
    // =====================================================

    function clearStaffSession() {

        localStorage.removeItem(
            "staffToken"
        );


        localStorage.removeItem(
            "staffUser"
        );
    }


    // =====================================================
    // CLEAR LOGIN MESSAGE
    // =====================================================

    function clearMessage() {

        if (!loginMessage) {
            return;
        }


        loginMessage.textContent = "";

        loginMessage.className =
            "login-message";
    }


    // =====================================================
    // SHOW ERROR
    // =====================================================

    function showError(message) {

        if (loginMessage) {

            loginMessage.textContent =
                message;


            loginMessage.className =
                "login-message error";
        }


        if (typeof Swal !== "undefined") {

            Swal.fire({

                icon: "error",

                title: "Login Failed",

                text: message,

                background: "#111111",

                color: "#ffffff",

                confirmButtonText: "OK",

                confirmButtonColor: "#d4af37"

            });
        }
    }


    // =====================================================
    // SHOW SUCCESS
    // =====================================================

    function showSuccess(title, message) {

        if (loginMessage) {

            loginMessage.textContent =
                "Login successful. Redirecting...";


            loginMessage.className =
                "login-message success";
        }


        if (typeof Swal !== "undefined") {

            Swal.fire({

                icon: "success",

                title: title,

                text: message,

                background: "#111111",

                color: "#ffffff",

                showConfirmButton: false,

                timer: 700,

                timerProgressBar: true

            });
        }
    }


    // =====================================================
    // LOGIN BUTTON LOADING
    // =====================================================

    function setLoading(isLoading) {

        if (!loginButton) {
            return;
        }


        loginButton.disabled =
            isLoading;


        if (isLoading) {

            loginButton.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Signing In...</span>
            `;

        } else {

            loginButton.innerHTML = `
                <i class="fa-solid fa-right-to-bracket"></i>
                <span>Sign In</span>
            `;
        }
    }

});