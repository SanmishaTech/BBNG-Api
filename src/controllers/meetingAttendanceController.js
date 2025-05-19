const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const createError = require("http-errors");

/**
 * Wrap async route handlers and funnel errors through Express error middleware.
 * Converts Prisma validation errors and known request errors into structured 400 responses.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    // Zod or manual user errors forwarded by validateRequest
    if (err.status === 400 && err.expose) {
      return res
        .status(400)
        .json({ errors: err.errors || { message: err.message } });
    }
    // Prisma validation errors
    if (err.name === "PrismaClientValidationError") {
      return res.status(400).json({ errors: { message: err.message } });
    }
    // Prisma known request errors (e.g., unique constraint)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002" && err.meta?.target) {
        const field = Array.isArray(err.meta.target)
          ? err.meta.target[0]
          : err.meta.target;
        const message = `A record with that ${field} already exists.`;
        return res
          .status(400)
          .json({ errors: { [field]: { type: "unique", message } } });
      }
    }
    // Fallback for unexpected errors
    console.error(err);
    return res
      .status(500)
      .json({ errors: { message: "Internal Server Error" } });
  });
};

/** GET /api/meeting-attendance
 * List attendance records for a meeting
 */
const getMeetingAttendance = asyncHandler(async (req, res) => {
  const { meetingId } = req.query;
  console.log("[getMeetingAttendance] Request query:", req.query);
  
  if (!meetingId) {
    throw createError(400, "Meeting ID is required");
  }

  const meetingIdInt = parseInt(meetingId);
  console.log(`[getMeetingAttendance] Looking up meeting ID: ${meetingIdInt}`);
  
  // Get the meeting with chapter details
  const meeting = await prisma.chapterMeeting.findUnique({
    where: { id: meetingIdInt },
    include: { chapter: true },
  });
  
  if (!meeting) {
    throw createError(404, "Meeting not found");
  }

  // Get all active members from the meeting's chapter
  const chapterMembers = await prisma.member.findMany({
    where: { 
      chapterId: meeting.chapterId,
      active: true 
    },
  });
  console.log(`[getMeetingAttendance] Found ${chapterMembers.length} active members in chapter ${meeting.chapterId}`);

  // Get existing attendance records for this meeting
  const attendanceRecords = await prisma.meetingAttendance.findMany({
    where: { meetingId: meetingIdInt },
    include: { member: true },
  });
  console.log(`[getMeetingAttendance] Found ${attendanceRecords.length} existing attendance records`);
  console.log("[getMeetingAttendance] Attendance records:", attendanceRecords.map(r => ({
    memberId: r.memberId,
    isPresent: r.isPresent
  })));

  // Create a lookup map of existing records
  const attendanceMap = {};
  attendanceRecords.forEach(record => {
    attendanceMap[record.memberId] = record;
    console.log(`[getMeetingAttendance] Mapping member ${record.memberId} with present status: ${record.isPresent}`);
  });

  // Combine data to return full chapter member list with attendance status
  const memberAttendance = chapterMembers.map(member => {
    const attendanceRecord = attendanceMap[member.id];
    const isPresent = attendanceRecord?.isPresent || false;
    const isSubstitute = attendanceRecord?.isSubstitute || false;
    console.log(`[getMeetingAttendance] Member ${member.id} (${member.memberName}) attendance: ${isPresent}, substitute: ${isSubstitute}`);
    return {
      member,
      attendance: attendanceRecord || null,
      isPresent: isPresent,
      isSubstitute: isSubstitute
    };
  });

  res.json({
    meeting,
    memberAttendance,
    totalMembers: chapterMembers.length,
    presentCount: attendanceRecords.filter(r => r.isPresent).length
  });
});

/** POST /api/meeting-attendance/bulk
 * Create or update attendance records for multiple members at once
 */
