const express = require('express');
const authController = require("../controllers/auth.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const adminController = require('../controllers/admin.controller');

const router = express.Router();

router.get('/departments', adminController.getAllDepartments);

router.post('/login', authController.userLoginController);

router.post('/send-otp', authController.sendOTPController);

router.post('/register', authController.userRegisterController);

router.post('/logout', authController.userLogoutController)

router.post('/forgot-password', authController.forgotPasswordController)

router.post('/reset-password/:token', authController.resetPasswordController)

module.exports = router;