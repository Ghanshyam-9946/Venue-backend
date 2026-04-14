const venueModel = require("../models/venue.model");
const imageKit = require("../services/storage.service");
const bookingModel = require("../models/booking.model");
const userModel = require("../models/user.model");
const emailService = require("../services/email.service");
const departmentModel = require("../models/department.model");
// REGISTER FACULTY
const registerFaculty = async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password || !department) {
      return res.status(400).json({ success: false, message: "All fields including department are required" });
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
        isFirstLogin: true
    });

    // Send registration email
    await emailService.sendRegistrationEmail(user.email, user.name);

    return res.status(201).json({
      success: true,
      message: "Faculty created successfully",
      user: { _id: user._id, email: user.email, name: user.name }
    });

  } catch (error) {
    console.log("REGISTER FACULTY ERROR:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// DEPARTMENT CONTROLLERS
const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name required" });
    const dept = await departmentModel.create({ name, description });
    return res.status(201).json({ success: true, department: dept });
  } catch(error) {
    if(error.code === 11000) return res.status(400).json({ success: false, message: "Department already exists" });
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const dept = await departmentModel.findById(id);
    if (!dept) return res.status(404).json({ success: false, message: "Department not found" });

    if (name) dept.name = name;
    if (description !== undefined) dept.description = description;

    await dept.save();
    return res.status(200).json({ success: true, department: dept });
  } catch(error) {
    if(error.code === 11000) return res.status(400).json({ success: false, message: "Department name already exists" });
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getAllDepartments = async (req, res) => {
  try {
    const depts = await departmentModel.find();
    return res.status(200).json({ success: true, departments: depts });
  } catch(error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await departmentModel.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Department deleted" });
  } catch(error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// USER CONTROLLERS
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.find().populate("department");
    return res.status(200).json({ success: true, users });
  } catch(error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, department } = req.body;
    const user = await userModel.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (role) user.role = role;
    if (department !== undefined) {
       user.department = department === null ? undefined : department;
    }
    await user.save();
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    return res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// VENUE CONTROLLERS
const createVenue = async (req, res) => {
  try {
    const { name, capacity, location, description, type } = req.body;
    let departmentId = req.body.department;
    
    const currentUser = await userModel.findById(req.user.userId);
    if (currentUser.role === 'admin') {
       departmentId = currentUser.department;
    }
    
    if (!departmentId) return res.status(400).json({ success: false, message: "Department is required. Select a department first." });
    if (!req.file) return res.status(400).json({ success: false, message: "Image is required" });

    const result = await imageKit.upload({ file: req.file.buffer.toString("base64"), fileName: req.file.originalname });

    const venue = await venueModel.create({
      name, capacity, location, description, type: type || 'Classroom', image: result.url, department: departmentId
    });

    return res.status(201).json({ success: true, message: "Venue created successfully", venue });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, capacity, location, description, type } = req.body;
    
    const venue = await venueModel.findById(id);
    if (!venue) return res.status(404).json({ success: false, message: "Venue not found" });

    const currentUser = await userModel.findById(req.user.userId);
    if (currentUser.role === 'admin' && venue.department?.toString() !== currentUser.department?.toString()) {
       return res.status(403).json({ success: false, message: "You can only edit venues in your department" });
    }

    if (name) venue.name = name;
    if (capacity) venue.capacity = capacity;
    if (location) venue.location = location;
    if (description) venue.description = description;
    if (type) venue.type = type;

    if (req.file) {
      const result = await imageKit.upload({ file: req.file.buffer.toString("base64"), fileName: req.file.originalname });
      venue.image = result.url;
    }

    if (currentUser.role === 'superadmin' && req.body.department) {
       venue.department = req.body.department;
    }

    await venue.save();
    return res.status(200).json({ success: true, message: "Venue updated", venue });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const deleteVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await venueModel.findById(id);
    if (!venue) return res.status(404).json({ success: false, message: "Venue not found" });

    const currentUser = await userModel.findById(req.user.userId);
    if (currentUser.role === 'admin' && venue.department?.toString() !== currentUser.department?.toString()) {
       return res.status(403).json({ success: false, message: "You can only delete venues in your department" });
    }

    await venueModel.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Venue deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getAllVenues = async (req, res) => {
  try {
    const { deptId, manage } = req.query;
    let query = {};
    if (deptId) {
       query.department = deptId;
    }
    
    if (manage === 'true' && req.user) {
        const currentUser = await userModel.findById(req.user.userId);
        if (currentUser && currentUser.role === 'admin') {
            query.department = currentUser.department;
        }
    }

    const venues = await venueModel.find(query).populate("department", "name");
    return res.status(200).json({ success: true, venues });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getSingleVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await venueModel.findById(id).populate("department", "name");
    if (!venue) return res.status(404).json({ success: false, message: "Venue not found" });
    return res.status(200).json({ success: true, venue });
  } catch(error) {
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

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
        }
    } catch (e) {
        console.error("Error checking booking status:", e);
    }
    return booking;
};

const getAllRequests = async (req, res) => {
  try {
    const currentUser = await userModel.findById(req.user.userId);
    let requests = await bookingModel
      .find()
      .populate("faculty", "name email")
      .populate({
        path: "venue",
        select: "name location department",
        populate: { path: "department", select: "name" }
      });

    if (currentUser.role === 'admin') {
      requests = requests.filter(r => r.venue && r.venue.department && r.venue.department._id.toString() === currentUser.department?.toString());
    }

    // Dynamic status check
    const updatedRequests = await Promise.all(requests.map(checkAndUpdateBookingStatus));

    return res.status(200).json({
      success: true,
      count: updatedRequests.length,
      requests: updatedRequests
    });

  } catch (error) {
    console.log("GET REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status, reason } = req.body;

    const request = await bookingModel.findById(id).populate("faculty", "name email").populate("venue", "name department");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    const currentUser = await userModel.findById(req.user.userId);
    if (currentUser.role === 'admin') {
      if (request.venue.department?.toString() !== currentUser.department?.toString()) {
         return res.status(403).json({ success: false, message: "Unauthorized: You can only manage venues in your department" });
      }
    }

    if (status === "approved") {
      const conflict = await bookingModel.findOne({
        venue: request.venue._id,
        date: request.date,
        timeSlot: request.timeSlot,
        status: "approved"
      });

      if (conflict) {
        return res.status(400).json({
          success: false,
          message: "Venue already booked for this time"
        });
      }
    }

    request.status = status;
    
    if (status === "revoked" || status === "rejected") {
      const prefix = currentUser.role === "superadmin" 
        ? `Your booking ${status} by head` 
        : `Your booking ${status} by HOD of department`;
      reason = reason ? `${prefix}. Reason: ${reason}` : prefix;
    } else if (status === "approved") {
      reason = currentUser.role === "superadmin" 
        ? "Approved by head" 
        : "Approved by HOD of department";
    }

    if (reason) {
      request.reason = reason;
    }
    await request.save();

    // Send email notification to faculty
    if (request.faculty) {
      const venueName = request.venue ? request.venue.name : "Unknown Venue";
      let dateString = request.date;
      if (typeof request.date.toISOString === "function") {
          dateString = request.date.toISOString().split("T")[0];
      }
      await emailService.sendStatusUpdateEmail(
        request.faculty.email, 
        request.faculty.name, 
        status, 
        reason, 
        venueName, 
        dateString,
        request.timeSlot
      );
    }

    return res.status(200).json({
      success: true,
      message: `Request ${status}`
    });

  } catch (error) {
    console.log("UPDATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

const getDepartmentHistory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate are required" });
    }

    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const currentUser = await userModel.findById(req.user.userId);

    const bookings = await bookingModel.find({
      status: { $in: ["approved", "completed"] },
      date: { $gte: start, $lte: end }
    })
    .populate({ path: "faculty", populate: { path: "department" } })
    .populate({ path: "venue", populate: { path: "department" } });

    if (currentUser.role === 'superadmin') {
      const history = {};
      bookings.forEach(b => {
        if (!b.faculty || !b.venue || !b.faculty.department || !b.venue.department) return;
        const facultyDeptId = b.faculty.department._id.toString();
        const venueDeptId = b.venue.department._id.toString();
        
        const key = `${facultyDeptId}_${venueDeptId}`;
        if (!history[key]) {
           history[key] = {
             facultyDept: b.faculty.department.name,
             venueDept: b.venue.department.name,
             count: 0
           };
        }
        history[key].count += 1;
      });
      return res.status(200).json({ success: true, history: Object.values(history) });
    } else if (currentUser.role === 'admin') {
      const history = {};
      const adminDeptId = currentUser.department?.toString();
      
      bookings.forEach(b => {
        if (!b.faculty || !b.venue || !b.faculty.department || !b.venue.department) return;
        
        const venueDeptId = b.venue.department._id.toString();
        if (venueDeptId !== adminDeptId) return; // Only my department venues
        
        const facultyDeptId = b.faculty.department._id.toString();
        
        const key = facultyDeptId;
        if (!history[key]) {
          history[key] = {
            bookingDept: b.faculty.department.name,
            count: 0
          };
        }
        history[key].count += 1;
      });
      return res.status(200).json({ success: true, history: Object.values(history) });
    }
    
    return res.status(403).json({ success: false });
  } catch(error) {
     console.log("HISTORY ERROR", error);
     return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const updateBatchStatus = async (req, res) => {
  try {
    const { batchId } = req.params;
    let { status, reason } = req.body;
    
    const currentUser = await userModel.findById(req.user.userId);
    
    let queryStatus = "pending";
    if (status === "revoked") queryStatus = "approved";
    
    const requests = await bookingModel.find({ batchId, status: queryStatus }).populate("faculty", "name email").populate("venue", "name department");
    
    if (requests.length === 0) return res.status(404).json({ success: false, message: "Batch requests not found" });

    let updatedCount = 0;
    
    for (const request of requests) {
      if (currentUser.role === 'admin') {
        if (request.venue.department?.toString() !== currentUser.department?.toString()) continue; // Skip unauthorized
      }
      
      if (status === "approved") {
        const conflict = await bookingModel.findOne({
          venue: request.venue._id,
          date: request.date,
          timeSlot: request.timeSlot,
          status: "approved"
        });
        if (conflict) continue; // Skip conflict
      }
      
      request.status = status;
      
      let finalReason = reason;
      if (status === "revoked" || status === "rejected") {
        const prefix = currentUser.role === "superadmin"
          ? `Your booking ${status} by head`
          : `Your booking ${status} by HOD of department`;
        finalReason = reason ? `${prefix}. Reason: ${reason}` : prefix;
      } else if (status === "approved") {
        finalReason = currentUser.role === "superadmin" 
          ? "Approved by head" 
          : "Approved by HOD of department";
      }

      if (finalReason) {
        request.reason = finalReason;
      }
      await request.save();
      updatedCount++;

      if (request.faculty) {
        const venueName = request.venue ? request.venue.name : "Unknown Venue";
        let dateString = request.date;
        if (typeof request.date.toISOString === "function") {
            dateString = request.date.toISOString().split("T")[0];
        }
        await emailService.sendStatusUpdateEmail(
          request.faculty.email, 
          request.faculty.name, 
          status, 
          finalReason || reason, 
          venueName, 
          dateString,
          request.timeSlot
        );
      }
    }
    
    return res.status(200).json({ success: true, message: `Batch ${status} processed. Updated ${updatedCount} items.`});
  } catch (error) {
     console.log("BATCH UPDATE ERROR", error);
     return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

const getAllHistoryStatement = async (req, res) => {
  try {
    const { departmentId, startDate, endDate } = req.query;
    const currentUser = await userModel.findById(req.user.userId);
    
    let query = {};
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    } else if (startDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      query.date = { $gte: start };
    } else if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      query.date = { $lte: end };
    }
    
    let bookings = await bookingModel.find(query)
      .populate({
        path: "faculty",
        select: "name email department",
        populate: { path: "department", select: "name" }
      })
      .populate({
        path: "venue",
        select: "name location department",
        populate: { path: "department", select: "name" }
      })
      .sort({ createdAt: -1 });

    if (currentUser.role === 'admin') {
      if (!currentUser.department) {
        return res.status(403).json({ success: false, message: "Department not assigned" });
      }
      bookings = bookings.filter(b => b.venue && b.venue.department && b.venue.department._id.toString() === currentUser.department.toString());
    } else if (currentUser.role === 'superadmin' && departmentId) {
      bookings = bookings.filter(b => b.venue && b.venue.department && b.venue.department._id.toString() === departmentId);
    }

    // Dynamic status check
    const updatedBookings = await Promise.all(bookings.map(checkAndUpdateBookingStatus));
    
    return res.status(200).json({
      success: true,
      count: updatedBookings.length,
      history: updatedBookings
    });
    
  } catch (error) {
    console.log("HISTORY STATEMENT ERROR", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports = { 
  registerFaculty,
  createDepartment,
  updateDepartment,
  getAllDepartments,
  deleteDepartment,
  getAllUsers,
  updateUserRole,
  deleteUser,
  createVenue,
  updateVenue,
  deleteVenue,
  getAllVenues,
  getSingleVenue,
  getAllRequests,
  updateRequestStatus,
  getDepartmentHistory,
  updateBatchStatus,
  getAllHistoryStatement
};