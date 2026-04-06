const bookingModel = require("../models/booking.model")
const venueModel = require("../models/venue.model")
const userModel = require("../models/user.model")
const emailService = require("../services/email.service")
const crypto = require("crypto");

const createBooking = async(req,res)=>{
    try{
        const { venue, venues, date, timeSlot, timeSlots, purpose, requirements } = req.body;

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
            
            for (const tSlot of targetTimeSlots) {
                const conflict = await bookingModel.findOne({
                    venue: venueId,
                    date: date,
                    timeSlot: tSlot,
                    status: "approved"
                });

                if (conflict) {
                    return res.status(400).json({
                        success: false,
                        message: `Venue ${existingVenue.name} is already booked for the time slot ${tSlot}.`
                    });
                }
            }
            existingVenues.push(existingVenue);
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
        const venueNames = existingVenues.map(v => v.name);

        // 2. Create bookings
        for (let i = 0; i < targetVenues.length; i++) {
            const venueId = targetVenues[i];
            for (const tSlot of targetTimeSlots) {
                const booking = await bookingModel.create({
                    faculty: req.user.userId,
                    venue: venueId,
                    date,
                    timeSlot: tSlot,
                    purpose,
                    requirements: requirements || "",
                    batchId
                });
                createdBookings.push(booking);
            }
        }

        // 3. Notify admins (One email per batch)
        const adminQuery = {
            $or: [
                { role: "superadmin" },
                { role: "admin", department: { $in: existingVenues.map(v => v.department) } }
            ]
        };
        
        const admins = await userModel.find(adminQuery).select("email");
        
        if (admins.length > 0) {
            const adminEmails = admins.map(admin => admin.email);
            await emailService.sendNewBookingAdminNotification(
                adminEmails,
                facultyName,
                venueNames,
                dateString,
                targetTimeSlots.join(", ")
            );
        }

        return res.status(201).json({
            success:true,
            message: (targetVenues.length > 1 || targetTimeSlots.length > 1) ? "Multi-booking request created" : "Booking request created",
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

        const bookedDates = await bookingModel.find({
            venue: id,
            date: date,
            status: "approved"
        }).select("timeSlot");

        const slots = bookedDates.map(b => b.timeSlot);

        return res.status(200).json({ success: true, bookedSlots: slots });
    } catch (error) {
        console.log("Get booked slots error", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
}

const checkAndUpdateBookingStatus = async (booking) => {
    if (booking.status !== "approved") return booking;

    try {
        const parts = booking.timeSlot.split(' - ');
        if (parts.length < 2) return booking;
        
        let endTimeStr = parts[1];
        if (booking.timeSlot.startsWith('Custom: ')) {
            // "Custom: 09:00 AM - 11:00 AM" -> parts[1] is "11:00 AM"
            endTimeStr = parts[1];
        }

        const [time, ampm] = endTimeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const bookingDate = new Date(booking.date);
        bookingDate.setHours(hours, minutes, 0, 0);

        if (Date.now() > bookingDate.getTime()) {
            booking.status = "completed";
            await booking.save();
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