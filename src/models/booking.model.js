const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema({
    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    venue: {
         type: mongoose.Schema.Types.ObjectId,
        ref: "venue",
        required: true
    },
    date:{
        type: Date,
        required :true
    },
    timeSlot: {
        type: String,
        required: true
    },
    startTime: {
        type: Number, // Minutes from midnight
        required: true
    },
    endTime: {
        type: Number, // Minutes from midnight
        required: true
    },
    purpose: {
        type: String,
        required: true,
        trim: true
    },
    requirements: {
        type: String,
        default: ""
    },
    batchId: {
        type: String,
        default: null
    },
    status:{
      type: String,
      enum: ["pending", "approved", "rejected", "revoked", "completed"],
      default: "pending"
    },
    reason: {
      type: String,
      default: ""
    },
    priorityReason: {
      type: String,
      default: ""
    },
    cancellationReason: {
      type: String,
      default: ""
    },
    isConflict: {
      type: Boolean,
      default: false
    }

},{timestamps:true});

const bookingModel = mongoose.model("Booking", bookingSchema)

module.exports = bookingModel;