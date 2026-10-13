const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const axios = require("axios");
const multer = require("multer");
const nodemailer = require("nodemailer");

const upload = multer({
  storage: multer.memoryStorage()
});

const supabase = require("./backend/config/supabaseClient");

const app = express();

app.use(cors());
app.use(express.json({ limit: "8mb" }));
const otpStore = {};
const resetOtps = {};

// =========================================================
// AUTHENTICATION MIDDLEWARE
// =========================================================

async function verifyStaffToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);

  if (!match) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue."
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Server authentication is not configured."
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(
      match[1],
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session. Please log in again."
    });
  }

  const allowedRoles = [
    "admin",
    "inventory_staff",
    "graphic_designer",
    "cashier"
  ];

  const tokenRole = String(decoded?.role || "")
    .trim()
    .toLowerCase();

  if (!decoded?.id || !allowedRoles.includes(tokenRole)) {
    return res.status(403).json({
      success: false,
      message: "This account is not authorized for this portal."
    });
  }

  let account;

  try {
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, username, full_name, email, role, status")
      .eq("id", decoded.id)
      .maybeSingle();

    if (error) {
      console.error("ACCOUNT CHECK ERROR:", error.message);

      return res.status(503).json({
        success: false,
        message: "Unable to verify your account. Please try again."
      });
    }

    account = data;
  } catch (error) {
    console.error("ACCOUNT CHECK ERROR:", error.message);

    return res.status(503).json({
      success: false,
      message: "Unable to verify your account. Please try again."
    });
  }

  if (!account) {
    return res.status(401).json({
      success: false,
      message: "Account no longer exists. Please log in again."
    });
  }

  const databaseRole = String(account.role || "")
    .trim()
    .toLowerCase();

  const databaseStatus = String(account.status || "")
    .trim()
    .toLowerCase();

  if (databaseStatus !== "active") {
    return res.status(403).json({
      success: false,
      message: "Your account is inactive or restricted."
    });
  }

  if (
    !allowedRoles.includes(databaseRole) ||
    databaseRole !== tokenRole
  ) {
    return res.status(401).json({
      success: false,
      message:
        "Your account permissions have changed. Please log in again."
    });
  }

  req.staff = {
    ...account,
    role: databaseRole,
    status: databaseStatus
  };

  return next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({
        success: false,
        message: "Please log in to continue."
      });
    }

    const role = String(req.staff.role || "")
      .trim()
      .toLowerCase();

    if (!roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource."
      });
    }

    return next();
  };
}

// =========================================================
// CUSTOMER JWT AUTH - GRAPHIC DESIGN SUBMISSION
// Matches /api/auth/customer-login: HS256, JWT_SECRET, id, role=customer.
// =========================================================
async function verifyCustomerToken(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
  if (!match) {
    return res.status(401).json({ success: false, message: "Please log in as a customer." });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ success: false, message: "Server authentication is not configured." });
  }
  let decoded;
  try {
    decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired customer session." });
  }
  if (!decoded?.id || String(decoded.role || "").toLowerCase() !== "customer") {
    return res.status(403).json({ success: false, message: "Customer access only." });
  }
  try {
    const { data: customer, error } = await supabase.from("customer_users")
      .select("id, full_name, username, email, status")
      .eq("id", decoded.id).maybeSingle();
    if (error) throw error;
    if (!customer) return res.status(401).json({ success: false, message: "Customer account not found." });
    if (String(customer.status || "").toLowerCase() !== "active") {
      return res.status(403).json({ success: false, message: "Customer account is not active." });
    }
    req.customer = { ...customer, role: "customer" };
    return next();
  } catch (error) {
    console.error("CUSTOMER TOKEN ACCOUNT CHECK ERROR:", error.message);
    return res.status(503).json({ success: false, message: "Unable to verify customer account." });
  }
}

// Public login aliases must be registered before the admin token guard.
app.post(["/api/auth/admin-login", "/api/admin/login"], async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Server authentication is not configured."
      });
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("username", username.trim())
      .maybeSingle();

    if (error) {
      console.error("ADMIN LOGIN DATABASE ERROR:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to check your account."
      });
    }

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const storedPassword = String(admin.password || "");

    const passwordMatch = storedPassword.startsWith("$2")
      ? await bcrypt.compare(password, storedPassword)
      : storedPassword !== "" && password === storedPassword;

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const role = String(admin.role || "").trim().toLowerCase();
    const status = String(admin.status || "").trim().toLowerCase();

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Staff accounts must use the Staff Login."
      });
    }

    if (status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your admin account is inactive or restricted."
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role
      },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "8h"
      }
    );

    return res.status(200).json({
      success: true,
      message: "Admin login successful.",
      token,
      user: {
        id: admin.id,
        username: admin.username,
        full_name: admin.full_name,
        email: admin.email,
        role,
        status
      }
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to log in. Please try again."
    });
  }
});

// Protect admin routes, while keeping the current dashboard/product
// compatibility endpoints working with the existing frontend.
// Product READ is public because customers must be able to view products.
// Product WRITE routes are protected again at route level for inventory staff/admin.
app.use("/api/admin", (req, res, next) => {
  const method = String(req.method || "GET").toUpperCase();
  const path = String(req.path || "");

  // Products are handled by their own route-level permissions below.
  if (path === "/products" || path.startsWith("/products/")) {
    return next();
  }

  // Current admin dashboard JS calls these without an Authorization header.
  // Keep only these read-only dashboard endpoints compatible.
  if (
    method === "GET" &&
    (path === "/overview" || path === "/sales-summary")
  ) {
    return next();
  }

  return verifyStaffToken(req, res, () => {
    return allowRoles("admin")(req, res, next);
  });
});

app.get("/api/admin/session", (req, res) => {
  res.json({
    success: true,
    user: req.staff
  });
});

// =========================================================
// EMAIL / SMS
// =========================================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendSMS(number, message) {
  await axios.post(
    "https://api.semaphore.co/api/v4/messages",
    new URLSearchParams({
      apikey: process.env.SEMAPHORE_API_KEY,
      number,
      message
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
}

// =========================================================
// CUSTOMER — REGISTRATION OTP
// =========================================================

function normalizeRegistrationEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function generateRegistrationOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// =========================================================
// CUSTOMER — SEND REGISTRATION OTP
// =========================================================

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const {
      email,
      username,
      phone,
      otp_method
    } = req.body || {};

    const cleanEmail = normalizeRegistrationEmail(email);
    const cleanUsername = String(username || "").trim();
    const cleanPhone = String(phone || "").trim();
    const cleanOtpMethod = String(otp_method || "")
      .trim()
      .toLowerCase();

    if (!cleanEmail || !cleanUsername || !cleanPhone || !cleanOtpMethod) {
      return res.status(400).json({
        success: false,
        message: "Email, username, phone, and OTP method are required."
      });
    }

    if (!["email", "sms"].includes(cleanOtpMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP method."
      });
    }

    const { data: existingUsers, error: existingError } = await supabase
      .from("customer_users")
      .select("id, email, username, phone")
      .or(
        `email.eq.${cleanEmail},username.eq.${cleanUsername},phone.eq.${cleanPhone}`
      );

    if (existingError) throw existingError;

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      const errors = [];

      const emailExists = existingUsers.some(
        user => normalizeRegistrationEmail(user.email) === cleanEmail
      );

      const usernameExists = existingUsers.some(
        user => String(user.username || "").trim() === cleanUsername
      );

      const phoneExists = existingUsers.some(
        user => String(user.phone || "").trim() === cleanPhone
      );

      if (emailExists) errors.push("Email is already registered");
      if (usernameExists) errors.push("Username is already taken");
      if (phoneExists) errors.push("Phone number is already registered");

      return res.status(409).json({
        success: false,
        message: errors.join(" • ") || "Account information is already registered."
      });
    }

    const otp = generateRegistrationOtp();

    otpStore[cleanEmail] = {
      otp,
      otp_method: cleanOtpMethod,
      phone: cleanPhone,
      username: cleanUsername,
      verified: false,
      verifiedAt: null,
      expiresAt: Date.now() + 5 * 60 * 1000
    };

    console.log("REGISTRATION OTP CREATED:", {
      email: cleanEmail,
      otp,
      expiresAt: otpStore[cleanEmail].expiresAt
    });

    if (cleanOtpMethod === "email") {
      await transporter.sendMail({
        from: `"JCN Apparel" <${process.env.EMAIL_USER}>`,
        to: cleanEmail,
        subject: "JCN Email Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 24px;">
            <h2>JCN Apparel Email Verification</h2>
            <p>Use the verification code below to complete your registration:</p>
            <div style="font-size: 34px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">
              ${otp}
            </div>
            <p>This code will expire in <strong>5 minutes</strong>.</p>
            <p>If you did not request this code, you can ignore this email.</p>
          </div>
        `
      });
    }

    if (cleanOtpMethod === "sms") {
      await sendSMS(
        cleanPhone,
        `Your JCN verification code is ${otp}. It will expire in 5 minutes.`
      );
    }

    return res.status(200).json({
      success: true,
      message:
        cleanOtpMethod === "sms"
          ? "OTP sent to your phone number."
          : "OTP sent to your email."
    });
  } catch (error) {
    console.error("SEND REGISTRATION OTP ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to send verification code."
    });
  }
});

// =========================================================
// CUSTOMER — VERIFY REGISTRATION OTP
// =========================================================

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    const cleanEmail = normalizeRegistrationEmail(email);
    const cleanOtp = String(otp || "").trim();

    if (!cleanEmail || !cleanOtp) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: "Email and verification code are required."
      });
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: "Verification code must contain exactly 6 digits."
      });
    }

    const storedOtp = otpStore[cleanEmail];

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: "No verification request found. Please request a new code."
      });
    }

    if (Date.now() > Number(storedOtp.expiresAt)) {
      delete otpStore[cleanEmail];

      return res.status(400).json({
        success: false,
        verified: false,
        message: "Verification code has expired. Please request a new code."
      });
    }

    if (String(storedOtp.otp) !== cleanOtp) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: "Invalid verification code."
      });
    }

    storedOtp.verified = true;
    storedOtp.verifiedAt = Date.now();

    console.log("REGISTRATION OTP VERIFIED:", cleanEmail);

    return res.status(200).json({
      success: true,
      verified: true,
      message: "Email verified successfully."
    });
  } catch (error) {
    console.error("VERIFY REGISTRATION OTP ERROR:", error);

    return res.status(500).json({
      success: false,
      verified: false,
      message: error.message || "Unable to verify the code."
    });
  }
});

// =========================================================
// CUSTOMER — RESEND REGISTRATION OTP
// =========================================================

app.post("/api/auth/resend-otp", async (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = normalizeRegistrationEmail(email);

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Email is required."
      });
    }

    const previousOtp = otpStore[cleanEmail];

    if (!previousOtp) {
      return res.status(400).json({
        success: false,
        message: "Verification session was not found. Please register again."
      });
    }

    const newOtp = generateRegistrationOtp();

    otpStore[cleanEmail] = {
      ...previousOtp,
      otp: newOtp,
      verified: false,
      verifiedAt: null,
      expiresAt: Date.now() + 5 * 60 * 1000
    };

    if (previousOtp.otp_method === "email") {
      await transporter.sendMail({
        from: `"JCN Apparel" <${process.env.EMAIL_USER}>`,
        to: cleanEmail,
        subject: "JCN New Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 24px;">
            <h2>JCN Apparel Email Verification</h2>
            <p>Your new verification code is:</p>
            <div style="font-size: 34px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">
              ${newOtp}
            </div>
            <p>This code will expire in <strong>5 minutes</strong>.</p>
          </div>
        `
      });
    }

    if (previousOtp.otp_method === "sms") {
      if (!previousOtp.phone) {
        return res.status(400).json({
          success: false,
          message: "Phone number was not found for this verification request."
        });
      }

      await sendSMS(
        previousOtp.phone,
        `Your new JCN verification code is ${newOtp}. It will expire in 5 minutes.`
      );
    }

    console.log("REGISTRATION OTP RESENT:", {
      email: cleanEmail,
      otp: newOtp
    });

    return res.status(200).json({
      success: true,
      message:
        previousOtp.otp_method === "sms"
          ? "A new verification code was sent to your phone."
          : "A new verification code was sent to your email."
    });
  } catch (error) {
    console.error("RESEND REGISTRATION OTP ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to resend verification code."
    });
  }
});

