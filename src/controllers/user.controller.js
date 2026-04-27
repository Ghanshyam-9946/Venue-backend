const userModel = require("../models/user.model");
const imageKit = require("../services/storage.service");

// Get User Profile
const getProfile = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId).populate("department", "name");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Update User Profile
const updateProfile = async (req, res) => {
  try {
    const { name, mobile, designation } = req.body;
    const userId = req.user.userId;

    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Update text fields
    if (name) user.name = name;
    if (mobile) user.mobile = mobile;
    if (designation !== undefined) user.designation = designation;

    // Handle profile picture update if a file is uploaded
    if (req.file) {
      try {
        const result = await imageKit.upload({
          file: req.file.buffer.toString("base64"),
          fileName: `avatar_${userId}_${Date.now()}`,
          folder: "/avatars"
        });
        user.avatar = result.url;
      } catch (uploadError) {
        console.error("IMAGE UPLOAD ERROR:", uploadError);
        return res.status(500).json({ success: false, message: "Failed to upload profile picture" });
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mobile: user.mobile,
        avatar: user.avatar,
        department: user.department,
        designation: user.designation
      }
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
