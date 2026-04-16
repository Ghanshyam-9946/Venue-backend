const express = require('express')
const adminController = require('../controllers/admin.controller')
const { authMiddleware, isAdmin, isSuperadmin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload')

const router = express.Router()

// Superadmin only
router.get("/users", authMiddleware, isSuperadmin, adminController.getAllUsers);
router.put("/user/:id/role", authMiddleware, isSuperadmin, adminController.updateUserRole);
router.delete("/user/:id", authMiddleware, isSuperadmin, adminController.deleteUser);
router.post("/department", authMiddleware, isSuperadmin, adminController.createDepartment);
router.put("/department/:id", authMiddleware, isSuperadmin, adminController.updateDepartment);
router.delete("/department/:id", authMiddleware, isSuperadmin, adminController.deleteDepartment);
router.get("/blocks", authMiddleware, adminController.getAllBlocks);
router.post("/block", authMiddleware, isSuperadmin, adminController.createBlock);
router.put("/block/:id", authMiddleware, isSuperadmin, adminController.updateBlock);
router.delete("/block/:id", authMiddleware, isSuperadmin, adminController.deleteBlock);
router.post("/setup-blocks", authMiddleware, isSuperadmin, adminController.setupInitialBlocks);


// Admin & Superadmin
router.post("/register-faculty", authMiddleware, isAdmin, adminController.registerFaculty);
router.post("/venue", authMiddleware, isAdmin, upload.single("image"), adminController.createVenue);
router.put("/venue/:id", authMiddleware, isAdmin, upload.single("image"), adminController.updateVenue);
router.delete("/venue/:id", authMiddleware, isAdmin, adminController.deleteVenue);
router.get("/requests", authMiddleware, isAdmin, adminController.getAllRequests);
router.put("/request/:id", authMiddleware, isAdmin, adminController.updateRequestStatus);
router.get("/department-history", authMiddleware, isAdmin, adminController.getDepartmentHistory);
router.get("/history-statement", authMiddleware, isAdmin, adminController.getAllHistoryStatement);
router.put("/batch-request/:batchId", authMiddleware, isAdmin, adminController.updateBatchStatus);

// Public / Authenticated Users (for VenuesList page)
router.get("/venues", authMiddleware, adminController.getAllVenues);
router.get("/venue/:id", authMiddleware, adminController.getSingleVenue);
router.get("/departments", authMiddleware, adminController.getAllDepartments);

module.exports = router;