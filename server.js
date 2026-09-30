const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const axios = require("axios");
const multer = require("multer");
const nodemailer = require("nodemailer");
const upload = multer({ storage: multer.memoryStorage() });

const supabase = require("./backend/config/supabaseClient");

const app = express();

app.use(cors());
app.use(express.json());
const otpStore = {};
const resetOtps = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* TEST CUSTOMER TABLE */
app.get("/api/test-db", async (req, res) => {
  const { data, error } = await supabase.from("customer_users").select("*");

  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  res.json({ success: true, data });
});

/* TEST ADMIN TABLE */
app.get("/api/test-admin", async (req, res) => {
  const { data, error } = await supabase.from("admin_users").select("*");

  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  res.json({ success: true, data });
});

/* CUSTOMER REGISTER */
/* SMS HELPER */
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

/* SEND OTP - EMAIL OR SMS */
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const {
      email,
      username,
      phone,
      otp_method
    } = req.body;

    if (!email || !username || !phone || !otp_method) {
      return res.status(400).json({
        success: false,
        message: "Email, username, phone, and OTP method are required."
      });
    }

    if (!["email", "sms"].includes(otp_method)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP method."
      });
    }

    const { data: existingUser, error } = await supabase
      .from("customer_users")
      .select("id, email, username, phone")
      .or(`email.eq.${email},username.eq.${username},phone.eq.${phone}`)
      .maybeSingle();

    if (error) throw error;

    if (existingUser) {
      const errors = [];

      if (existingUser.email === email) {
        errors.push("Email is already registered");
      }

      if (existingUser.username === username) {
        errors.push("Username is already taken");
      }

      if (existingUser.phone === phone) {
        errors.push("Phone number is already registered");
      }

      return res.status(409).json({
        success: false,
        message: errors.join(" • ")
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[email] = {
      otp,
      otp_method,
      phone,
      expiresAt: Date.now() + 5 * 60 * 1000
    };

    if (otp_method === "email") {
      await transporter.sendMail({
        from: `"JCN Apparel" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "JCN Email Verification Code",
        html: `
          <h2>JCN Apparel Email Verification</h2>
          <p>Your verification code is:</p>
          <h1>${otp}</h1>
          <p>This code will expire in 5 minutes.</p>
        `
      });
    }

    if (otp_method === "sms") {
      await sendSMS(
        phone,
        `Your JCN verification code is ${otp}. It will expire in 5 minutes.`
      );
    }

    res.json({
      success: true,
      message:
        otp_method === "sms"
          ? "OTP sent to your phone number."
          : "OTP sent to your email."
    });

  } catch (error) {
    console.error("SEND OTP ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* REGISTER AFTER OTP */
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
    } = req.body;

    if (!firstName || !lastName || !phone || !email || !username || !password || !otp) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be completed."
      });
    }

    const storedOtp = otpStore[email];

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: "Please request OTP first."
      });
    }

    if (Date.now() > storedOtp.expiresAt) {
      delete otpStore[email];

      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one."
      });
    }

    if (storedOtp.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code."
      });
    }

    delete otpStore[email];

    const fullName = `${firstName} ${middleName || ""} ${lastName}`
      .replace(/\s+/g, " ")
      .trim();

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase
      .from("customer_users")
      .insert([
        {
          full_name: fullName,
          first_name: firstName,
          middle_name: middleName || "",
          last_name: lastName,
          phone,
          email,
          username,
          password: hashedPassword,
          status: "active"
        }
      ]);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Registration successful."
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* CUSTOMER LOGIN */
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

    const passwordMatch =
      storedPassword.startsWith("$2")
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

    // UPDATE LAST LOGIN AND REACTIVATE USER
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

    const token = jwt.sign(
      {
        id: customer.id,
        username: customer.username,
        role: "customer"
      },
      process.env.JWT_SECRET || "jcn_secret_12345",
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

/* ADMIN LOGIN */
app.post("/api/auth/admin-login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required"
      });
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin account not found"
      });
    }

    const passwordMatch =
      admin.password && admin.password.startsWith("$2")
        ? await bcrypt.compare(password, admin.password)
        : password === admin.password;

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect admin password"
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: "admin"
      },
      process.env.JWT_SECRET || "jcn_secret_12345",
      { expiresIn: "1d" }
    );

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: "admin"
      }
    });

  } catch (error) {
    console.error("ADMIN LOGIN SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/*customer reset password*/
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

/*customer forgot password*/
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

    console.log("CUSTOMER RESET EMAIL:", cleanEmail);

    const { data: user, error } = await supabase
      .from("customer_users")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    console.log("CUSTOMER FOUND:", user);
    console.log("SUPABASE ERROR:", error);

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: "Customer email not found."
      });
    }

    const otp =
      Math.floor(100000 + Math.random() * 900000).toString();

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

/*admin reset-password*/
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

/*admin forgot password*/
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    resetOtps[email] = {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

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

/* =========================================================
   STAFF / ADMIN AUTH MIDDLEWARE
========================================================= */

function verifyStaffToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No authorization token."
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "jcn_secret_12345"
    );

    req.staff = decoded;

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session."
    });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized."
      });
    }

    if (!roles.includes(req.staff.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource."
      });
    }

    next();
  };
}

/* =========================================================
   ADMIN - MANAGE STAFF
========================================================= */

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


/* =========================================================
   GET ALL STAFF
========================================================= */

app.get(
  "/api/admin/staff",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {

      const { data: staff, error } = await supabase
        .from("admin_users")
        .select(`
          id,
          full_name,
          username,
          email,
          role,
          status,
          last_login_at,
          created_at
        `)
        .in("role", STAFF_ROLES)
        .order("created_at", {
          ascending: false
        });

      if (error) {
        console.error("GET STAFF ERROR:", error);

        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      const staffList = staff || [];

      const counts = {
        total: staffList.length,

        inventory: staffList.filter(
          user =>
            user.role === "inventory_staff"
        ).length,

        designers: staffList.filter(
          user =>
            user.role === "graphic_designer"
        ).length,

        cashiers: staffList.filter(
          user =>
            user.role === "cashier"
        ).length
      };

      return res.json({
        success: true,
        staff: staffList,
        counts
      });

    } catch (error) {

      console.error(
        "GET STAFF SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error."
      });
    }
  }
);


/* =========================================================
   CREATE STAFF ACCOUNT
========================================================= */

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

      /* =========================
         REQUIRED FIELDS
      ========================= */

      if (
        !full_name ||
        !username ||
        !email ||
        !password ||
        !role
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Full name, username, email, password, and role are required."
        });
      }

      /* =========================
         CLEAN VALUES
      ========================= */

      const cleanFullName =
        full_name.trim();

      const cleanUsername =
        username.trim();

      const cleanEmail =
        email.trim().toLowerCase();

      const cleanRole =
        role.trim();

      const cleanStatus =
        status || "active";

      /* =========================
         VALIDATE ROLE
      ========================= */

      if (
        !STAFF_ROLES.includes(cleanRole)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid staff role."
        });
      }

      /* =========================
         VALIDATE STATUS
      ========================= */

      if (
        !STAFF_STATUSES.includes(
          cleanStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid staff status."
        });
      }

      /* =========================
         PASSWORD LENGTH
      ========================= */

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message:
            "Password must contain at least 8 characters."
        });
      }

      /* =========================
         CHECK USERNAME
      ========================= */

      const {
        data: existingUsername,
        error: usernameCheckError
      } = await supabase
        .from("admin_users")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (usernameCheckError) {
        console.error(
          "USERNAME CHECK ERROR:",
          usernameCheckError
        );

        return res.status(400).json({
          success: false,
          message:
            usernameCheckError.message
        });
      }

      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message:
            "Username is already in use."
        });
      }

      /* =========================
         CHECK EMAIL
      ========================= */

      const {
        data: existingEmail,
        error: emailCheckError
      } = await supabase
        .from("admin_users")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (emailCheckError) {
        console.error(
          "EMAIL CHECK ERROR:",
          emailCheckError
        );

        return res.status(400).json({
          success: false,
          message:
            emailCheckError.message
        });
      }

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message:
            "Email address is already in use."
        });
      }

      /* =========================
         HASH PASSWORD
      ========================= */

      const hashedPassword =
        await bcrypt.hash(
          password,
          12
        );

      /* =========================
         INSERT STAFF
      ========================= */

      const {
        data: newStaff,
        error: insertError
      } = await supabase
        .from("admin_users")
        .insert([
          {
            full_name:
              cleanFullName,

            username:
              cleanUsername,

            email:
              cleanEmail,

            password:
              hashedPassword,

            role:
              cleanRole,

            status:
              cleanStatus
          }
        ])
        .select(`
          id,
          full_name,
          username,
          email,
          role,
          status,
          last_login_at,
          created_at
        `)
        .single();

      if (insertError) {

        console.error(
          "CREATE STAFF ERROR:",
          insertError
        );

        return res.status(400).json({
          success: false,
          message:
            insertError.message
        });
      }

      return res.status(201).json({
        success: true,

        message:
          "Staff account created successfully.",

        staff:
          newStaff
      });

    } catch (error) {

      console.error(
        "CREATE STAFF SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server error while creating staff account."
      });
    }
  }
);


/* =========================================================
   UPDATE STAFF INFORMATION
========================================================= */

app.patch(
  "/api/admin/staff/:id",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {

      const { id } = req.params;

      const {
        full_name,
        email,
        role
      } = req.body;

      if (
        !full_name ||
        !email ||
        !role
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Full name, email, and role are required."
        });
      }

      if (
        !STAFF_ROLES.includes(role)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid staff role."
        });
      }

      const cleanEmail =
        email.trim().toLowerCase();

      /* =========================
         CHECK DUPLICATE EMAIL
      ========================= */

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
          message:
            emailCheckError.message
        });
      }

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message:
            "Email address is already in use."
        });
      }

      /* =========================
         UPDATE STAFF
      ========================= */

      const {
        data,
        error
      } = await supabase
        .from("admin_users")
        .update({
          full_name:
            full_name.trim(),

          email:
            cleanEmail,

          role
        })
        .eq("id", id)
        .in("role", STAFF_ROLES)
        .select(`
          id,
          full_name,
          username,
          email,
          role,
          status,
          last_login_at,
          created_at
        `)
        .maybeSingle();

      if (error) {

        console.error(
          "UPDATE STAFF ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            error.message
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Staff account not found."
        });
      }

      return res.json({
        success: true,

        message:
          "Staff information updated successfully.",

        staff:
          data
      });

    } catch (error) {

      console.error(
        "UPDATE STAFF SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server error."
      });
    }
  }
);


/* =========================================================
   CHANGE STAFF STATUS
========================================================= */

app.patch(
  "/api/admin/staff/:id/status",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {

      const { id } =
        req.params;

      const { status } =
        req.body;

      if (
        !STAFF_STATUSES.includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid staff status."
        });
      }

      const {
        data,
        error
      } = await supabase
        .from("admin_users")
        .update({
          status
        })
        .eq("id", id)
        .in("role", STAFF_ROLES)
        .select(`
          id,
          full_name,
          username,
          email,
          role,
          status,
          last_login_at
        `)
        .maybeSingle();

      if (error) {

        console.error(
          "UPDATE STAFF STATUS ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            error.message
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Staff account not found."
        });
      }

      return res.json({
        success: true,

        message:
          "Staff status updated successfully.",

        staff:
          data
      });

    } catch (error) {

      console.error(
        "STAFF STATUS SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server error."
      });
    }
  }
);


/* =========================================================
   RESET STAFF PASSWORD
========================================================= */

app.patch(
  "/api/admin/staff/:id/password",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {

      const { id } =
        req.params;

      const { password } =
        req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message:
            "New password is required."
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message:
            "Password must contain at least 8 characters."
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          12
        );

      const {
        data,
        error
      } = await supabase
        .from("admin_users")
        .update({
          password:
            hashedPassword
        })
        .eq("id", id)
        .in("role", STAFF_ROLES)
        .select(`
          id,
          full_name,
          username,
          email,
          role,
          status
        `)
        .maybeSingle();

      if (error) {

        console.error(
          "RESET STAFF PASSWORD ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            error.message
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Staff account not found."
        });
      }

      return res.json({
        success: true,
        message:
          "Staff password updated successfully."
      });

    } catch (error) {

      console.error(
        "STAFF PASSWORD SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server error."
      });
    }
  }
);


/* =========================================================
   DELETE STAFF
========================================================= */

app.delete(
  "/api/admin/staff/:id",
  verifyStaffToken,
  allowRoles("admin"),
  async (req, res) => {
    try {

      const { id } =
        req.params;

      const {
        data,
        error
      } = await supabase
        .from("admin_users")
        .delete()
        .eq("id", id)
        .in("role", STAFF_ROLES)
        .select(`
          id,
          full_name,
          username,
          role
        `)
        .maybeSingle();

      if (error) {

        console.error(
          "DELETE STAFF ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            error.message
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Staff account not found."
        });
      }

      return res.json({
        success: true,

        message:
          "Staff account deleted successfully."
      });

    } catch (error) {

      console.error(
        "DELETE STAFF SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server error."
      });
    }
  }
);

/* =========================================================
   STAFF LOGIN
========================================================= */

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

    /* ================================
       CHECK ROLE
    ================================= */

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

    /* ================================
       CHECK STATUS
    ================================= */

    if (staff.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your staff account is currently inactive or restricted."
      });
    }

    /* ================================
       CHECK PASSWORD
    ================================= */

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

    /* ================================
       CREATE TOKEN
    ================================= */

    const token = jwt.sign(
      {
        id: staff.id,
        username: staff.username,
        role: staff.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h"
      }
    );

    /* ================================
       UPDATE LAST LOGIN
    ================================= */

    const loginTime = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("admin_users")
      .update({
        last_login_at: loginTime
      })
      .eq("id", staff.id);

    if (updateError) {
      console.error(
        "LAST LOGIN UPDATE ERROR:",
        updateError
      );
    }

    /* ================================
       RESPONSE
    ================================= */

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

/* ADMIN DASHBOARD OVERVIEW */
app.get("/api/admin/overview", async (req, res) => {
  try {
    const { count: totalUsers, error: usersError } = await supabase
      .from("customer_users")
      .select("*", { count: "exact", head: true });

    if (usersError) throw usersError;

    const { count: pendingOrders, error: pendingError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "Preparing");

    if (pendingError) throw pendingError;

    const { count: completedOrders, error: completedError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "Completed");

    if (completedError) throw completedError;

    const today = new Date();
today.setHours(0, 0, 0, 0);

const { data: salesData, error: salesError } = await supabase
  .from("orders")
  .select("total_amount, created_at")
  .eq("status", "Completed")
  .gte("created_at", today.toISOString());

    if (salesError) throw salesError;

    const todayRevenue = (salesData || []).reduce(
  (sum, order) => sum + Number(order.total_amount || 0),
  0
);

    const { data: recentOrders, error: recentError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentError) throw recentError;

    const { data: recentAnnouncements, error: announcementError } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (announcementError) throw announcementError;

    res.json({
  success: true,
  totalUsers: totalUsers || 0,
  pendingOrders: pendingOrders || 0,
  completedOrders: completedOrders || 0,
  revenue: todayRevenue,
  recentOrders: recentOrders || [],
  recentAnnouncements: recentAnnouncements || []
});

  } catch (error) {
    console.error("ADMIN OVERVIEW ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* SALES SUMMARY */
app.get("/api/admin/sales-summary", async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("total_amount, created_at")
      .eq("status", "completed");

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

/* CREATE ORDER */
// Create order and deduct stock atomically; save item snapshots for preparation.
app.post("/api/orders", async (req, res) => {
  try {
    const {
      user_id, customer_name, customer_email, customer_phone,
      total_amount, payment_method, items
    } = req.body;
    if (!Array.isArray(items) || items.length === 0 ||
        !["PayPal", "COD"].includes(payment_method) ||
        !Number.isFinite(Number(total_amount)) || Number(total_amount) <= 0) {
      return res.status(400).json({ success: false, message: "Valid items, payment method and total amount are required." });
    }
    const { data, error } = await supabase.rpc("jcn_inventory_create_order", {
      p_payload: {
        user_id: user_id || null, customer_name, customer_email, customer_phone,
        total_amount, payment_method, items
      }
    });
    if (error) throw error;
    return res.json({ success: true, message: "Order placed successfully.", order: data });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error.message);
    return res.status(error.code === "P0001" ? 400 : 500).json({
      success: false,
      message: error.code === "P0001" ? error.message : "Could not create order. Check inventory migration and server logs."
    });
  }
});

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

/* CANCEL ORDER */
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

/* MANAGE USERS - GET ALL USERS */
app.get("/api/admin/users", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customer_users")
      .select("id, full_name, first_name, middle_name, last_name, phone, email, username, status, restriction_until, restriction_reason, created_at")
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

/* RESTRICT USER WITH DAYS */
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
    restrictionUntil.setDate(restrictionUntil.getDate() + restrictionDays);

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

/* UNRESTRICT USER */
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

/* DELETE USER */
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
          message: "This customer cannot be deleted because they have existing orders."
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

/* Announcements delete */
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

/* GET PRODUCTS */
app.get("/api/admin/products", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
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
      products: data || []
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.patch("/api/admin/products/:id/stock", async (req, res) => {
  console.log("EDIT STOCK ROUTE HIT");
  console.log("PRODUCT ID:", req.params.id);
  console.log("BODY:", req.body);

  try {
    const { id } = req.params;
    const { sizes } = req.body;

    if (!Array.isArray(sizes)) {
      return res.status(400).json({
        success: false,
        message: "Sizes must be an array."
      });
    }

    const cleanSizes = sizes.map(item => ({
      size: item.size,
      length: item.length,
      width: item.width,
      sleeve: item.sleeve,
      qty: Number(item.qty || 0)
    }));

    const totalQuantity = cleanSizes.reduce((sum, item) => {
      return sum + Number(item.qty || 0);
    }, 0);

    const { data, error } = await supabase
      .from("products")
      .update({
        sizes: cleanSizes,
        quantity: totalQuantity
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.log("SUPABASE STOCK ERROR:", error);
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Stock updated successfully.",
      product: data
    });

  } catch (error) {
    console.log("EDIT STOCK SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});



/* ADD PRODUCT WITH IMAGE */
app.post("/api/admin/products", upload.single("product_image"), async (req, res) => {
  try {
    const {
  title,
  description,
  price,
  category,
  quantity,
  colors,
  sizes
} = req.body;

    let imageUrl = null;

    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype
        });

      if (uploadError) {
        return res.status(400).json({ success: false, message: uploadError.message });
      }

      const { data: publicUrl } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      imageUrl = publicUrl.publicUrl;
    }

    const { error } = await supabase
  .from("products")
  .insert([
    {
      title,
      description,
      price: Number(price),
      category,
      quantity: Number(quantity || 0),
      product_image: imageUrl,
      colors: JSON.parse(colors),
      sizes: JSON.parse(sizes)
    }
  ]);

    if (error) return res.status(400).json({ success: false, message: error.message });

    res.json({ success: true, message: "Product added successfully." });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* DELETE PRODUCT */
app.delete("/api/admin/products/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) return res.status(400).json({ success: false, message: error.message });

  res.json({ success: true, message: "Product deleted successfully." });
});

/* ADD / UPDATE PRODUCT SALE */
app.patch("/api/admin/products/:id/sale", async (req, res) => {
  try {
    const { id } = req.params;
    const { sale_percent, sale_end } = req.body;

    const { data, error } = await supabase
      .from("products")
      .update({
        sale_percent: Number(sale_percent || 0),
        sale_end: sale_end
      })
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
        message: "Product not found or sale not updated."
      });
    }

    res.json({
      success: true,
      message: "Sale updated successfully.",
      product: data[0]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/* =============================
   ANNOUNCEMENTS
============================= */

/* CREATE ANNOUNCEMENT */
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
      .insert([
        {
          title,
          message
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

/* GET ANNOUNCEMENTS */
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

/* =============================
   REPORTS API
============================= */

app.get("/api/admin/reports", async (req, res) => {
  try {
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*");

    if (ordersError) {
      return res.status(400).json({
        success: false,
        message: ordersError.message
      });
    }

    const { count: totalUsers, error: usersError } = await supabase
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
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    const statusCounts = {
      Pending: activeOrders.filter(o => o.status === "Pending").length,
      Preparing: activeOrders.filter(o => o.status === "Preparing").length,
      "To Deliver": activeOrders.filter(o => o.status === "To Deliver").length,
      Completed: activeOrders.filter(o => o.status === "Completed").length,
      Cancelled: allOrders.filter(o => o.status === "Cancelled").length
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

/* =============================
   ADMIN SETTINGS
============================= */

/* GET ADMIN SETTINGS */
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


/* UPDATE ADMIN SETTINGS */
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

/* CUSTOMER PROFILE - UPDATE INFO */
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

/* CUSTOMER PROFILE - CHANGE PASSWORD */
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

    const { data: customer, error: findError } = await supabase
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

/* SAVE CUSTOM DESIGN */
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
      .insert([{
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
      }])
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

/* CUSTOMER CANCEL ORDER */
app.patch("/api/customer/orders/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: order, error: findError } = await supabase
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

    /* PAYPAL REFUND */
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

    /* COD / UNPAID */
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

/* =========================================================
   ADD J&T TRACKING NUMBER
========================================================= */

app.post("/api/orders/:id/tracking", async (req, res) => {
  try {
    const { id } = req.params;
    const { tracking_number } = req.body || {};

    /* =====================================================
       1. VALIDATE TRACKING NUMBER
    ===================================================== */

    if (
      !tracking_number ||
      String(tracking_number).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Tracking number is required."
      });
    }

    const trackingNumber =
      String(tracking_number).trim();


    /* =====================================================
       2. CHECK IF ORDER EXISTS
    ===================================================== */

    const {
      data: order,
      error: orderFetchError
    } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();


    if (orderFetchError || !order) {
      console.error(
        "ORDER FETCH ERROR:",
        orderFetchError
      );

      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }


    /* =====================================================
       3. CHECK ORDER STATUS
    ===================================================== */

    if (
      order.status === "Cancelled" ||
      order.status === "Canceled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot add tracking to a cancelled order."
      });
    }


    if (
      order.status === "Completed" ||
      order.status === "Delivered"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot add tracking to a completed order."
      });
    }


    /* =====================================================
       4. CREATE TRACKING IN AFTERSHIP
    ===================================================== */

    let aftershipTracking = null;

    try {
      const aftershipResponse =
        await axios.post(
          "https://api.aftership.com/tracking/2024-04/trackings",
          {
            tracking: {
              tracking_number:
                trackingNumber,

              slug:
                "jtexpress-ph",

              title:
                order.order_number ||
                `Order ${order.id}`,

              order_id:
                String(
                  order.order_number ||
                  order.id
                )
            }
          },
          {
            headers: {
              "Content-Type":
                "application/json",

              "as-api-key":
                process.env.AFTERSHIP_API_KEY
            }
          }
        );


      aftershipTracking =
        aftershipResponse.data
          ?.data
          ?.tracking || null;


      console.log(
        "AFTERSHIP TRACKING CREATED:",
        aftershipTracking
      );

    } catch (aftershipError) {

      /*
        Hindi natin agad ipa-fail ang request.

        Posibleng existing na ang tracking
        number sa AfterShip.
      */

      console.error(
        "AFTERSHIP CREATE ERROR:",
        aftershipError.response?.data ||
        aftershipError.message
      );
    }


    /* =====================================================
       5. GET INITIAL AFTERSHIP INFORMATION
    ===================================================== */

    let aftershipTrackingId = null;

    let latestLocation = null;

    let latestCheckpointDate = null;

    let latestMessage = null;


    if (aftershipTracking) {

      aftershipTrackingId =
        aftershipTracking.id ||
        null;


      const checkpoints =
        Array.isArray(
          aftershipTracking.checkpoints
        )
          ? aftershipTracking.checkpoints
          : [];


      /* ===================================================
         GET LATEST CHECKPOINT
      =================================================== */

      if (checkpoints.length > 0) {

        const sortedCheckpoints =
          [...checkpoints].sort(
            (a, b) => {

              const dateA =
                new Date(
                  a.checkpoint_time || 0
                ).getTime();

              const dateB =
                new Date(
                  b.checkpoint_time || 0
                ).getTime();

              return dateB - dateA;
            }
          );


        const latest =
          sortedCheckpoints[0];


        /* LOCATION */

        latestLocation =
          latest.location ||

          [
            latest.city,
            latest.state,
            latest.country_name
          ]
            .filter(Boolean)
            .join(", ") ||

          null;


        /* DATE */

        latestCheckpointDate =
          latest.checkpoint_time ||
          null;


        /* MESSAGE */

        latestMessage =
          latest.message ||
          latest.subtag_message ||
          null;
      }
    }


    /* =====================================================
       6. DETERMINE INITIAL STATUS
    ===================================================== */

    /*
      IMPORTANT:

      Ang pagkakaroon lang ng tracking number
      ay HINDI ibig sabihin na picked up na
      ng J&T ang parcel.

      Kaya default:
      To Ship = Waiting for Courier
    */

    let newOrderStatus =
      "To Ship";


    /*
      Kung may initial AfterShip status,
      iche-check natin kung may actual movement.
    */

    const aftershipStatus =
      String(
        aftershipTracking?.tag || ""
      )
        .trim()
        .toLowerCase();


    console.log(
      "INITIAL AFTERSHIP STATUS:",
      aftershipStatus
    );


    /*
      Pending / Info Received

      Tracking number registered,
      pero hindi pa picked up.
    */

    if (
      aftershipStatus === "" ||
      aftershipStatus === "pending" ||
      aftershipStatus === "inforeceived" ||
      aftershipStatus === "info_received"
    ) {

      newOrderStatus =
        "To Ship";

    }


    /*
      Actual carrier movement detected.
    */

    else if (
      aftershipStatus === "intransit" ||
      aftershipStatus === "in_transit" ||
      aftershipStatus === "outfordelivery" ||
      aftershipStatus === "out_for_delivery" ||
      aftershipStatus === "attemptfail" ||
      aftershipStatus === "attempt_fail" ||
      aftershipStatus === "exception"
    ) {

      newOrderStatus =
        "To Receive";

    }


    /*
      Even if J&T says Delivered,
      customer still needs to press
      "Order Received / Complete Order".

      So keep it To Receive.
    */

    else if (
      aftershipStatus === "delivered"
    ) {

      newOrderStatus =
        "To Receive";

    }


    /* =====================================================
       7. DEFAULT MESSAGE
    ===================================================== */

    if (
      newOrderStatus === "To Ship" &&
      !latestMessage
    ) {

      latestMessage =
        "Waiting for J&T courier pickup.";

    }


    /* =====================================================
       8. BUILD DATABASE UPDATE
    ===================================================== */

    const updatePayload = {

      tracking_number:
        trackingNumber,

      courier:
        "J&T Express",

      status:
        newOrderStatus,

      tracking_message:
        latestMessage

    };


    /* AFTERSHIP ID */

    if (aftershipTrackingId) {

      updatePayload
        .aftership_tracking_id =
        aftershipTrackingId;

    }


    /* LOCATION */

    if (latestLocation) {

      updatePayload
        .tracking_location =
        latestLocation;

    }


    /* DATE */

    if (latestCheckpointDate) {

      updatePayload
        .tracking_updated_at =
        latestCheckpointDate;

    }


    /* =====================================================
       9. UPDATE ORDER IN SUPABASE
    ===================================================== */

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

      console.error(
        "TRACKING DATABASE UPDATE ERROR:",
        updateError
      );


      return res.status(400).json({
        success: false,
        message: updateError.message
      });
    }


    /* =====================================================
       10. SUCCESS RESPONSE
    ===================================================== */

    return res.json({

      success: true,

      message:
        newOrderStatus === "To Ship"

          ? "Tracking number added. Waiting for J&T courier pickup."

          : "Tracking number added and shipment is already in transit.",


      order:
        updatedOrder,


      tracking: {

        tracking_number:
          trackingNumber,

        courier:
          "J&T Express",

        aftership_tracking_id:
          aftershipTrackingId,

        status:
          newOrderStatus === "To Ship"
            ? "Waiting for Courier"
            : "In Transit",

        latest_location:
          latestLocation,

        latest_date:
          latestCheckpointDate,

        latest_message:
          latestMessage

      }

    });


  } catch (error) {

    console.error(
      "ADD J&T TRACKING ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "Unable to add J&T tracking number."

    });

  }
});

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
      message: error.response?.data?.meta?.message || error.message
    });
  }
});

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

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || "PayPal token error");
  }

  return data.access_token;
}

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`, {
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
    });

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

/* CREATE PAYPAL REDIRECT ORDER */
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
            return_url: `http://localhost:5000/api/paypal/success?system_order_id=${system_order_id}`,
            cancel_url: `http://localhost:5000/api/paypal/cancel?system_order_id=${system_order_id}`
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
      link => link.rel === "approve" || link.rel === "payer-action"
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


/* PAYPAL SUCCESS RETURN */
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

    console.log("PAYPAL CAPTURE DATA:", paypalData);

    if (!response.ok || paypalData.status !== "COMPLETED") {
      return res.redirect(`${CHECKOUT_PAGE}?payment=failed`);
    }

    const captureId =
      paypalData.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;

    const { data: updatedOrder, error } = await supabase
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

    console.log("UPDATED PAYPAL ORDER:", updatedOrder);
    console.log("UPDATE ERROR:", error);

    if (error || !updatedOrder) {
      return res.redirect(`${CHECKOUT_PAGE}?payment=update_failed`);
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

/* PAYPAL CANCEL RETURN */
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

// LIVE INVENTORY ROUTES
app.use("/api/inventory", require("./backend/routes/inventory")({
  supabase,
  verifyStaffToken
}));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

  