// =========================================================
// CUSTOMER — REGISTER AFTER OTP
// =========================================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      phone,
      email,
      username,
      password,
      otp
    } = req.body || {};

    const cleanFirstName = String(firstName || "").trim();
    const cleanMiddleName = String(middleName || "").trim();
    const cleanLastName = String(lastName || "").trim();
    const cleanPhone = String(phone || "").trim();
    const cleanEmail = normalizeRegistrationEmail(email);
    const cleanUsername = String(username || "").trim();
    const cleanPassword = String(password || "");
    const cleanOtp = String(otp || "").trim();

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanPhone ||
      !cleanEmail ||
      !cleanUsername ||
      !cleanPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be completed."
      });
    }

    const storedOtp = otpStore[cleanEmail];

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: "Please request a verification code first."
      });
    }

    if (Date.now() > Number(storedOtp.expiresAt)) {
      delete otpStore[cleanEmail];

      return res.status(400).json({
        success: false,
        message: "Verification code expired. Please request a new one."
      });
    }

    // Supports both flows:
    // 1) /verify-otp was called first, then /register.
    // 2) /register receives the OTP directly.
    if (storedOtp.verified !== true) {
      if (!cleanOtp) {
        return res.status(400).json({
          success: false,
          message: "Please verify your email first."
        });
      }

      if (String(storedOtp.otp) !== cleanOtp) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification code."
        });
      }

      storedOtp.verified = true;
      storedOtp.verifiedAt = Date.now();
    }

    if (
      storedOtp.username &&
      String(storedOtp.username).trim() !== cleanUsername
    ) {
      return res.status(400).json({
        success: false,
        message: "Username does not match the verified registration request."
      });
    }

    if (
      storedOtp.phone &&
      String(storedOtp.phone).trim() !== cleanPhone
    ) {
      return res.status(400).json({
        success: false,
        message: "Phone number does not match the verified registration request."
      });
    }

    const { data: existingUsers, error: existingError } = await supabase
      .from("customer_users")
      .select("id, email, username, phone")
      .or(
        `email.eq.${cleanEmail},username.eq.${cleanUsername},phone.eq.${cleanPhone}`
      );

    if (existingError) throw existingError;

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email, username, or phone number is already registered."
      });
    }

    const fullName = [
      cleanFirstName,
      cleanMiddleName,
      cleanLastName
    ]
      .filter(Boolean)
      .join(" ");

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const { data: newUser, error: insertError } = await supabase
      .from("customer_users")
      .insert([
        {
          full_name: fullName,
          first_name: cleanFirstName,
          middle_name: cleanMiddleName,
          last_name: cleanLastName,
          phone: cleanPhone,
          email: cleanEmail,
          username: cleanUsername,
          password: hashedPassword,
          status: "active"
        }
      ])
      .select("id, full_name, email, username, phone, status")
      .single();

    if (insertError) {
      return res.status(400).json({
        success: false,
        message: insertError.message
      });
    }

    delete otpStore[cleanEmail];

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: newUser
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to complete registration."
    });
  }
});

// =========================================================
// CUSTOMER LOGIN
// =========================================================

app.post("/api/auth/customer-login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required"
      });
    }

    const cleanUsername = username.trim();

    const { data: customer, error } = await supabase
      .from("customer_users")
      .select("*")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (error) {
      console.error("CUSTOMER LOGIN DB ERROR:", error);

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }

    if (!customer.password) {
      return res.status(401).json({
        success: false,
        message: "This account has no password saved."
      });
    }

    const storedPassword = String(customer.password).trim();

    const passwordMatch = storedPassword.startsWith("$2")
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword;

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }

    if (customer.status === "restricted") {
      return res.status(403).json({
        success: false,
        message: "Your account has been restricted by admin."
      });
    }

    const { error: updateLoginError } = await supabase
      .from("customer_users")
      .update({
        last_login: new Date().toISOString(),
        status: "active"
      })
      .eq("id", customer.id);

    if (updateLoginError) {
      return res.status(500).json({
        success: false,
        message: updateLoginError.message
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: "Server authentication is not configured." });
    }

    const token = jwt.sign(
      {
        id: customer.id,
        username: customer.username,
        role: "customer"
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      message: "Customer login successful",
      token,
      user: {
        id: customer.id,
        fullname: customer.full_name,
        email: customer.email,
        username: customer.username,
        status: "active",
        role: "customer"
      }
    });
  } catch (error) {
    console.error("CUSTOMER LOGIN SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// =========================================================
// CUSTOMER PASSWORD RESET
// =========================================================

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required."
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const savedOtp = resetOtps[cleanEmail];

    if (!savedOtp) {
      return res.status(400).json({
        success: false,
        message: "No OTP request found."
      });
    }

    if (Date.now() > savedOtp.expires) {
      delete resetOtps[cleanEmail];

      return res.status(400).json({
        success: false,
        message: "OTP expired."
      });
    }

    if (savedOtp.otp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP."
      });
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;

    if (!strongPassword.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character."
      });
    }

    const { error } = await supabase
      .from("customer_users")
      .update({
        password: newPassword
      })
      .ilike("email", cleanEmail);

    if (error) throw error;

    delete resetOtps[cleanEmail];

    res.json({
      success: true,
      message: "Customer password reset successfully."
    });
  } catch (error) {
    console.error("CUSTOMER RESET PASSWORD ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || email.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Email is required."
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const { data: user, error } = await supabase
      .from("customer_users")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: "Customer email not found."
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    resetOtps[cleanEmail] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    };

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: cleanEmail,
      subject: "JCN Customer Password Reset OTP",
      html: `
        <h2>JCN Password Reset</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>Valid for 5 minutes only.</p>
      `
    });

    res.json({
      success: true,
      message: "OTP sent to customer email."
    });
  } catch (error) {
    console.error("CUSTOMER FORGOT PASSWORD ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// ADMIN PASSWORD RESET
// =========================================================

app.post("/api/auth/admin-reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required."
      });
    }

    const savedOtp = resetOtps[email];

    if (!savedOtp) {
      return res.status(400).json({
        success: false,
        message: "No OTP request found."
      });
    }

    if (Date.now() > savedOtp.expires) {
      delete resetOtps[email];

      return res.status(400).json({
        success: false,
        message: "OTP expired."
      });
    }

    if (savedOtp.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP."
      });
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;

    if (!strongPassword.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character."
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error } = await supabase
      .from("admin_users")
      .update({
        password: hashedPassword
      })
      .eq("email", email);

    if (error) throw error;

    delete resetOtps[email];

    res.json({
      success: true,
      message: "Admin password reset successfully."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.post("/api/auth/admin-forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required."
      });
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !admin) {
      return res.status(404).json({
        success: false,
        message: "Admin email not found."
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    resetOtps[email] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    };

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "JCN Password Reset OTP",
      html: `
        <h2>Password Reset</h2>
        <p>Your OTP code is:</p>
        <h1>${otp}</h1>
        <p>This code will expire in 5 minutes.</p>
      `
    });

    res.json({
      success: true,
      message: "OTP sent to your email."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// ADMIN — STAFF MANAGEMENT
// =========================================================

const STAFF_ROLES = [
  "inventory_staff",
  "graphic_designer",
  "cashier"
];

const STAFF_STATUSES = [
  "active",
  "inactive",
  "restricted"
];

app.get(
  "/api/admin/staff",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { data: staff, error } = await supabase
        .from("admin_users")
        .select(`
          id, full_name, username, email, role,
          status, last_login_at, created_at
        `)
        .in("role", STAFF_ROLES)
        .order("created_at", { ascending: false });

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      const staffList = staff || [];

      const counts = {
        total: staffList.length,
        inventory: staffList.filter(
          user => user.role === "inventory_staff"
        ).length,
        designers: staffList.filter(
          user => user.role === "graphic_designer"
        ).length,
        cashiers: staffList.filter(
          user => user.role === "cashier"
        ).length
      };

      return res.json({
        success: true,
        staff: staffList,
        counts
      });
    } catch (error) {
      console.error("GET STAFF SERVER ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Server error."
      });
    }
  }
);

