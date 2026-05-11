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

const formatMinutesToTime = (minutes) => {
    let hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")} ${ampm}`;
};

const mergeSlots = (slots) => {
    if (!slots || slots.length === 0) return [];
    if (slots.length === 1) {
        const { start, end } = parseRange(slots[0]);
        return [{ timeSlot: slots[0], startTime: start, endTime: end }];
    }

    const parsed = slots.map(s => ({
        original: s,
        ...parseRange(s)
    })).sort((a, b) => a.start - b.start);

    const merged = [];
    let current = parsed[0];

    for (let i = 1; i < parsed.length; i++) {
        const next = parsed[i];
        if (next.start <= current.end) {
            current.end = Math.max(current.end, next.end);
            const startStr = formatMinutesToTime(current.start);
            const endStr = formatMinutesToTime(current.end);
            current.original = `${startStr} - ${endStr}`;
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);

    return merged.map(m => ({
        timeSlot: m.original,
        startTime: m.start,
        endTime: m.end
    }));
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
        
        // 1. Validate all venues and dates exist and have no conflicts
        const targetDates = Array.isArray(date) ? date : (date ? [date] : []);
        
        if (targetVenues.length === 0 || targetDates.length === 0 || targetTimeSlots.length === 0 || !purpose) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const venueDateConflicts = []; // To track conflicts per venue-date combination
        
        for (const venueId of targetVenues) {
            const existingVenue = await venueModel.findById(venueId);
            if(!existingVenue){
                return res.status(404).json({
                    success:false,
                    message:"One or more venues not found"
                })
            };
            
            for (const d of targetDates) {
                let conflictFound = false;
                for (const tSlot of targetTimeSlots) {
                    const { start, end } = parseRange(tSlot);
                    
                    const conflicts = await bookingModel.find({
                        venue: venueId,
                        date: d,
                        status: { $in: ["approved", "pending"] },
                        $or: [
                            { startTime: { $lt: end }, endTime: { $gt: start } }
                        ]
                    });

                    if (conflicts.length > 0) {
                        const ownBooking = conflicts.find(c => c.faculty.toString() === req.user.userId.toString());
                        if (ownBooking) {
                            return res.status(400).json({
                                success: false,
                                message: `You already have a ${ownBooking.status} booking for ${new Date(d).toDateString()} at this time.`
                            });
                        }
                        
                        if (conflicts.some(c => c.status === "approved")) {
                            conflictFound = true;
                        }
                    }
                }
                venueDateConflicts.push({ venue: existingVenue, date: d, isConflict: conflictFound });
            }
        }

        const createdBookings = [];
        const batchId = crypto.randomBytes(8).toString("hex");
        
        // 2. Create bookings for each venue and each date
        for (const vdc of venueDateConflicts) {
            const venueId = vdc.venue._id;
            const d = vdc.date;
            
            const isAdminOfThisVenue = req.user.role === "admin" && 
                                       vdc.venue.department?.toString() === req.user.department?.toString();
            const isSuperAdmin = req.user.role === "superadmin";
            
            const shouldAutoApproveThis = (isAdminOfThisVenue || isSuperAdmin) && !vdc.isConflict;

            const mergedVenueSlots = mergeSlots(targetTimeSlots);

            for (const mergedSlot of mergedVenueSlots) {
                const booking = await bookingModel.create({
                    faculty: req.user.userId,
                    venue: venueId,
                    date: d,
                    timeSlot: mergedSlot.timeSlot,
                    startTime: mergedSlot.startTime,
                    endTime: mergedSlot.endTime,
                    purpose,
                    requirements: requirements || "",
                    batchId,
                    status: shouldAutoApproveThis ? "approved" : "pending",
                    isConflict: vdc.isConflict,
                    priorityReason: vdc.isConflict ? priorityReason : ""
                });
                createdBookings.push(booking);
            }
        }

        // 3. Notify admins
        const faculty = await userModel.findById(req.user.userId);
        const facultyName = faculty ? faculty.name : "Unknown Faculty";
        const venueNames = [...new Set(venueDateConflicts.map(vdc => vdc.venue.name))];
        const dateStrings = [...new Set(targetDates.map(d => new Date(d).toISOString().split("T")[0]))];
        const requesterDept = faculty ? faculty.department : null;
        const venueDeptIds = [...new Set(venueDateConflicts.map(vdc => vdc.venue.department?.toString()))].filter(Boolean);
        const dateString = dateStrings.join(", ");
        const totalConflict = venueDateConflicts.some(vdc => vdc.isConflict);
        
        let firstConflictFaculty = "Unknown Faculty";
        if (totalConflict) {
            const conflictEntry = venueDateConflicts.find(vdc => vdc.isConflict);
            const c = await bookingModel.findOne({
                venue: conflictEntry.venue._id,
                date: conflictEntry.date,
                status: "approved",
                $or: [
                    { startTime: { $lt: parseRange(targetTimeSlots[0]).end }, endTime: { $gt: parseRange(targetTimeSlots[0]).start } }
                ]
            }).populate("faculty", "name");
            if (c && c.faculty) {
                firstConflictFaculty = c.faculty.name;
            }
        }

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
            const hasAutoApproved = createdBookings.some(b => b.status === "approved" && req.user.role === "admin");
            
            if (totalConflict) {
                // Priority request notification
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
                // Auto-allocation notification
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
        }).select("timeSlot status isConflict");
        
        // Approved slots + priority (conflict) pending slots are fully booked — no one else can select them
        const bookedSlots = bookings
            .filter(b => b.status === "approved" || (b.status === "pending" && b.isConflict))
            .map(b => b.timeSlot);

        // Normal pending slots (not priority) — shown as pending/dashed
        const pendingSlots = bookings
            .filter(b => b.status === "pending" && !b.isConflict)
            .map(b => b.timeSlot);

        return res.status(200).json({ success: true, bookedSlots, pendingSlots });
    } catch (error) {
        console.log("Get booked slots error", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
}

const checkAndUpdateBookingStatus = async (booking) => {
    if (booking.status !== "approved" && booking.status !== "pending") return booking;

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
            if (booking.status === "approved") {
                booking.status = "completed";
                await booking.save();
                console.log(`Booking ${booking._id} marked as completed.`);
            } else if (booking.status === "pending") {
                booking.status = "not approved";
                booking.reason = "Request expired: Not approved/rejected before the scheduled time.";
                await booking.save();
                console.log(`Booking ${booking._id} marked as not approved.`);
            }
        }
    } catch (e) {
        console.error("Error checking booking status:", e);
    }
    return booking;
};

