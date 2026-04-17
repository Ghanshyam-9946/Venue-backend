const bookingModel = require("../models/booking.model")
const venueModel = require("../models/venue.model")
const userModel = require("../models/user.model")
const emailService = require("../services/email.service")
const crypto = require("crypto");
const mongoose = require("mongoose");

// Helper to convert "09:30 AM" to minutes from midnight
const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [time, ampm] = timeStr.trim().split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

// Helper to parse "09:00 AM - 11:00 AM" or "Custom: ..."
const parseRange = (timeSlot) => {
    const cleanSlot = timeSlot.replace("Custom: ", "");
    const [startStr, endStr] = cleanSlot.split(" - ");
    return {
        start: parseTimeToMinutes(startStr),
        end: parseTimeToMinutes(endStr)
    };
};

const createBooking = async(req,res)=>{
    try{
        const { venue, venues, date, timeSlot, timeSlots, purpose, requirements, priorityReason } = req.body;

        // Normalize to an array of venue IDs
        let targetVenues = [];
        if (venues && Array.isArray(venues)) {
            targetVenues = venues;
        } else if (venue) {
            targetVenues = [venue];
        }

        // Normalize to an array of timeSlots
        let targetTimeSlots = [];
        if (timeSlots && Array.isArray(timeSlots)) {
            targetTimeSlots = timeSlots;
        } else if (timeSlot) {
            targetTimeSlots = [timeSlot];
        }

        if(targetVenues.length === 0 || !date || targetTimeSlots.length === 0 || !purpose){
            return res.status(400).json({
                success:false,
                message: "All fields are required"
            })
        };

        const existingVenues = [];
        
        // 1. Validate all venues exist and have no conflicts
        for (const venueId of targetVenues) {
            const existingVenue = await venueModel.findById(venueId);
            if(!existingVenue){
                return res.status(404).json({
                    success:false,
                    message:"One or more venues not found"
                })
            };
            
            let conflictFound = false;
            for (const tSlot of targetTimeSlots) {
                const { start, end } = parseRange(tSlot);
                
                // Check for overlapping bookings - prioritising approved ones for conflict flag
                const conflicts = await bookingModel.find({
                    venue: venueId,
                    date: date,
                    status: { $in: ["approved", "pending"] },
                    $or: [
                        { startTime: { $lt: end }, endTime: { $gt: start } }
                    ]
                });

                if (conflicts.length > 0) {
                    // Check if user already has a booking
                    const ownBooking = conflicts.find(c => c.faculty.toString() === req.user.userId.toString());
                    if (ownBooking) {
                        return res.status(400).json({
                            success: false,
                            message: `You already have a ${ownBooking.status} booking for this time.`
                        });
                    }
                    
                    // If any are approved, it's a conflict
                    if (conflicts.some(c => c.status === "approved")) {
                        conflictFound = true;
                    }
                }
            }
            existingVenues.push({ venue: existingVenue, isConflict: conflictFound });
        }

        const createdBookings = [];
        
        // Fetch faculty name for email
        const faculty = await userModel.findById(req.user.userId);
        const facultyName = faculty ? faculty.name : "Unknown Faculty";
        
        let dateString = date;
        if (typeof date.toISOString === "function" || date instanceof Date) {
            dateString = new Date(date).toISOString().split("T")[0];
        }

        const batchId = crypto.randomBytes(8).toString("hex");
        const venueNames = existingVenues.map(v => v.venue.name);
        let firstConflictFaculty = "Unknown Faculty";
        
        // Find the name of the person being conflicted with
        for (const ev of existingVenues) {
            if (ev.isConflict) {
               const c = await bookingModel.findOne({
                   venue: ev.venue._id,
                   date,
                   status: "approved",
                   $or: [
                       { startTime: { $lt: parseRange(targetTimeSlots[0]).end }, endTime: { $gt: parseRange(targetTimeSlots[0]).start } }
                   ]
               }).populate("faculty", "name");
               if (c && c.faculty) {
                   firstConflictFaculty = c.faculty.name;
                   break;
               }
            }
        }

        // 2. Create bookings
        for (let i = 0; i < targetVenues.length; i++) {
            const venueData = existingVenues[i];
            const venueId = targetVenues[i];
            
            // Per-venue check for auto-approval
            const isAdminOfThisVenue = req.user.role === "admin" && 
                                       venueData.venue.department?.toString() === req.user.department?.toString();
            const isSuperAdmin = req.user.role === "superadmin";
            
            // Auto-approve if HOD is booking their OWN venue OR if SuperAdmin is booking ANY venue
            // Provided there is no conflict with an ALREADY approved booking
            const shouldAutoApproveThis = (isAdminOfThisVenue || isSuperAdmin) && !venueData.isConflict;

            for (const tSlot of targetTimeSlots) {
                const { start, end } = parseRange(tSlot);
                const booking = await bookingModel.create({
                    faculty: req.user.userId,
                    venue: venueId,
                    date,
                    timeSlot: tSlot,
                    startTime: start,
                    endTime: end,
                    purpose,
                    requirements: requirements || "",
                    batchId,
                    status: shouldAutoApproveThis ? "approved" : "pending",
                    isConflict: venueData.isConflict,
                    priorityReason: venueData.isConflict ? priorityReason : ""
                });
                createdBookings.push(booking);
            }
        }

        // 3. Notify admins (One email per batch)
        const requesterDept = faculty ? faculty.department : null;
        const venueDeptIds = [...new Set(existingVenues.map(v => v.venue.department?.toString()))].filter(Boolean);

        const adminQuery = {
            $or: [
                { role: "superadmin" },
                { role: "admin", department: { $in: venueDeptIds } },
                requesterDept ? { role: "admin", department: requesterDept } : null
            ].filter(Boolean)
        };
        
        const admins = await userModel.find(adminQuery).select("email");
        const adminEmails = admins.map(a => a.email);
        
        if (adminEmails.length > 0) {
            const timeSlotStr = targetTimeSlots.join(', ');
            const totalConflict = existingVenues.some(v => v.isConflict);
            const hasAutoApproved = createdBookings.some(b => b.status === "approved" && req.user.role === "admin");
            
            if (totalConflict) {
                // Priority request notification to both SuperAdmin and Venue HODs
                await emailService.sendPriorityBookingAdminNotification(
                    adminEmails,
                    facultyName,
                    firstConflictFaculty,
                    venueNames.join(", "),
                    dateString,
                    timeSlotStr,
                    priorityReason
                );
            } else if (hasAutoApproved) {
                // Auto-allocation notification to SuperAdmin
                // HOD doesn't need an email about their own action, but SuperAdmin might
                const superAdmins = await userModel.find({ role: "superadmin" }).select("email");
                if (superAdmins.length > 0) {
                    await emailService.sendNewBookingAdminNotification(
                        superAdmins.map(s => s.email),
                        `HOD ${facultyName} (Auto-Approved)`,
                        venueNames.join(", "),
                        dateString,
                        timeSlotStr,
                        requirements
                    );
                }
                // Send approval email to the requester (HOD)
                await emailService.sendStatusUpdateEmail(
                    faculty.email,
                    faculty.name,
                    "approved",
                    "Self-allocated (Department Head)",
                    venueNames.join(", "),
                    dateString,
                    timeSlotStr
                );
            } else {
                // Normal request notification
                await emailService.sendNewBookingAdminNotification(
                    adminEmails,
                    facultyName,
                    venueNames.join(", "),
                    dateString,
                    timeSlotStr,
                    requirements
                );
            }
        }

        return res.status(201).json({
            success:true,
            message: createdBookings.some(b => b.status === "approved") ? "Booking allocated (Auto-Approve applied)" : ((targetVenues.length > 1 || targetTimeSlots.length > 1) ? "Multi-booking request created" : "Booking request created"),
            booking: (targetVenues.length === 1 && targetTimeSlots.length === 1) ? createdBookings[0] : createdBookings
        });
    }
    catch(error){
        console.log("Create booking error", error);

        res.status(500).json({
            success:false,
            message:"Something went wrong"
        })

    }
}