app.post(
  "/api/admin/staff",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const {
        full_name,
        username,
        email,
        password,
        role,
        status
      } = req.body;

      if (!full_name || !username || !email || !password || !role) {
        return res.status(400).json({
          success: false,
          message:
            "Full name, username, email, password, and role are required."
        });
      }

      const cleanFullName = full_name.trim();
      const cleanUsername = username.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanRole = role.trim();
      const cleanStatus = status || "active";

      if (!STAFF_ROLES.includes(cleanRole)) {
        return res.status(400).json({
          success: false,
          message: "Invalid staff role."
        });
      }

      if (!STAFF_STATUSES.includes(cleanStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid staff status."
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least 8 characters."
        });
      }

      const {
        data: existingUsername,
        error: usernameCheckError
      } = await supabase
        .from("admin_users")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (usernameCheckError) {
        return res.status(400).json({
          success: false,
          message: usernameCheckError.message
        });
      }

      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: "Username is already in use."
        });
      }

      const {
        data: existingEmail,
        error: emailCheckError
      } = await supabase
        .from("admin_users")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (emailCheckError) {
        return res.status(400).json({
          success: false,
          message: emailCheckError.message
        });
      }

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Email address is already in use."
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const {
        data: newStaff,
        error: insertError
      } = await supabase
        .from("admin_users")
        .insert([
          {
            full_name: cleanFullName,
            username: cleanUsername,
            email: cleanEmail,
            password: hashedPassword,
            role: cleanRole,
            status: cleanStatus
          }
        ])
        .select(`
          id, full_name, username, email, role,
          status, last_login_at, created_at
        `)
        .single();

      if (insertError) {
        return res.status(400).json({
          success: false,
          message: insertError.message
        });
      }

      return res.status(201).json({
        success: true,
        message: "Staff account created successfully.",
        staff: newStaff
      });
    } catch (error) {
      console.error("CREATE STAFF SERVER ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Server error while creating staff account."
      });
    }
  }
);

app.patch(
  "/api/admin/staff/:id",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { full_name, email, role } = req.body;

      if (!full_name || !email || !role) {
        return res.status(400).json({
          success: false,
          message: "Full name, email, and role are required."
        });
      }

      if (!STAFF_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid staff role."
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      const {
        data: existingEmail,
        error: emailCheckError
      } = await supabase
        .from("admin_users")
        .select("id")
        .eq("email", cleanEmail)
        .neq("id", id)
        .maybeSingle();

      if (emailCheckError) {
        return res.status(400).json({
          success: false,
          message: emailCheckError.message
        });
      }

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Email address is already in use."
        });
      }

      const { data, error } = await supabase
        .from("admin_users")
        .update({
          full_name: full_name.trim(),
          email: cleanEmail,
          role
        })
        .eq("id", id)
        .in("role", STAFF_ROLES)
        .select(`
          id, full_name, username, email, role,
          status, last_login_at, created_at
        `)
        .maybeSingle();

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Staff account not found."
        });
      }

      return res.json({
        success: true,
        message: "Staff information updated successfully.",
        staff: data
      });
    } catch (error) {
      console.error("UPDATE STAFF SERVER ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Server error."
      });
    }
  }
);

app.patch(
  "/api/admin/staff/:id/status",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!STAFF_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid staff status."
        });
      }

      const { data, error } = await supabase
        .from("admin_users")
        .update({ status })
        .eq("id", id)
        .in("role", STAFF_ROLES)
        .select(`
          id, full_name, username, email,
          role, status, last_login_at
        `)
        .maybeSingle();

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Staff account not found."
        });
      }

      return res.json({
        success: true,
        message: "Staff status updated successfully.",
        staff: data
      });
    } catch (error) {
      console.error("STAFF STATUS SERVER ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Server error."
      });
    }
  }
);

app.patch(
  "/api/admin/staff/:id/password",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: "New password is required."
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least 8 characters."
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const { data, error } = await supabase
        .from("admin_users")
        .update({
          password: hashedPassword
        })
        .eq("id", id)
        .in("role", STAFF_ROLES)
        .select("id, full_name, username, email, role, status")
        .maybeSingle();

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Staff account not found."
        });
      }

      return res.json({
        success: true,
        message: "Staff password updated successfully."
      });
    } catch (error) {
      console.error("STAFF PASSWORD SERVER ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Server error."
      });
    }
  }
);

app.delete(
  "/api/admin/staff/:id",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from("admin_users")
        .delete()
        .eq("id", id)
        .in("role", STAFF_ROLES)
        .select("id, full_name, username, role")
        .maybeSingle();

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Staff account not found."
        });
      }

      return res.json({
        success: true,
        message: "Staff account deleted successfully."
      });
    } catch (error) {
      console.error("DELETE STAFF SERVER ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Server error."
      });
    }
  }
);

// =========================================================
// STAFF LOGIN
// =========================================================

app.post("/api/staff/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    const cleanUsername = username.trim();

    const { data: staff, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (error) {
      console.error("STAFF LOGIN DATABASE ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Database error."
      });
    }

    if (!staff) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const allowedStaffRoles = [
      "inventory_staff",
      "graphic_designer",
      "cashier"
    ];

    if (!allowedStaffRoles.includes(staff.role)) {
      return res.status(403).json({
        success: false,
        message: "This account is not authorized for the Staff Portal."
      });
    }

    if (staff.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your staff account is currently inactive or restricted."
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      staff.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const token = jwt.sign(
      {
        id: staff.id,
        username: staff.username,
        role: staff.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    const loginTime = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("admin_users")
      .update({
        last_login_at: loginTime
      })
      .eq("id", staff.id);

    if (updateError) {
      console.error("LAST LOGIN UPDATE ERROR:", updateError);
    }

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: staff.id,
        full_name: staff.full_name,
        username: staff.username,
        email: staff.email,
        role: staff.role,
        status: staff.status,
        last_login_at: loginTime
      }
    });
  } catch (error) {
    console.error("STAFF LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
});

// =========================================================
// ADMIN DASHBOARD OVERVIEW
// =========================================================

