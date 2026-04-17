const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    trim: true,
    lowercase: true,
    match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Please fill a valid email address"],
    unique: [true, "Email already exists"]
  },

  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true
  },

  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be atleast 6 characters long"],
    select: false
  },

  role: {
    type: String,
    enum: ["faculty", "admin", "superadmin"],
    default: "faculty"
  },

  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department"
  },

  isFirstLogin: {
    type: Boolean,
    default: true
  },

  mobile: {
    type: String,
    trim: true
  },

  designation: {
    type: String,
    trim: true
  },

  avatar: {
    type: String,
    default: "https://cdn-icons-png.flaticon.com/512/149/149071.png"
  },

  resetPasswordToken: {
    type: String
  },

  resetPasswordExpire: {
    type: Date
  }

}, { timestamps: true });


userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const hash = await bcrypt.hash(this.password, 10);
  this.password = hash;
});


userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};


userSchema.methods.generateResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordToken = hashedToken;

  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);

  return resetToken;
};


const userModel = mongoose.model('User', userSchema);

module.exports = userModel;