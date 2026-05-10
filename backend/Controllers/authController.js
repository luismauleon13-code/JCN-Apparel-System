// Remove any nodemailer imports at the top
exports.register = async (req, res) => {
    const { fullname, email, username, password } = req.body;

    try {
        // Logic to save user to your database goes here
        console.log("Registering user:", fullname);

        // Immediately send success without OTP
        res.status(200).json({
            success: true,
            message: "Registration successful!"
        });
    } catch (error) {
        console.error("Controller Error:", error);
        res.status(500).json({
            success: false,
            message: "Cannot connect to server."
        });
    }
};