app.get("/api/admin/overview", async (req, res) => {
  try {
    const {
      count: totalUsers,
      error: usersError
    } = await supabase
      .from("customer_users")
      .select("*", { count: "exact", head: true });

    if (usersError) throw usersError;

    const {
      count: pendingOrders,
      error: pendingError
    } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["Preparing", "Processing"]);

    if (pendingError) throw pendingError;

    const {
      count: completedOrders,
      error: completedError
    } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "Completed");

    if (completedError) throw completedError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const {
      data: salesData,
      error: salesError
    } = await supabase
      .from("orders")
      .select("total_amount, created_at")
      .eq("status", "Completed")
      .gte("created_at", today.toISOString());

    if (salesError) throw salesError;

    const todayRevenue = (salesData || []).reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0
    );

    const {
      data: recentOrders,
      error: recentError
    } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentError) throw recentError;

    const {
      data: recentAnnouncements,
      error: announcementError
    } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (announcementError) throw announcementError;

    const recentActivity = [
      ...(recentOrders || []).map(order => ({
        type: "order",
        id: order.id,
        order_number: order.order_number || null,
        customer_name: order.customer_name || "Customer",
        total_amount: Number(order.total_amount || 0),
        status: order.status || "Order",
        created_at: order.created_at,
        message: `${order.customer_name || "Customer"} placed ${order.order_number || "an order"}`
      })),
      ...(recentAnnouncements || []).map(announcement => ({
        type: "announcement",
        id: announcement.id,
        title: announcement.title || "Announcement",
        message: announcement.message || "",
        created_at: announcement.created_at
      }))
    ]
      .filter(item => item.created_at)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )
      .slice(0, 10);

    return res.json({
      success: true,
      totalUsers: totalUsers || 0,
      pendingOrders: pendingOrders || 0,
      completedOrders: completedOrders || 0,
      revenue: todayRevenue,
      recentOrders: recentOrders || [],
      recentAnnouncements: recentAnnouncements || [],
      recentActivity,
      activities: recentActivity
    });
  } catch (error) {
    console.error("ADMIN OVERVIEW ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// SALES SUMMARY
// =========================================================

app.get("/api/admin/sales-summary", async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("total_amount, created_at")
      .eq("status", "Completed");

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    const now = new Date();

    let today = 0;
    let week = 0;
    let month = 0;
    let yearly = 0;

    (orders || []).forEach(order => {
      const amount = Number(order.total_amount || 0);
      const date = new Date(order.created_at);

      if (date.toDateString() === now.toDateString()) {
        today += amount;
      }

      const diffDays = (now - date) / (1000 * 60 * 60 * 24);

      if (diffDays <= 7) {
        week += amount;
      }

      if (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      ) {
        month += amount;
      }

      if (date.getFullYear() === now.getFullYear()) {
        yearly += amount;
      }
    });

    res.json({
      success: true,
      today,
      week,
      month,
      quarterly: month * 3,
      yearly
    });
  } catch (error) {
    console.error("SALES SUMMARY ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// =========================================================
// CREATE ORDER
// Existing inventory RPC handles order creation and stock.
// =========================================================

app.post("/api/orders", async (req, res) => {
  try {
    const {
      user_id,
      customer_name,
      customer_email,
      customer_phone,
      total_amount,
      payment_method,
      items
    } = req.body;

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      !["PayPal", "COD"].includes(payment_method) ||
      !Number.isFinite(Number(total_amount)) ||
      Number(total_amount) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid items, payment method and total amount are required."
      });
    }

    const { data, error } = await supabase.rpc(
      "jcn_inventory_create_order",
      {
        p_payload: {
          user_id: user_id || null,
          customer_name,
          customer_email,
          customer_phone,
          total_amount,
          payment_method,
          items
        }
      }
    );

    if (error) throw error;

    return res.json({
      success: true,
      message: "Order placed successfully.",
      order: data
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error.message);

    return res
      .status(error.code === "P0001" ? 400 : 500)
      .json({
        success: false,
        message:
          error.code === "P0001"
            ? error.message
            : "Could not create order. Check inventory migration and server logs."
      });
  }
});

// =========================================================
// CUSTOMER ORDERS
// =========================================================

app.get("/api/customer/orders/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      orders: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Existing cancellation route from the supplied server.
app.patch("/api/customer/orders/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("orders")
      .update({ status: "Cancelled" })
      .eq("id", id)
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Order cancelled successfully.",
      order: data[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// CASHIER — LIVE ORDER LIST
// =========================================================

app.get(
  "/api/cashier/orders",
  verifyStaffToken,
  allowRoles("cashier", "admin"),
  async (req, res) => {
    try {
      // ----------------------------------------------------
      // PAGINATION
      // ----------------------------------------------------
      const requestedPage = Number(req.query.page);
      const requestedLimit = Number(req.query.limit);

      const page =
        Number.isSafeInteger(requestedPage) && requestedPage > 0
          ? requestedPage
          : 1;

      const limit =
        Number.isSafeInteger(requestedLimit) && requestedLimit > 0
          ? Math.min(requestedLimit, 100)
          : 10;

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) {
        return res.status(400).json({
          success: false,
          message: "Invalid page number."
        });
      }

      // ----------------------------------------------------
      // FILTERS
      // ----------------------------------------------------
      const search = String(req.query.search || "")
        .trim()
        .slice(0, 120);

      const requestedStatus = String(req.query.payment_status || "")
        .trim()
        .toLowerCase();

      const paymentStatuses = {
        paid: "Paid",
        pending: "Pending",
        unpaid: "Unpaid"
      };

      const paymentStatus = Object.prototype.hasOwnProperty.call(
        paymentStatuses,
        requestedStatus
      )
        ? paymentStatuses[requestedStatus]
        : null;

      if (requestedStatus && !paymentStatus) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment status."
        });
      }

      // ----------------------------------------------------
      // DATABASE QUERY
      // Do not select order_number: that column does not exist.
      // ----------------------------------------------------
      let query = supabase
        .from("orders")
        .select(
          `
            id,
            customer_name,
            customer_email,
            total_amount,
            payment_method,
            payment_status,
            status,
            created_at
          `,
          { count: "exact" }
        );

      if (paymentStatus) {
        query = query.eq("payment_status", paymentStatus);
      }

      if (search) {
        // Escape LIKE wildcards so input is treated literally.
        const escapedSearch = search.replace(
          /[\\%_]/g,
          (character) => `\\${character}`
        );

        query = query.ilike(
          "customer_name",
          `%${escapedSearch}%`
        );
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("CASHIER ORDERS ERROR:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });

        return res.status(500).json({
          success: false,
          message: "Unable to load cashier orders."
        });
      }

      // ----------------------------------------------------
      // RESPONSE FOR THE EXISTING CASHIER DASHBOARD
      // ----------------------------------------------------
      const orders = (data || []).map((order) => {
        const payment = String(order.payment_status || "")
          .trim()
          .toLowerCase();

        const status = String(order.status || "")
          .trim()
          .toLowerCase();

        const total = Number(order.total_amount);

        // Assumes the existing full-payment model.
        // Unknown states keep an unknown outstanding balance.
        let amountDue = null;

        if (payment === "paid" || status === "cancelled") {
          amountDue = 0;
        } else if (
          ["pending", "unpaid"].includes(payment) &&
          order.total_amount != null &&
          Number.isFinite(total) &&
          total >= 0
        ) {
          amountDue = total;
        }

        return {
          id: order.id,

          // Frontend compatibility field.
          // This is derived from id, not a database column.
          order_number: String(order.id),

          customer_name: order.customer_name,
          customer_email: order.customer_email,
          total_amount: order.total_amount,
          payment_method: order.payment_method,
          payment_status: order.payment_status,
          status: order.status,
          created_at: order.created_at,
          amount_due: amountDue
        };
      });

      return res.status(200).json({
        success: true,
        orders,
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit)
      });
    } catch (error) {
      console.error("CASHIER ORDERS ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load cashier orders."
      });
    }
  }
);


// =========================================================
// CASHIER — PAYMENT RECORDS
// =========================================================
// The Payment Records page expects:
// GET /api/cashier/payments?page=1&limit=10&search=
// Response: { success, payments, total, page, limit, totalPages }
//
// Preferred source: cashier_payments table (when available).
// Fallback source: Paid orders, so the page still works even if
// the separate payment-history table has not been migrated yet.

