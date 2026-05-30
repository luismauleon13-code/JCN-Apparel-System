const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const supabase = require("./backend/config/supabaseClient");

const app = express();

app.use(cors());
app.use(express.json());

/* ===========================
   EMAIL OTP CONFIG
=========================== */

const otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.get("/", (req, res) => {
  res.send("Server is running");
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

/* SEND OTP */
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required."
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[email] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    };

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

    res.json({
      success: true,
      message: "OTP sent to email."
    });

  } catch (error) {
    console.error("SEND OTP ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP.",
      error: error.message
    });
  }
});
/* CUSTOMER REGISTER */
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

const storedOtp = otpStore[email];

if (!storedOtp) {
  return res.status(400).json({
    success: false,
    message: "Please request an OTP first."
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

/* COMBINE FULL NAME */
const fullname =
  `${firstName} ${middleName} ${lastName}`
    .replace(/\s+/g, " ")
    .trim();

    if (!fullname || !email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }
    if (!fullname || !email || !username || !password) {
  return res.status(400).json({
    success: false,
    message: "All fields are required"
  });
}

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase.from("customer_users").insert([
      {   
  full_name: fullname,
  first_name: firstName,
  middle_name: middleName,
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
      message: "Registration successful!"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
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

    const { data: customer, error } = await supabase
      .from("customer_users")
      .select("*")
      .eq("username", username)
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

    const passwordMatch = customer.password.startsWith("$2")
      ? await bcrypt.compare(password, customer.password)
      : password === customer.password;

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
        status: customer.status || "active",
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

/* ADMIN DASHBOARD OVERVIEW */
app.get("/api/admin/overview", async (req, res) => {
  try {
    const { count: totalUsers, error: usersError } = await supabase
      .from("customer_users")
      .select("*", { count: "exact", head: true });

    if (usersError) {
      return res.status(500).json({
        success: false,
        message: usersError.message
      });
    }

    const { count: pendingOrders, error: pendingError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "Preparing");

    if (pendingError) {
      return res.status(500).json({
        success: false,
        message: pendingError.message
      });
    }

    const { count: completedOrders, error: completedError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "Completed");

    if (completedError) {
      return res.status(500).json({
        success: false,
        message: completedError.message
      });
    }

    const { data: salesData, error: salesError } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("status", "completed");

    if (salesError) {
      return res.status(500).json({
        success: false,
        message: salesError.message
      });
    }

    let revenue = 0;

    (salesData || []).forEach(order => {
      revenue += Number(order.total_amount || 0);
    });

    const { data: recentOrders, error: recentError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentError) {
      return res.status(500).json({
        success: false,
        message: recentError.message
      });
    }

    const { data: recentAnnouncements } = await supabase
  .from("announcements")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(5);

    res.json({
      success: true,
      totalUsers: totalUsers || 0,
      pendingOrders: pendingOrders || 0,
      completedOrders: completedOrders || 0,
      revenue,
      recentOrders: recentOrders || [],
      recentAnnouncements: recentAnnouncements || []
    });

  } catch (error) {
    console.error("ADMIN OVERVIEW ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
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
app.post("/api/orders", async (req, res) => {

  try {

    const {
      user_id,
      customer_name,
      customer_email,
      customer_phone,
      total_amount,
      payment_method
    } = req.body;

    if (!total_amount || !payment_method) {
      return res.status(400).json({
        success: false,
        message: "Total amount and payment method required."
      });
    }

    if (!["PayPal", "COD"].includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method."
      });
    }

    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          user_id: user_id || null,

          customer_name,
          customer_email,
          customer_phone,

          total_amount: Number(total_amount),

          payment_method,

          payment_status:
            payment_method === "PayPal"
              ? "Paid"
              : "Pending",

          status: "Preparing"
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
      message: "Order placed successfully.",
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

    const { error } = await supabase
      .from("customer_users")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error("DELETE USER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
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

/* ADD PRODUCT WITH IMAGE */
app.post("/api/admin/products", upload.single("product_image"), async (req, res) => {
  try {
    const { title, description, price, category, colors, sizes } = req.body;

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

    const { error } = await supabase.from("products").insert([
      {
        title,
        description,
        price: Number(price),
        category,
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

    const {
      sale_percent,
      sale_end
    } = req.body;

    const { error } = await supabase
      .from("products")
      .update({
        sale_percent: Number(sale_percent || 0),
        sale_end
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
      message: "Sale updated successfully."
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

    const totalSales = allOrders
      .filter(order => order.status === "Completed")
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    const statusCounts = {
      Preparing: allOrders.filter(o => o.status === "Preparing").length,
      "To Deliver": allOrders.filter(o => o.status === "To Deliver").length,
      Completed: allOrders.filter(o => o.status === "Completed").length,
      Cancelled: allOrders.filter(o => o.status === "Cancelled").length
    };

    res.json({
      success: true,
      totalSales,
      totalOrders: allOrders.length,
      totalUsers: totalUsers || 0,
      delivered: statusCounts.Completed,
      statusCounts,
      orders: allOrders
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
      .limit(1)
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

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
    const {
      id,
      admin_name,
      email,
      contact_number,
      shop_name,
      shop_address,
      business_email,
      email_notifications,
      auto_generate_reports,
      maintenance_mode
    } = req.body;

    const { data, error } = await supabase
      .from("admin_settings")
      .update({
        admin_name,
        email,
        contact_number,
        shop_name,
        shop_address,
        business_email,
        email_notifications,
        auto_generate_reports,
        maintenance_mode,
        updated_at: new Date().toISOString()
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
      message: "Settings saved successfully.",
      settings: data[0]
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
      order.status === "To Deliver" ||
      order.status === "Shipped" ||
      order.status === "Completed" ||
      order.status === "Delivered"
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot cancel this order because it is already shipped or completed."
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
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