const updateBulkAttendance = asyncHandler(async (req, res) => {
  console.log("[updateBulkAttendance] Request body:", req.body);
  const schema = z.object({
    meetingId: z.number().int("Meeting ID must be an integer"),
    attendance: z.array(
      z.object({
        memberId: z.number().int("Member ID must be an integer"),
        isPresent: z.boolean(),
        isSubstitute: z.boolean().optional().default(false)
      })
    ),
  }).superRefine(async (data, ctx) => {
    // Check if meeting exists
    const meeting = await prisma.chapterMeeting.findUnique({
      where: { id: data.meetingId },
    });
    if (!meeting) {
      ctx.addIssue({
        path: ["meetingId"],
        message: `Meeting with ID ${data.meetingId} does not exist`,
        code: z.ZodIssueCode.custom,
      });
    }

    // Check if all members exist
    const memberIds = data.attendance.map(a => a.memberId);
    const members = await prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true },
    });
    
    const foundMemberIds = members.map(m => m.id);
    const missingMemberIds = memberIds.filter(id => !foundMemberIds.includes(id));
    
    if (missingMemberIds.length > 0) {
      ctx.addIssue({
        path: ["attendance"],
        message: `Members with IDs ${missingMemberIds.join(', ')} do not exist`,
        code: z.ZodIssueCode.custom,
      });
    }
  });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  const { meetingId, attendance } = req.body;
  console.log(`[updateBulkAttendance] Processing ${attendance.length} attendance records for meeting ${meetingId}`);

  // Process each attendance record using upsert for atomic operations
  const results = await Promise.all(
    attendance.map(async ({ memberId, isPresent, isSubstitute = false }) => {
      console.log(`[updateBulkAttendance] Upserting attendance for member ${memberId}: isPresent=${isPresent}, isSubstitute=${isSubstitute}`);
      
      // Check if record exists before upsert
      const existingRecord = await prisma.meetingAttendance.findUnique({
        where: {
          meetingId_memberId: {
            meetingId,
            memberId,
          }
        }
      });
      
      console.log(`[updateBulkAttendance] Existing record for member ${memberId}: ${existingRecord ? `isPresent=${existingRecord.isPresent}, isSubstitute=${existingRecord.isSubstitute}` : 'not found'}`);
      
      const result = await prisma.meetingAttendance.upsert({
        where: {
          meetingId_memberId: {
            meetingId,
            memberId,
          },
        },
        update: { isPresent, isSubstitute },
        create: { meetingId, memberId, isPresent, isSubstitute },
      });
      
      console.log(`[updateBulkAttendance] Result for member ${memberId}: isPresent=${result.isPresent}, isSubstitute=${result.isSubstitute}`);
      return result;
    })
  );

  console.log(`[updateBulkAttendance] Completed updating ${results.length} attendance records`);
  
  // Double-check that records were saved correctly
  const verifyRecords = await prisma.meetingAttendance.findMany({
    where: { meetingId },
  });
  
  console.log("[updateBulkAttendance] Verification of saved records:", verifyRecords.map(r => ({
    memberId: r.memberId,
    isPresent: r.isPresent
  })));
  
  res.status(200).json({
    message: "Attendance updated successfully",
    records: results,
  });
});

/** GET /api/meeting-attendance/member/:memberId
 * Get attendance history for a specific member
 */
const getMemberAttendance = asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.memberId);
  if (!memberId) throw createError(400, "Invalid member ID");

  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });
  
  if (!member) throw createError(404, "Member not found");

  const attendance = await prisma.meetingAttendance.findMany({
    where: { memberId },
    include: { meeting: true },
    orderBy: { meeting: { date: 'desc' } },
  });

  res.json({
    member,
    attendance,
    totalMeetings: attendance.length,
    attendedMeetings: attendance.filter(a => a.isPresent).length,
  });
});

/** GET /api/meeting-attendance/:meetingId/:memberId
 * Get specific attendance record
 */
const getAttendanceRecord = asyncHandler(async (req, res) => {
  const meetingId = parseInt(req.params.meetingId);
  const memberId = parseInt(req.params.memberId);
  
  if (!meetingId || !memberId) {
    throw createError(400, "Invalid meeting ID or member ID");
  }

  const record = await prisma.meetingAttendance.findUnique({
    where: {
      meetingId_memberId: {
        meetingId,
        memberId,
      },
    },
    include: {
      meeting: true,
      member: true,
    },
  });

  if (!record) {
    throw createError(404, "Attendance record not found");
  }

  res.json(record);
});

/** PUT /api/meeting-attendance/:meetingId/:memberId
 * Update a specific attendance record
 */
const updateAttendanceRecord = asyncHandler(async (req, res) => {
  const meetingId = parseInt(req.params.meetingId);
  const memberId = parseInt(req.params.memberId);
  
  if (!meetingId || !memberId) {
    throw createError(400, "Invalid meeting ID or member ID");
  }

  const schema = z.object({
    isPresent: z.boolean(),
  });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Check if the record exists first
  const existingRecord = await prisma.meetingAttendance.findUnique({
    where: {
      meetingId_memberId: {
        meetingId,
        memberId,
      },
    },
  });

  let record;
  
  if (existingRecord) {
    // Update existing record
    record = await prisma.meetingAttendance.update({
      where: {
        meetingId_memberId: {
          meetingId,
          memberId,
        },
      },
      data: { isPresent: req.body.isPresent },
      include: {
        meeting: true,
        member: true,
      },
    });
  } else {
    // Create new record if it doesn't exist
    record = await prisma.meetingAttendance.create({
      data: {
        meetingId,
        memberId,
        isPresent: req.body.isPresent,
      },
      include: {
        meeting: true,
        member: true,
      },
    });
  }

  res.json(record);
});

module.exports = {
  getMeetingAttendance,
  updateBulkAttendance,
  getMemberAttendance,
  getAttendanceRecord,
  updateAttendanceRecord,
};