const express = require("express");
const router = express.Router();


const { createBooking , getMyBookings, getBookedSlots, getWeeklySchedule, getPublicVenues } = require("../controllers/booking.controller.js");
const { authMiddleware } = require("../middleware/auth.middleware");

router.post("/create", authMiddleware, createBooking);

router.get("/my", authMiddleware, getMyBookings);

router.get("/venue/:id/booked-slots", authMiddleware, getBookedSlots);

// Public routes - no auth needed for landing page
router.get("/weekly-schedule", getWeeklySchedule);
router.get("/venues", getPublicVenues);

module.exports = router;