app.get(
  "/api/cashier/payments",
  verifyStaffToken,
  allowRoles("cashier", "admin"),
  async (req, res) => {
    try {
      const requestedPage = Number(req.query.page);
      const requestedLimit = Number(req.query.limit);

      const page =
        Number.isSafeInteger(requestedPage) && requestedPage > 0
          ? requestedPage
          : 1;

      const limit =
        Number.isSafeInteger(requestedLimit) && requestedLimit > 0
          ? Math.min(requestedLimit, 100)
          : 10;

      const search = String(req.query.search || "")
        .trim()
        .toLowerCase()
        .slice(0, 120);

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // -----------------------------------------------------
      // 1) USE DEDICATED cashier_payments TABLE WHEN PRESENT
      // -----------------------------------------------------
      const {
        data: paymentRows,
        error: paymentTableError
      } = await supabase
        .from("cashier_payments")
        .select("*");

      if (!paymentTableError) {
        let payments = (paymentRows || []).map((row) => {
          const orderId = row.order_id ?? row.order ?? null;

          return {
            id: row.id,
            order_id: orderId,
            order_number:
              row.order_number ??
              (orderId != null ? String(orderId) : "—"),
            customer_name: row.customer_name ?? "—",
            customer_email: row.customer_email ?? null,
            reference:
              row.reference ??
              row.receipt_number ??
              row.paypal_capture_id ??
              row.paypal_order_id ??
              "—",
            payment_method:
              row.payment_method ??
              row.method ??
              "—",
            amount: Number(row.amount ?? row.total_amount ?? 0),
            status:
              row.status ??
              row.payment_status ??
              "Paid",
            verified_by:
              row.verified_by ??
              row.cashier_name ??
              row.actor ??
              "—",
            created_at:
              row.created_at ??
              row.verified_at ??
              row.paid_at ??
              null,
            notes: row.notes ?? null
          };
        });

        if (search) {
          payments = payments.filter((payment) => {
            const haystack = [
              payment.customer_name,
              payment.customer_email,
              payment.order_number,
              payment.reference,
              payment.payment_method,
              payment.status,
              payment.verified_by
            ]
              .map((value) => String(value ?? "").toLowerCase())
              .join(" ");

            return haystack.includes(search);
          });
        }

        payments.sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });

        const total = payments.length;
        const pageRows = payments.slice(from, to + 1);

        return res.status(200).json({
          success: true,
          payments: pageRows,
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit))
        });
      }

      // Log the missing/unavailable dedicated table, then fall back.
      console.warn(
        "CASHIER PAYMENTS TABLE UNAVAILABLE; USING PAID ORDERS:",
        paymentTableError?.message || paymentTableError
      );

      // -----------------------------------------------------
      // 2) FALLBACK: BUILD PAYMENT RECORDS FROM PAID ORDERS
      // -----------------------------------------------------
      let query = supabase
        .from("orders")
        .select(
          `
            id,
            customer_name,
            customer_email,
            total_amount,
            payment_method,
            payment_status,
            created_at,
            cashier_verified_at,
            cashier_verified_by,
            paypal_order_id,
            paypal_capture_id
          `,
          { count: "exact" }
        )
        .eq("payment_status", "Paid");

      if (search) {
        const escapedSearch = search.replace(
          /[\\%_]/g,
          (character) => `\\${character}`
        );

        query = query.ilike(
          "customer_name",
          `%${escapedSearch}%`
        );
      }

      const {
        data: paidOrders,
        error: ordersError,
        count
      } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);

      if (ordersError) {
        console.error("CASHIER PAYMENT RECORDS ERROR:", {
          code: ordersError.code,
          message: ordersError.message,
          details: ordersError.details,
          hint: ordersError.hint
        });

        return res.status(500).json({
          success: false,
          message: "Unable to load payment records."
        });
      }

      const payments = (paidOrders || []).map((order) => {
        const method = String(order.payment_method || "").trim();
        const orderId = String(order.id);

        let reference = "—";

        if (method.toLowerCase() === "paypal") {
          reference =
            order.paypal_capture_id ||
            order.paypal_order_id ||
            "—";
        } else if (method.toLowerCase() === "cod") {
          reference = `COD-${orderId.slice(0, 8).toUpperCase()}`;
        }

        return {
          id: order.id,
          order_id: order.id,
          order_number: orderId,
          customer_name: order.customer_name ?? "—",
          customer_email: order.customer_email ?? null,
          reference,
          payment_method: order.payment_method ?? "—",
          amount: Number(order.total_amount || 0),
          status: order.payment_status || "Paid",
          verified_by:
            order.cashier_verified_by ||
            (method.toLowerCase() === "paypal" ? "PayPal" : "—"),
          created_at:
            order.cashier_verified_at ||
            order.created_at ||
            null
        };
      });

      return res.status(200).json({
        success: true,
        payments,
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.max(
          1,
          Math.ceil((count ?? 0) / limit)
        )
      });
    } catch (error) {
      console.error("CASHIER PAYMENT RECORDS SERVER ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load payment records."
      });
    }
  }
);

/* ==========================================================
   CASHIER REVIEW, ORDER VERIFICATION, AND RELEASE
========================================================== */

function cashierNormalize(value) {
  return String(value || "").trim().toLowerCase();
}

function cashierReadItems(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function cashierOrderDetails(row) {
  const status = cashierNormalize(row.status);
  const paymentStatus = cashierNormalize(row.payment_status);
  const preparation = cashierNormalize(row.inventory_preparation);

  const closed = ["completed", "cancelled"].includes(status);
  const verified = Boolean(row.cashier_verified_at);
  const released = Boolean(row.cashier_released_at);

  const prepared =
    Boolean(row.inventory_prepared_at) &&
    !["queued", "preparing"].includes(preparation);

  const items = cashierReadItems(row.inventory_items)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      product_id: item.product_id ?? null,
      title:
        item.title ??
        item.product_name ??
        item.name ??
        "Unnamed item",
      size: item.size ?? null,
      color: item.color ?? null,
      quantity: item.quantity ?? item.qty ?? null,
      unit_price: item.unit_price ?? item.price ?? null
    }));

  const hasItems = items.length > 0;

  const canVerify =
    !closed &&
    !released &&
    !verified &&
    hasItems;

  const canRelease =
    !closed &&
    !released &&
    verified &&
    prepared &&
    hasItems &&
    paymentStatus === "paid";

  let releaseReason;

  if (released) {
    releaseReason = "This order already has a cashier release record.";
  } else if (status === "cancelled") {
    releaseReason = "Cancelled orders cannot be released.";
  } else if (status === "completed") {
    releaseReason =
      "This order is already completed. No separate cashier release record is available.";
  } else if (!hasItems) {
    releaseReason =
      "Saved inventory items are missing. Check the order's inventory record.";
  } else if (!verified) {
    releaseReason = "Review the customer and items, then click Verify order.";
  } else if (paymentStatus !== "paid") {
    releaseReason = "Waiting for a recorded Paid payment status.";
  } else if (!prepared) {
    releaseReason = "Waiting for inventory preparation to be completed.";
  } else {
    releaseReason =
      "Ready for release. Confirm only when the actual handover takes place.";
  }

  const total = Number(row.total_amount);
  let amountDue = null;

  if (paymentStatus === "paid" || status === "cancelled") {
    amountDue = 0;
  } else if (
    ["pending", "unpaid"].includes(paymentStatus) &&
    row.total_amount != null &&
    Number.isFinite(total) &&
    total >= 0
  ) {
    amountDue = total;
  }

  return {
    id: row.id,
    order_number: String(row.id),
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    total_amount: row.total_amount,
    amount_due: amountDue,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    status: row.status,
    created_at: row.created_at,

    courier: row.courier ?? null,
    tracking_number: row.tracking_number ?? null,
    inventory_preparation: row.inventory_preparation ?? null,
    inventory_prepared_at: row.inventory_prepared_at ?? null,

    revision: row.cashier_revision,
    verified_at: row.cashier_verified_at ?? null,
    verified_by: row.cashier_verified_by ?? null,
    released_at: row.cashier_released_at ?? null,
    released_by: row.cashier_released_by ?? null,

    items,

    // Separate payment history has not been implemented.
    payments: [],
    payment_history_available: false,

    actions: {
      can_verify_order: canVerify,
      can_verify_payment: false,
      can_release: canRelease,
      release_reason: releaseReason
    }
  };
}

function cashierValidId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(String(value || ""));
}

/* REVIEW ORDER */

app.get(
  "/api/cashier/orders/:id",
  verifyStaffToken,
  allowRoles("cashier", "admin"),
  async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();

      if (!cashierValidId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID."
        });
      }

      const { data: row, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Order not found."
        });
      }

      return res.json({
        success: true,
        order: cashierOrderDetails(row)
      });
    } catch (error) {
      console.error("CASHIER REVIEW ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load order details."
      });
    }
  }
);

/* SHARED TRANSACTION HANDLER */

function cashierActionHandler(action) {
  return async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const revision = req.body?.revision;
      const key = String(req.get("Idempotency-Key") || "").trim();

      if (!cashierValidId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID."
        });
      }

      if (
        !Number.isSafeInteger(revision) ||
        revision < 0 ||
        revision > 2147483647
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid revision. Close and reopen Review."
        });
      }

      if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
        return res.status(400).json({
          success: false,
          message: "A valid Idempotency-Key is required."
        });
      }

      const { data: row, error } = await supabase.rpc(
        "jcn_cashier_order_action",
        {
          p_order_id: id,
          p_actor_id: req.staff.id,
          p_action: action,
          p_revision: revision,
          p_key: key
        }
      );

      if (error) {
        console.error(`CASHIER ${action.toUpperCase()} ERROR:`, error);

        if (error.code === "P0001") {
          return res.status(409).json({
            success: false,
            message: error.message
          });
        }

        return res.status(500).json({
          success: false,
          message:
            "Unable to save the action. Check the server log and cashier SQL installation."
        });
      }

      if (!row || !row.id) {
        throw new Error("Cashier transaction returned no order.");
      }

      return res.json({
        success: true,
        message:
          action === "verify-order"
            ? "Order verification saved."
            : "Order release saved.",
        order: cashierOrderDetails(row)
      });
    } catch (error) {
      console.error("CASHIER ACTION ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to save the cashier action."
      });
    }
  };
}

/* VERIFY ORDER */

app.post(
  "/api/cashier/orders/:id/verify-order",
  verifyStaffToken,
  allowRoles("cashier", "admin"),
  cashierActionHandler("verify-order")
);

/* CONFIRM RELEASE */

app.post(
  "/api/cashier/orders/:id/release",
  verifyStaffToken,
  allowRoles("cashier", "admin"),
  cashierActionHandler("release")
);



// =========================================================
// ADMIN — CUSTOMER MANAGEMENT
// =========================================================

