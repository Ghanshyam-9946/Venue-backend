const tokenBlacklistModel = require('../models/blackList.model')
const userModel = require('../models/user.model')
const jwt = require('jsonwebtoken')
const emailService = require('../services/email.service')
const crypto = require("crypto");

async function userRegisterController(req, res) {
    try {
        const { name, email, password, department } = req.body;
        
        if (!name || !email || !password || !department) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        
        if (!email.endsWith("@sistec.ac.in")) {
            return res.status(400).json({ success: false, message: "Only @sistec.ac.in emails are allowed to register" });
        }
        
        const isExist = await userModel.findOne({ email });
        if (isExist) {
            return res.status(422).json({ success: false, message: "Email already exists" });
        }
        
        const user = await userModel.create({
            email,
            name,
            password,
            department,
            role: "faculty",
            isFirstLogin: false 
        });
        
        return res.status(201).json({
            success: true,
            message: "User registered successfully"
        });
    } catch (error) {
        console.log("REGISTER ERROR", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
}

async function changeFirstTimePasswordController(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.userId;
        const user = await userModel.findById(userId).select("+password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isValidPassword = await user.comparePassword(currentPassword);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, message: "Invalid current password" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
        }

        user.password = newPassword;
        user.isFirstLogin = false;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password changed successfully",
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                isFirstLogin: false
            }
        });
    } catch (error) {
        console.log("CHANGE PWD ERROR", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
}

async function userLoginController(req, res) {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email }).select("+password");

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
            role: user.role   
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "3d"
        }
    );

    res.cookie("token", token);

    res.status(200).json({
        user: {
            _id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            isFirstLogin: user.isFirstLogin
        },
        token
    });

    // We can still trigger login email if we want, or remove it. I'll keep it.
    await emailService.sendLoginEmail(user.email, user.name);
}

async function userLogoutController(req,res){
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if(!token){
        return res.status(400).json({
            message: "Token is required for logout",
            status: "failed"
        })
    }

    await tokenBlacklistModel.create({token:token});
    res.clearCookie("token");
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

    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

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
    changeFirstTimePasswordController,
    userLoginController,
    userLogoutController,
    forgotPasswordController,
    resetPasswordController,
    userRegisterController

}