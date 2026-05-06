app.post("/api/auth/register", async (req, res) => {
  const { fullname, email, username, password } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "luismauleon13@gmail.com", // sender email mo
        pass: "empt mntl xltp ffdb"            // Gmail app password
      }
    });

    await transporter.sendMail({
  from: "JCN Clothing <luismauleon13@gmail.com>",
  to: email,
  subject: "JCN Email Verification Code",
  html: `
    <h2>Hello ${fullname},</h2>
    <p>Your verification code is:</p>
    <h1>${otp}</h1>
    <p>Please enter this code to verify your account.</p>
  `
});
    });

    res.status(200).json({
  success: true,
  message: "Verification code sent to your email!"
});

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to send verification email."
    });
  }
});