const getWeeklySchedule = async (req, res) => {
    try {
        const now = new Date();
        
        // Start of today in UTC (midnight)
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

        // Find next 30 days
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30, 23, 59, 59));

        const bookings = await bookingModel.find({
            status: 'approved',
            date: { $gte: todayStart, $lte: monthEnd }
        })
        .populate('venue', 'name location')
        .populate('faculty', 'name designation')
        .select('venue faculty date timeSlot purpose')
        .sort({ date: 1 });

        // Normalize date to YYYY-MM-DD IST string for the frontend
        const normalizedBookings = bookings.map(b => {
            const d = new Date(b.date);
            // Convert to IST (UTC+5:30)
            const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
            const isoDate = ist.toISOString().split('T')[0];
            return {
                _id: b._id,
                venue: b.venue,
                faculty: b.faculty,
                date: isoDate,
                timeSlot: b.timeSlot,
                purpose: b.purpose
            };
        });

        // Build start/end as IST strings for the frontend to build tabs
        const istToday = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
        const istMonthEnd = new Date(monthEnd.getTime() + 5.5 * 60 * 60 * 1000);

        return res.status(200).json({
            success: true,
            startDate: istToday.toISOString().split('T')[0],
            endDate: istMonthEnd.toISOString().split('T')[0],
            bookings: normalizedBookings
        });
    } catch (error) {
        console.log('Weekly schedule error:', error);
        return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
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

const getPublicVenues = async (req, res) => {
    try {
        const venues = await venueModel.find().populate("department", "name").select("name capacity location image features type");
        return res.status(200).json({ success: true, venues });
    } catch (error) {
        console.log("PUBLIC VENUES ERROR:", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancelBatch } = req.body;

    const booking = await bookingModel.findById(id).populate("venue").populate("faculty");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Check if user is the owner
    if (booking.faculty._id.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to cancel this booking" });
    }

    // Check if booking is already completed or cancelled
    if (["completed", "cancelled", "rejected", "revoked"].includes(booking.status)) {
      return res.status(400).json({ success: false, message: `Booking cannot be cancelled from its current status: ${booking.status}` });
    }

    const bookingsToCancel = [];
    if (cancelBatch && booking.batchId) {
      const batchBookings = await bookingModel.find({ batchId: booking.batchId, status: { $in: ["pending", "approved"] } }).populate("venue").populate("faculty");
      bookingsToCancel.push(...batchBookings);
    } else {
      bookingsToCancel.push(booking);
    }

    if (bookingsToCancel.length === 0) {
      return res.status(400).json({ success: false, message: "No eligible bookings found to cancel" });
    }

    // Update status for all
    for (const b of bookingsToCancel) {
      b.status = "cancelled";
      await b.save();
    }

    // Prepare notification details
    const faculty = booking.faculty;
    const venueNames = [...new Set(bookingsToCancel.map(b => b.venue.name))].join(", ");
    const dateStrings = [...new Set(bookingsToCancel.map(b => new Date(b.date).toDateString()))].join(", ");
    const timeSlots = [...new Set(bookingsToCancel.map(b => b.timeSlot))].join(", ");

    // Fetch relevant admins (similar to createBooking)
    const venueDeptIds = [...new Set(bookingsToCancel.map(b => b.venue.department?.toString()))].filter(Boolean);
    const requesterDept = faculty.department;

    const adminQuery = {
      $or: [
        { role: "superadmin" },
        { role: "admin", department: { $in: venueDeptIds } },
        requesterDept ? { role: "admin", department: requesterDept } : null
      ].filter(Boolean)
    };

    const admins = await userModel.find(adminQuery).select("email");
    const adminEmails = admins.map(a => a.email);

    // Send emails
    await emailService.sendCancellationEmail(faculty.email, faculty.name, venueNames, dateStrings, timeSlots);
    
    if (adminEmails.length > 0) {
      await emailService.sendCancellationAdminNotification(adminEmails, faculty.name, venueNames, dateStrings, timeSlots);
    }

    return res.status(200).json({
      success: true,
      message: bookingsToCancel.length > 1 ? "Bookings in this batch cancelled successfully" : "Booking cancelled successfully"
    });

  } catch (error) {
    console.log("CANCEL BOOKING ERROR:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports = {
    createBooking,
    getMyBookings,
    getBookedSlots,
    getWeeklySchedule,
    getPublicVenues,
    cancelBooking
};
