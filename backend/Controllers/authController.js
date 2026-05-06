const supabase = require("../config/supabaseClient");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/* CUSTOMER REGISTER */
exports.customerRegister = async (req, res) => {
  try {
    const { full_name, email, username, password } = req.body;

    if (!full_name || !email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill out all fields."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase
      .from("customer_users")
      .insert([
        {
          full_name,
          email,
          username,
          password: hashedPassword
        }
      ]);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(201).json({
      success: true,
      message: "Account created successfully."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/* CUSTOMER LOGIN */
exports.customerLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data: user, error } = await supabase
      .from("customer_users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !user) {
      return res.status(400).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: "customer"
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        username: user.username,
        role: "customer"
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/* FIXED ADMIN LOGIN */
exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !admin) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin credentials."
      });
    }

    if (password !== admin.password) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin credentials."
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      message: "Admin login successful.",
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: "admin"
      }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};