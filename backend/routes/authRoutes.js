const express = require("express");
const router = express.Router();

const {
  customerRegister,
  customerLogin,
  adminLogin
} = require("../controllers/authController");

router.post("/customer-register", customerRegister);
router.post("/customer-login", customerLogin);
router.post("/admin-login", adminLogin);

module.exports = router;