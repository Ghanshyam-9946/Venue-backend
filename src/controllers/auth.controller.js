const tokenBlacklistModel = require('../models/blackList.model')
const userModel = require('../models/user.model')
const jwt = require('jsonwebtoken')
const emailService = require('../services/email.service')
const crypto = require("crypto");
const otpModel = require("../models/otp.model");

async function userRegisterController(req, res) {
  try {
    const { name, email, password, department, designation, otp } = req.body;

    if (!name || !email || !password || !department || !designation || !otp) {
      return res.status(400).json({ success: false, message: "All fields including OTP and Designation are required" });
    }

    if (!email.endsWith("@sistec.ac.in")) {
      return res.status(400).json({ success: false, message: "Only @sistec.ac.in emails are allowed to register" });
    }

    const isExist = await userModel.findOne({ email });
    if (isExist) {
      return res.status(422).json({ success: false, message: "Email already exists" });
    }

    // Verify OTP
    const otpRecord = await otpModel.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    const user = await userModel.create({
      email,
      name,
      password,
      department,
      designation,
      role: "faculty",
      isFirstLogin: false
    });

    // Delete the used OTP
    await otpModel.deleteOne({ _id: otpRecord._id });

    // Send registration email
    await emailService.sendRegistrationEmail(user.email, user.name);

    return res.status(201).json({
      success: true,
      message: "User registered successfully"
    });
  } catch (error) {
    console.log("REGISTER ERROR", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
}

async function sendOTPController(req, res) {
  try {
    const { email } = req.body;
    console.log("📩 OTP Request received for:", email);

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    if (!email.endsWith("@sistec.ac.in")) {
      return res.status(400).json({ success: false, message: "Only @sistec.ac.in emails are permitted" });
    }

    // Check environment variables
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error("❌ SMTP credentials missing in environment variables!");
      return res.status(500).json({ success: false, message: "Server configuration error: SMTP credentials missing" });
    }

    const isExist = await userModel.findOne({ email });
    if (isExist) {
      return res.status(422).json({ success: false, message: "Email already registered. Please login." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated OTP for", email, ":", otp);

    // Save to DB
    try {
      await otpModel.deleteMany({ email });
      await otpModel.create({ email, otp });
    } catch (dbError) {
      console.error("❌ Database error during OTP save:", dbError.message);
      return res.status(500).json({ success: false, message: "Database error: " + dbError.message });
    }

    // Send OTP email
    console.log("Attempting to send OTP email to:", email);
    try {
      const emailSent = await emailService.sendOTPEmail(email, otp);
      if (!emailSent) {
        return res.status(500).json({ success: false, message: "Failed to send OTP email. Possible SMTP block." });
      }
    } catch (emailError) {
      console.error("❌ SMTP Send error:", emailError.message);
      return res.status(500).json({ success: false, message: "Email service error: " + emailError.message });
    }

    console.log("OTP email sent successfully to:", email);
    return res.status(200).json({ success: true, message: "OTP sent to email successfully" });

  } catch (error) {
    console.log("SEND OTP GLOBAL ERROR", error);
    return res.status(500).json({ success: false, message: "Global error: " + error.message });
  }
}

async function userLoginController(req, res) {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email }).select("+password").populate("department", "name");

  if (!user) {
    return res.status(401).json({
      message: "User not found",
      status: "failed"
    });
  }

  const isValidPassword = await user.comparePassword(password);

  if (!isValidPassword) {
    return res.status(401).json({
      message: "Password is invalid",
      status: "failed"
    });
  }

  const token = jwt.sign(
    {
      userId: user._id,
      role: user.role,
      department: user.department
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "3d"
    }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: true, // Required for sameSite: 'none'
    sameSite: 'none',
    maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
  });

  res.status(200).json({
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isFirstLogin: user.isFirstLogin,
      mobile: user.mobile,
      avatar: user.avatar,
      department: user.department
    },
    token
  });

  // We can still trigger login email if we want, or remove it. I'll keep it.
  // await emailService.sendLoginEmail(user.email, user.name);
}

async function userLogoutController(req, res) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(400).json({
      message: "Token is required for logout",
      status: "failed"
    })
  }

  await tokenBlacklistModel.create({ token: token });
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.status(200).json({
    message: "User logged out successfully"
  })
}

//Forgot password controller
const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const resetToken = user.generateResetToken();

    await user.save({ validateBeforeSave: false });

    let frontendUrl = (process.env.FRONTEND_URL || 'https://venue-frontend-indol.vercel.app').trim();
    if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
        frontendUrl = 'https://' + frontendUrl;
    }
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    console.log("RESET URL:", resetUrl);
    console.log("PLAIN TOKEN:", resetToken);
    console.log("HASHED TOKEN (DB):", user.resetPasswordToken);
    console.log("EXPIRY:", user.resetPasswordExpire);

    await emailService.sendForgotPasswordEmail(user.email, resetUrl);

    return res.status(200).json({
      success: true,
      message: "Reset password link sent to email"
    });

  } catch (error) {
    console.log("FORGOT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

//Reset password controller

const resetPasswordController = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await userModel.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });


    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token is invalid or expired"
      });
    }

    user.password = password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful"
    });

  } catch (error) {
    console.log("RESET ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

module.exports = {
  userLoginController,
  userLogoutController,
  forgotPasswordController,
  resetPasswordController,
  userRegisterController,
  sendOTPController
}