app.get("/api/admin/users", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customer_users")
      .select(
        "id, full_name, first_name, middle_name, last_name, phone, email, username, status, restriction_until, restriction_reason, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      users: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.patch("/api/admin/users/:id/restrict", async (req, res) => {
  try {
    const { id } = req.params;
    const { days, reason } = req.body;
    const restrictionDays = Number(days);

    if (!restrictionDays || restrictionDays <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid restriction days."
      });
    }

    const restrictionUntil = new Date();

    restrictionUntil.setDate(
      restrictionUntil.getDate() + restrictionDays
    );

    const { error } = await supabase
      .from("customer_users")
      .update({
        status: "restricted",
        restriction_until: restrictionUntil.toISOString(),
        restriction_reason: reason || "Violation"
      })
      .eq("id", id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: `User restricted for ${restrictionDays} day(s).`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.patch("/api/admin/users/:id/unrestrict", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("customer_users")
      .update({ status: "active" })
      .eq("id", id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "User unrestricted successfully"
    });
  } catch (error) {
    console.error("UNRESTRICT USER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.delete("/api/admin/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("customer_users")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      console.error("DELETE USER SUPABASE ERROR:", error);

      if (
        error.message.includes("foreign key constraint") ||
        error.message.includes("orders_user_id_fkey")
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This customer cannot be deleted because they have existing orders."
        });
      }

      return res.status(400).json({
        success: false,
        message: "Failed to delete user. Please try again."
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found or was not deleted."
      });
    }

    return res.json({
      success: true,
      message: "User deleted successfully."
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting user."
    });
  }
});

// =========================================================
// PRODUCTS
// Customer: read-only public access
// Inventory Staff/Admin: product management
// =========================================================

