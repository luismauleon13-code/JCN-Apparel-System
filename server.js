const express = require("express");
const cors = require("cors");

const app = express();

/* MIDDLEWARE */
app.use(cors());
app.use(express.json());

/* TEST */
app.get("/", (req, res) => {
  res.send("Server is running");
});

/* REGISTER */
app.post("/api/auth/register", async (req, res) => {

  try {

    const { fullname, email, username, password } = req.body;

    console.log("REGISTER:");
    console.log(fullname, email, username);

    res.status(200).json({
      success: true,
      message: "Registration successful!"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

});

/* CUSTOMER LOGIN */
app.post("/api/auth/customer-login", async (req, res) => {

  try {

    const { username, password } = req.body;

    if (username && password) {

      res.status(200).json({
        success: true,
        token: "customer-token",
        user: {
          username
        }
      });

    } else {

      res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });

    }

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

});

/* ADMIN LOGIN */
app.post("/api/auth/admin-login", async (req, res) => {

  try {

    const { username, password } = req.body;

    if (
      username === "admin" &&
      password === "admin123"
    ) {

      res.status(200).json({
        success: true,
        token: "admin-token",
        user: {
          username: "admin",
          role: "admin"
        }
      });

    } else {

      res.status(401).json({
        success: false,
        message: "Invalid admin credentials"
      });

    }

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

});

/* PORT */
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});