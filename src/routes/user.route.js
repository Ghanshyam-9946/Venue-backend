const express = require('express');
const userController = require('../controllers/user.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, upload.single('avatar'), userController.updateProfile);

module.exports = router;