const getBookedSlots = async (req, res) => {
    try {
        const { id } = req.params; // venue id
        const { date } = req.query;

        if (!id || !date) {
            return res.status(400).json({ success: false, message: "Venue ID and date are required" });
        }

        const bookings = await bookingModel.find({
            venue: id,
            date: date,
            status: { $in: ["approved", "pending"] }
        }).select("timeSlot status");
        
        const bookedSlots = bookings.filter(b => b.status === "approved").map(b => b.timeSlot);
        const pendingSlots = bookings.filter(b => b.status === "pending").map(b => b.timeSlot);

        return res.status(200).json({ success: true, bookedSlots, pendingSlots });
    } catch (error) {
        console.log("Get booked slots error", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
}

const checkAndUpdateBookingStatus = async (booking) => {
    if (booking.status !== "approved") return booking;

    try {
        if (!booking.endTime) {
            // Fallback for old bookings without endTime field
            const parts = booking.timeSlot.split(' - ');
            if (parts.length < 2) return booking;
            const lastPart = parts[1].replace("Custom: ", "");
            const [time, ampm] = lastPart.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
            booking.endTime = hours * 60 + minutes;
            await booking.save();
        }

        const bookingDate = new Date(booking.date);
        const endHour = Math.floor(booking.endTime / 60);
        const endMinute = booking.endTime % 60;
        
        const localBookingEndTime = new Date(Date.UTC(
            bookingDate.getUTCFullYear(),
            bookingDate.getUTCMonth(),
            bookingDate.getUTCDate(),
            endHour,
            endMinute
        ));

        const now = new Date();
        const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));

        if (istNow.getTime() > localBookingEndTime.getTime()) {
            booking.status = "completed";
            await booking.save();
            console.log(`Booking ${booking._id} marked as completed.`);
        }
    } catch (e) {
        console.error("Error checking booking status:", e);
    }
    return booking;
};

const getMyBookings = async (req, res) => {
  try {
    const bookings = await bookingModel
      .find({ faculty: req.user.userId })
      .populate("venue", "name location")
      .sort({ createdAt: -1 });

    // Update statuses on the fly for better UX
    const updatedBookings = await Promise.all(bookings.map(checkAndUpdateBookingStatus));

    return res.status(200).json({
      success: true,
      count: updatedBookings.length,
      bookings: updatedBookings
    });

  } catch (error) {
    console.log("MY BOOKINGS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

module.exports = {
    createBooking,
    getMyBookings,
    getBookedSlots
};