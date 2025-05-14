// Append this to the end of memberController.js
    console.error('Error getting member profile:', error);
    res.status(500).json({ errors: { message: "Failed to get member profile" } });
  }
};

module.exports = {
  getMembers,
  createMember,
  getMemberById,
  updateMember,
  deleteMember,
  getCurrentMemberProfile,
  updateProfilePictures,
  deleteProfilePicture,
  getProfilePicture,
  getMembershipStatus,
  toggleUserStatus,
  getMemberDetailsForReference,
  searchMembers,
};
