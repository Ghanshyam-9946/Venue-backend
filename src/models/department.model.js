const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Department name is required"],
        trim: true,
        unique: true
    },
    description: {
        type: String,
        default: ""
    },
    block: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Block"
    }
}, { timestamps: true });

const departmentModel = mongoose.model("Department", departmentSchema);
module.exports = departmentModel;