function parseProductArray(value) {
  if (Array.isArray(value)) return value;

  if (value === undefined || value === null || value === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanProductSizes(value) {
  return parseProductArray(value).map(item => ({
    size: String(item?.size || "").trim(),
    length: item?.length ?? "",
    width: item?.width ?? "",
    sleeve: item?.sleeve ?? "",
    qty: Math.max(0, Number(item?.qty || 0))
  }));
}

function productTotalQuantity(sizes, fallback = 0) {
  if (Array.isArray(sizes) && sizes.length > 0) {
    return sizes.reduce(
      (sum, item) => sum + Math.max(0, Number(item?.qty || 0)),
      0
    );
  }

  return Math.max(0, Number(fallback || 0));
}

async function uploadProductImage(file) {
  if (!file) return null;

  const safeOriginalName = String(file.originalname || "product-image")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  const fileName = `${Date.now()}-${safeOriginalName || "product-image"}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from("product-images")
    .getPublicUrl(fileName);

  return publicUrlData?.publicUrl || null;
}

async function getPublicProducts(req, res) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LOAD PRODUCTS ERROR:", error);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.json({
      success: true,
      products: data || []
    });
  } catch (error) {
    console.error("LOAD PRODUCTS SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to load products."
    });
  }
}

async function getInventoryProducts(req, res) {
  try {
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);

    const page = Number.isFinite(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 50;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    const search = String(req.query.search || req.query.q || "").trim();

    if (search) {
      const safeSearch = search.replace(/[%_,()]/g, " ").trim();

      if (safeSearch) {
        query = query.ilike("title", `%${safeSearch}%`);
      }
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error("INVENTORY PRODUCTS ERROR:", error);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const total = Number(count || 0);

    return res.json({
      success: true,
      products: data || [],
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    console.error("INVENTORY PRODUCTS SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to load inventory products."
    });
  }
}

async function addProduct(req, res) {
  try {
    const {
      title,
      description,
      price,
      category,
      quantity,
      colors,
      sizes
    } = req.body || {};

    const cleanTitle = String(title || "").trim();
    const cleanCategory = String(category || "").trim();
    const cleanPrice = Number(price);

    if (!cleanTitle || !cleanCategory || !Number.isFinite(cleanPrice)) {
      return res.status(400).json({
        success: false,
        message: "Title, category, and a valid price are required."
      });
    }

    const cleanColors = parseProductArray(colors);
    const cleanSizes = cleanProductSizes(sizes);
    const totalQuantity = productTotalQuantity(cleanSizes, quantity);
    const imageUrl = await uploadProductImage(req.file);

    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          title: cleanTitle,
          description: String(description || "").trim(),
          price: cleanPrice,
          category: cleanCategory,
          quantity: totalQuantity,
          product_image: imageUrl,
          colors: cleanColors,
          sizes: cleanSizes
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("ADD PRODUCT ERROR:", error);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: "Product added successfully.",
      product: data
    });
  } catch (error) {
    console.error("ADD PRODUCT SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to add product."
    });
  }
}

async function updateProductDetails(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const updates = {};

    if (body.title !== undefined) {
      updates.title = String(body.title || "").trim();
    }

    if (body.description !== undefined) {
      updates.description = String(body.description || "").trim();
    }

    if (body.price !== undefined) {
      const price = Number(body.price);

      if (!Number.isFinite(price)) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid number."
        });
      }

      updates.price = price;
    }

    if (body.category !== undefined) {
      updates.category = String(body.category || "").trim();
    }

    if (body.colors !== undefined) {
      updates.colors = parseProductArray(body.colors);
    }

    if (body.sizes !== undefined) {
      const cleanSizes = cleanProductSizes(body.sizes);
      updates.sizes = cleanSizes;
      updates.quantity = productTotalQuantity(cleanSizes, body.quantity);
    } else if (body.quantity !== undefined) {
      updates.quantity = Math.max(0, Number(body.quantity || 0));
    }

    if (req.file) {
      updates.product_image = await uploadProductImage(req.file);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No product changes were supplied."
      });
    }

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    return res.json({
      success: true,
      message: "Product updated successfully.",
      product: data
    });
  } catch (error) {
    console.error("UPDATE PRODUCT SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to update product."
    });
  }
}

async function updateProductStock(req, res) {
  try {
    const { id } = req.params;
    const { sizes } = req.body || {};

    if (!Array.isArray(sizes)) {
      return res.status(400).json({
        success: false,
        message: "Sizes must be an array."
      });
    }

    const cleanSizes = cleanProductSizes(sizes);
    const totalQuantity = productTotalQuantity(cleanSizes, 0);

    const { data, error } = await supabase
      .from("products")
      .update({
        sizes: cleanSizes,
        quantity: totalQuantity
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    return res.json({
      success: true,
      message: "Stock updated successfully.",
      product: data
    });
  } catch (error) {
    console.error("EDIT STOCK SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to update stock."
    });
  }
}

async function updateProductSale(req, res) {
  try {
    const { id } = req.params;
    const { sale_percent, sale_end } = req.body || {};
    const salePercent = Number(sale_percent || 0);

    if (!Number.isFinite(salePercent) || salePercent < 0 || salePercent > 100) {
      return res.status(400).json({
        success: false,
        message: "Sale percent must be between 0 and 100."
      });
    }

    const { data, error } = await supabase
      .from("products")
      .update({
        sale_percent: salePercent,
        sale_end: sale_end || null
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Product not found or sale not updated."
      });
    }

    return res.json({
      success: true,
      message: "Sale updated successfully.",
      product: data
    });
  } catch (error) {
    console.error("UPDATE SALE SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to update sale."
    });
  }
}

async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .select("id, title")
      .maybeSingle();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    return res.json({
      success: true,
      message: "Product deleted successfully.",
      product: data
    });
  } catch (error) {
    console.error("DELETE PRODUCT SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to delete product."
    });
  }
}

// ---------------------------------------------------------
// CUSTOMER / PUBLIC PRODUCT READ ENDPOINTS
// Keep /api/admin/products GET as a compatibility alias because
// the current customer frontend still references that old route.
// ---------------------------------------------------------
app.get(
  ["/api/products", "/api/customer/products", "/api/admin/products"],
  getPublicProducts
);

// ---------------------------------------------------------
// INVENTORY STAFF PRODUCT READ
// ---------------------------------------------------------
app.get(
  "/api/inventory/products",
  verifyStaffToken,
  allowRoles("inventory_staff", "admin"),
  getInventoryProducts
);

// ---------------------------------------------------------
// INVENTORY STAFF / ADMIN PRODUCT MANAGEMENT
// Old /api/admin/products write URLs are kept as aliases so the
// existing Inventory frontend works while you migrate it to /api/inventory.
// ---------------------------------------------------------
app.post(
  ["/api/inventory/products", "/api/admin/products"],
  verifyStaffToken,
  allowRoles("inventory_staff", "admin"),
  upload.single("product_image"),
  addProduct
);

app.put(
  ["/api/inventory/products/:id", "/api/admin/products/:id"],
  verifyStaffToken,
  allowRoles("inventory_staff", "admin"),
  upload.single("product_image"),
  updateProductDetails
);

app.patch(
  ["/api/inventory/products/:id", "/api/admin/products/:id"],
  verifyStaffToken,
  allowRoles("inventory_staff", "admin"),
  upload.single("product_image"),
  updateProductDetails
);

app.patch(
  [
    "/api/inventory/products/:id/stock",
    "/api/admin/products/:id/stock"
  ],
  verifyStaffToken,
  allowRoles("inventory_staff", "admin"),
  updateProductStock
);

app.patch(
  [
    "/api/inventory/products/:id/sale",
    "/api/admin/products/:id/sale"
  ],
  verifyStaffToken,
  allowRoles("inventory_staff", "admin"),
  updateProductSale
);

app.delete(
  ["/api/inventory/products/:id", "/api/admin/products/:id"],
  verifyStaffToken,
  allowRoles("inventory_staff", "admin"),
  deleteProduct
);

// =========================================================
// ANNOUNCEMENTS
// =========================================================

app.post("/api/admin/announcements", async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required."
      });
    }

    const { data, error } = await supabase
      .from("announcements")
      .insert([{ title, message }])
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Announcement posted successfully.",
      announcement: data[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.delete("/api/admin/announcements/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found."
      });
    }

    res.json({
      success: true,
      message: "Announcement deleted successfully."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while deleting announcement."
    });
  }
});

app.get("/api/announcements", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      announcements: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// REPORTS
// =========================================================

app.get("/api/admin/reports", async (req, res) => {
  try {
    const {
      data: orders,
      error: ordersError
    } = await supabase
      .from("orders")
      .select("*");

    if (ordersError) {
      return res.status(400).json({
        success: false,
        message: ordersError.message
      });
    }

    const {
      count: totalUsers,
      error: usersError
    } = await supabase
      .from("customer_users")
      .select("*", { count: "exact", head: true });

    if (usersError) {
      return res.status(400).json({
        success: false,
        message: usersError.message
      });
    }

    const allOrders = orders || [];

    const activeOrders = allOrders.filter(
      order => order.status !== "Cancelled"
    );

    const totalSales = activeOrders
      .filter(order => order.status === "Completed")
      .reduce(
        (sum, order) => sum + Number(order.total_amount || 0),
        0
      );

    const statusCounts = {
      Pending: activeOrders.filter(
        order => order.status === "Pending"
      ).length,

      Preparing: activeOrders.filter(
        order => order.status === "Preparing"
      ).length,

      "To Deliver": activeOrders.filter(
        order => order.status === "To Deliver"
      ).length,

      Completed: activeOrders.filter(
        order => order.status === "Completed"
      ).length,

      Cancelled: allOrders.filter(
        order => order.status === "Cancelled"
      ).length
    };

    res.json({
      success: true,
      totalSales,
      totalOrders: activeOrders.length,
      totalUsers: totalUsers || 0,
      delivered: statusCounts.Completed,
      statusCounts,
      orders: activeOrders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// ADMIN SETTINGS
// =========================================================

app.get("/api/admin/settings", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("admin_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      settings: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.put("/api/admin/settings", async (req, res) => {
  try {
    const settings = req.body;

    const { data, error } = await supabase
      .from("admin_settings")
      .update({
        shop_name: settings.shop_name,
        shop_email: settings.shop_email,
        shop_phone: settings.shop_phone,
        shop_address: settings.shop_address,
        business_hours: settings.business_hours,

        admin_name: settings.admin_name,
        admin_username: settings.admin_username,
        admin_email: settings.admin_email,

        delivery_fee: settings.delivery_fee,
        free_shipping_min: settings.free_shipping_min,
        delivery_days: settings.delivery_days,

        paypal_client_id: settings.paypal_client_id,
        paypal_mode: settings.paypal_mode,

        email_order_confirmation: settings.email_order_confirmation,
        email_tracking_updates: settings.email_tracking_updates,
        email_delivery_updates: settings.email_delivery_updates,

        ai_enabled: settings.ai_enabled,
        ai_style: settings.ai_style,
        ai_design_suggestions: settings.ai_design_suggestions,

        announcement_title: settings.announcement_title,
        announcement_message: settings.announcement_message,
        announcement_enabled: settings.announcement_enabled,

        session_timeout: settings.session_timeout,
        strong_password_required: settings.strong_password_required,

        updated_at: new Date()
      })
      .eq("id", 1)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Settings updated successfully.",
      settings: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// CUSTOMER PROFILE
// =========================================================

app.put("/api/customer/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      full_name,
      email,
      phone,
      username,
      address,
      house_street,
      barangay,
      city,
      province
    } = req.body;

    const { data, error } = await supabase
      .from("customer_users")
      .update({
        full_name,
        email,
        phone,
        username,
        address,
        house_street,
        barangay,
        city,
        province
      })
      .eq("id", id)
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully.",
      user: data[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.put("/api/customer/change-password/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required."
      });
    }

    const {
      data: customer,
      error: findError
    } = await supabase
      .from("customer_users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (findError || !customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found."
      });
    }

    const passwordMatch = customer.password.startsWith("$2")
      ? await bcrypt.compare(currentPassword, customer.password)
      : currentPassword === customer.password;

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect."
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error } = await supabase
      .from("customer_users")
      .update({
        password: hashedPassword
      })
      .eq("id", id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Password changed successfully."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// SAVE CUSTOM DESIGN
// =========================================================

app.post("/api/custom-designs", async (req, res) => {
  try {
    const {
      user_id,
      apparel_type,
      color,
      custom_text,
      text_position,
      logo_image,
      logo_position,
      preview_image,
      price
    } = req.body;

    const { data, error } = await supabase
      .from("custom_designs")
      .insert([
        {
          user_id,
          apparel_type,
          color,
          custom_text,
          text_position,
          logo_image,
          logo_position,
          preview_image,
          price: Number(price || 499),
          status: "Saved"
        }
      ])
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Custom design saved.",
      design: data[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// EXISTING CUSTOMER CANCELLATION / REFUND HANDLER
// =========================================================

app.patch("/api/customer/orders/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      data: order,
      error: findError
    } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (findError || !order) {
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    if (
      order.status === "To Ship" ||
      order.status === "To Deliver" ||
      order.status === "To Receive" ||
      order.status === "Completed"
    ) {
      return res.status(400).json({
        success: false,
        message: "This order can no longer be cancelled."
      });
    }

    if (
      order.payment_method === "PayPal" &&
      order.payment_status === "Paid" &&
      order.paypal_capture_id
    ) {
      const accessToken = await getPayPalAccessToken();

      const refundResponse = await fetch(
        `${process.env.PAYPAL_BASE_URL}/v2/payments/captures/${order.paypal_capture_id}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      const refundData = await refundResponse.json();

      if (!refundResponse.ok) {
        console.error("PAYPAL REFUND ERROR:", refundData);

        return res.status(400).json({
          success: false,
          message: refundData.message || "PayPal refund failed."
        });
      }

      const { data, error } = await supabase
        .from("orders")
        .update({
          status: "Cancelled",
          payment_status: "Refunded",
          paypal_refund_id: refundData.id,
          refunded_at: new Date().toISOString()
        })
        .eq("id", id)
        .select();

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      return res.json({
        success: true,
        message: "Order cancelled and PayPal payment refunded.",
        order: data[0]
      });
    }

    const { data, error } = await supabase
      .from("orders")
      .update({
        status: "Cancelled"
      })
      .eq("id", id)
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Order cancelled successfully.",
      order: data[0]
    });
  } catch (error) {
    console.error("CANCEL ORDER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// ADD J&T TRACKING NUMBER
// =========================================================

app.post("/api/orders/:id/tracking", async (req, res) => {
  try {
    const { id } = req.params;
    const { tracking_number } = req.body || {};

    if (
      !tracking_number ||
      String(tracking_number).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Tracking number is required."
      });
    }

    const trackingNumber = String(tracking_number).trim();

    const {
      data: order,
      error: orderFetchError
    } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderFetchError || !order) {
      console.error("ORDER FETCH ERROR:", orderFetchError);

      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    if (
      order.status === "Cancelled" ||
      order.status === "Canceled"
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot add tracking to a cancelled order."
      });
    }

    if (
      order.status === "Completed" ||
      order.status === "Delivered"
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot add tracking to a completed order."
      });
    }

    let aftershipTracking = null;

    try {
      const aftershipResponse = await axios.post(
        "https://api.aftership.com/tracking/2024-04/trackings",
        {
          tracking: {
            tracking_number: trackingNumber,
            slug: "jtexpress-ph",
            title: order.order_number || `Order ${order.id}`,
            order_id: String(order.order_number || order.id)
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
            "as-api-key": process.env.AFTERSHIP_API_KEY
          }
        }
      );

      aftershipTracking =
        aftershipResponse.data?.data?.tracking || null;
    } catch (aftershipError) {
      console.error(
        "AFTERSHIP CREATE ERROR:",
        aftershipError.response?.data || aftershipError.message
      );
    }

    let aftershipTrackingId = null;
    let latestLocation = null;
    let latestCheckpointDate = null;
    let latestMessage = null;

    if (aftershipTracking) {
      aftershipTrackingId = aftershipTracking.id || null;

      const checkpoints = Array.isArray(aftershipTracking.checkpoints)
        ? aftershipTracking.checkpoints
        : [];

      if (checkpoints.length > 0) {
        const sortedCheckpoints = [...checkpoints].sort((a, b) => {
          const dateA = new Date(
            a.checkpoint_time || 0
          ).getTime();

          const dateB = new Date(
            b.checkpoint_time || 0
          ).getTime();

          return dateB - dateA;
        });

        const latest = sortedCheckpoints[0];

        latestLocation =
          latest.location ||
          [
            latest.city,
            latest.state,
            latest.country_name
          ].filter(Boolean).join(", ") ||
          null;

        latestCheckpointDate = latest.checkpoint_time || null;

        latestMessage =
          latest.message ||
          latest.subtag_message ||
          null;
      }
    }

    let newOrderStatus = "To Ship";

    const aftershipStatus = String(aftershipTracking?.tag || "")
      .trim()
      .toLowerCase();

    if (
      aftershipStatus === "" ||
      aftershipStatus === "pending" ||
      aftershipStatus === "inforeceived" ||
      aftershipStatus === "info_received"
    ) {
      newOrderStatus = "To Ship";
    } else if (
      aftershipStatus === "intransit" ||
      aftershipStatus === "in_transit" ||
      aftershipStatus === "outfordelivery" ||
      aftershipStatus === "out_for_delivery" ||
      aftershipStatus === "attemptfail" ||
      aftershipStatus === "attempt_fail" ||
      aftershipStatus === "exception"
    ) {
      newOrderStatus = "To Receive";
    } else if (aftershipStatus === "delivered") {
      newOrderStatus = "To Receive";
    }

    if (newOrderStatus === "To Ship" && !latestMessage) {
      latestMessage = "Waiting for J&T courier pickup.";
    }

    const updatePayload = {
      tracking_number: trackingNumber,
      courier: "J&T Express",
      status: newOrderStatus,
      tracking_message: latestMessage
    };

    if (aftershipTrackingId) {
      updatePayload.aftership_tracking_id = aftershipTrackingId;
    }

    if (latestLocation) {
      updatePayload.tracking_location = latestLocation;
    }

    if (latestCheckpointDate) {
      updatePayload.tracking_updated_at = latestCheckpointDate;
    }

    const {
      data: updatedOrder,
      error: updateError
    } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("TRACKING DATABASE UPDATE ERROR:", updateError);

      return res.status(400).json({
        success: false,
        message: updateError.message
      });
    }

    return res.json({
      success: true,
      message:
        newOrderStatus === "To Ship"
          ? "Tracking number added. Waiting for J&T courier pickup."
          : "Tracking number added and shipment is already in transit.",
      order: updatedOrder,
      tracking: {
        tracking_number: trackingNumber,
        courier: "J&T Express",
        aftership_tracking_id: aftershipTrackingId,
        status:
          newOrderStatus === "To Ship"
            ? "Waiting for Courier"
            : "In Transit",
        latest_location: latestLocation,
        latest_date: latestCheckpointDate,
        latest_message: latestMessage
      }
    });
  } catch (error) {
    console.error("ADD J&T TRACKING ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to add J&T tracking number."
    });
  }
});

