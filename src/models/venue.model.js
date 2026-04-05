const mongoose = require('mongoose')

const venueSchema = new mongoose.Schema({
    name:{
        type: String,
        required: [true, "Venue name is required"],
        trim: true,
        unique: true
    },
    capacity: {
        type: Number,
        required: [true, "Capacity is required"]
    },
    location: {
        type: String,
        required: [true,"Location is required"],
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    type: {
        type: String,
        enum: ["Classroom", "Lab", "Seminar Hall", "Auditorium", "Other"],
        default: "Classroom"
    },
    image: {
        type:String,
        required: [true, "Venue image is required"]
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department"
    }

},{timestamps:true})

const venueModel = mongoose.model("venue", venueSchema)

module.exports = venueModel