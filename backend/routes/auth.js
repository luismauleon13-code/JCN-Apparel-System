const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");

const otpStore = {};

router.post("/register", async (req, res) => {

  const { fullname, email, password } = req.body;

  // Generate 6-digit OTP
  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

  // Save OTP temporarily
  otpStore[email] = otp;

  try {

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "YOUR_EMAIL@gmail.com",
        pass: "YOUR_APP_PASSWORD",
      },
    });

    await transporter.sendMail({
      from: "YOUR_EMAIL@gmail.com",
      to: email,
      subject: "Email Verification Code",
      html: `
        <h2>Email Verification</h2>
        <p>Your verification code is:</p>
        <h1>${otp}</h1>
      `,
    });

    res.status(200).json({
      message: "OTP sent successfully",
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Failed to send OTP",
    });
  }
});

module.exports = router;

router.post("/verify-otp", async (req, res) => {

  const { email, otp } = req.body;

  if (otpStore[email] === otp) {

    delete otpStore[email];

    return res.status(200).json({
      message: "OTP verified",
    });

  } else {

    return res.status(400).json({
      message: "Invalid OTP",
    });

  }

});