// =========================================================
// ORDER LIST
// =========================================================

app.get("/api/orders", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      orders: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// EXISTING TRACKING SYNC
// =========================================================

app.get("/api/orders/:id/sync-tracking", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    if (!order.tracking_number) {
      return res.json({
        success: false,
        message: "No tracking number found."
      });
    }

    const response = await axios.get(
      `https://api.aftership.com/tracking/2024-04/trackings/jtexpress-ph/${order.tracking_number}`,
      {
        headers: {
          "as-api-key": process.env.AFTERSHIP_API_KEY
        }
      }
    );

    const tag = response.data?.tracking?.tag;
    let newStatus = order.status;

    if (tag === "InfoReceived") newStatus = "Preparing";
    if (tag === "InTransit") newStatus = "To Deliver";
    if (tag === "OutForDelivery") newStatus = "To Deliver";
    if (tag === "Delivered") newStatus = "Completed";
    if (tag === "Exception") newStatus = "To Deliver";

    await supabase
      .from("orders")
      .update({
        status: newStatus,
        tracking_status: tag
      })
      .eq("id", id);

    res.json({
      success: true,
      status: newStatus,
      tracking_status: tag
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error.response?.data?.meta?.message ||
        error.message
    });
  }
});

// =========================================================
// COMPLETE ORDER
// =========================================================

app.patch("/api/customer/orders/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("orders")
      .update({
        status: "Completed",
        payment_status: "Paid"
      })
      .eq("id", id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Order completed successfully."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// PAYPAL ACCESS TOKEN
// =========================================================

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description || "PayPal token error"
    );
  }

  return data.access_token;
}

// =========================================================
// PAYPAL CREATE ORDER — EXISTING ₱1 TEST PAYMENT
// =========================================================

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "PHP",
                value: "1.00"
              }
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json(data);
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// PAYPAL REDIRECT ORDER
// =========================================================

app.post("/api/paypal/create-redirect-order", async (req, res) => {
  try {
    const { system_order_id } = req.body;

    if (!system_order_id) {
      return res.status(400).json({
        success: false,
        message: "Missing system order ID."
      });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: String(system_order_id),
              amount: {
                currency_code: "PHP",
                value: "1.00"
              }
            }
          ],
          application_context: {
            brand_name: "JCN Clothing",
            landing_page: "LOGIN",
            user_action: "PAY_NOW",
            return_url:
              `http://localhost:5000/api/paypal/success?system_order_id=${system_order_id}`,
            cancel_url:
              `http://localhost:5000/api/paypal/cancel?system_order_id=${system_order_id}`
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: "Cannot create PayPal order.",
        paypal: data
      });
    }

    const approveLink = data.links?.find(
      link =>
        link.rel === "approve" ||
        link.rel === "payer-action"
    );

    if (!approveLink) {
      return res.status(400).json({
        success: false,
        message: "No PayPal approval URL found.",
        paypal: data
      });
    }

    await supabase
      .from("orders")
      .update({
        paypal_order_id: data.id,
        payment_method: "PayPal",
        payment_status: "Unpaid",
        status: "Pending Payment"
      })
      .eq("id", system_order_id);

    res.json({
      success: true,
      paypal_order_id: data.id,
      approve_url: approveLink.href
    });
  } catch (error) {
    console.error("CREATE PAYPAL REDIRECT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =========================================================
// PAYPAL SUCCESS RETURN
// =========================================================

app.get("/api/paypal/success", async (req, res) => {
  try {
    const { token, system_order_id } = req.query;

    const CHECKOUT_PAGE =
      "http://localhost:5500/customer/html/customer-checkout.html";

    if (!token || !system_order_id) {
      return res.redirect(`${CHECKOUT_PAGE}?payment=missing`);
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${token}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const paypalData = await response.json();

    if (!response.ok || paypalData.status !== "COMPLETED") {
      return res.redirect(`${CHECKOUT_PAGE}?payment=failed`);
    }

    const captureId =
      paypalData.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
      null;

    const {
      data: updatedOrder,
      error
    } = await supabase
      .from("orders")
      .update({
        status: "Processing",
        payment_status: "Paid",
        payment_method: "PayPal",
        paypal_order_id: token,
        paypal_capture_id: captureId
      })
      .eq("id", system_order_id)
      .select("*")
      .maybeSingle();

    if (error || !updatedOrder) {
      return res.redirect(
        `${CHECKOUT_PAGE}?payment=update_failed`
      );
    }

    return res.redirect(
      `${CHECKOUT_PAGE}?payment=success&order_number=${encodeURIComponent(updatedOrder.order_number)}`
    );
  } catch (error) {
    console.error("PAYPAL SUCCESS ERROR:", error);

    return res.redirect(
      "http://localhost:5500/customer/html/customer-checkout.html?payment=error"
    );
  }
});

// =========================================================
// PAYPAL CANCEL RETURN
// =========================================================

app.get("/api/paypal/cancel", async (req, res) => {
  try {
    const { system_order_id } = req.query;

    if (system_order_id) {
      await supabase
        .from("orders")
        .update({
          status: "Pending Payment",
          payment_status: "Unpaid"
        })
        .eq("id", system_order_id);
    }

    return res.redirect(
      `http://localhost:5500/customer/html/customer-checkout.html?paypal=cancelled&order_id=${system_order_id || ""}`
    );
  } catch (error) {
    console.error("PAYPAL CANCEL ERROR:", error);

    return res.redirect(
      "http://localhost:5500/customer/html/customer-checkout.html?paypal=error"
    );
  }
});

// =========================================================
// LIVE INVENTORY ROUTES
// Keep your existing backend/routes/inventory.js file.
// =========================================================

app.use(
  "/api/inventory",
  require("./backend/routes/inventory")({
    supabase,
    verifyStaffToken
  })
);




/* =========================================================
   GRAPHIC DESIGNER ROUTES
========================================================= */

const registerGraphicDesignerRoutes =
  require("./backend/routes/graphic-designer-routes.js");

registerGraphicDesignerRoutes({
  app,
  supabase,
  verifyStaffToken,
  allowRoles,
  verifyCustomerToken
});

// =========================================================
// UNKNOWN API ROUTES
// Must remain after all API routes.
// =========================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message:
      `API route not found: ${req.method} ${req.originalUrl}`
  });
});


// =========================================================
// START SERVER
// =========================================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", error => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the previous backend process, then restart this file.`
    );
  } else {
    console.error("SERVER START ERROR:", error.message);
  }

  process.exitCode = 1;
});