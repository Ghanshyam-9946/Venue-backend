const express = require("express");
const router = express.Router();


const { createBooking , getMyBookings, getBookedSlots } = require("../controllers/booking.controller.js");
const { authMiddleware } = require("../middleware/auth.middleware");

router.post("/create", authMiddleware, createBooking);

router.get("/my", authMiddleware, getMyBookings);

router.get("/venue/:id/booked-slots", authMiddleware, getBookedSlots);

module.exports = router;