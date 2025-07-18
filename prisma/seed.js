const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

// Format today's date for consistent date generation
const today = new Date();
const oneYearFromNow = new Date(today);
oneYearFromNow.setFullYear(today.getFullYear() + 1);

// Helper function to generate a date within the past 30 days
function recentDate() {
  const date = new Date(today);
  date.setDate(date.getDate() - Math.floor(Math.random() * 30));
  return date;
}

// Helper function to generate a date within the next 30 days
function futureDate() {
  const date = new Date(today);
  date.setDate(date.getDate() + Math.floor(Math.random() * 30));
  return date;
}

// Helper function to generate a future expiry date (between 1 and 12 months)
function expiryDate(months = 6) {
  const date = new Date(today);
  date.setMonth(date.getMonth() + months);
  return date;
}

async function main() {
  console.log("Starting seeding...");

  // Clean up existing data
  await prisma.$transaction([
    prisma.meetingAttendance.deleteMany(),
    prisma.visitor.deleteMany(),
    prisma.chapterMeeting.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.package.deleteMany(),
    prisma.member.deleteMany(),
    prisma.user.deleteMany(),
    // Add deletions for tables that depend on Chapter
    prisma.oneToOne.deleteMany(),
    prisma.chapterRoleHistory.deleteMany(), // Depends on ChapterRole
    prisma.thankYouSlip.deleteMany(), // Depends on Reference, Chapter, Member
    prisma.reference.deleteMany(), // Depends on Chapter, Member
    prisma.chapterRole.deleteMany(), // Depends on Chapter, Member
    prisma.message.deleteMany(), // Moved from below, depends on Chapter
    // --- Deletions for entities that Chapter depends on, or general cleanup ---
    prisma.training.deleteMany(), // Moved before Chapter as a precaution
    prisma.chapter.deleteMany(),
    prisma.location.deleteMany(),
    prisma.zone.deleteMany(),
    prisma.category.deleteMany(),
    prisma.siteSetting.deleteMany(),
  ]);

  // Create Zones
  console.log("Creating zones...");
  const zones = await Promise.all([
    prisma.zone.create({
      data: {
        name: "North Zone",
        active: true,
      },
    }),
    prisma.zone.create({
      data: {
        name: "South Zone",
        active: true,
      },
    }),
    prisma.zone.create({
      data: {
        name: "East Zone",
        active: true,
      },
    }),
    prisma.zone.create({
      data: {
        name: "West Zone",
        active: true,
      },
    }),
  ]);

  // Create Locations
  console.log("Creating locations...");
  const locations = await Promise.all([
    prisma.location.create({
      data: {
        zoneId: zones[0].id,
        location: "Delhi",
      },
    }),
    prisma.location.create({
      data: {
        zoneId: zones[0].id,
        location: "Noida",
      },
    }),
    prisma.location.create({
      data: {
        zoneId: zones[1].id,
        location: "Bangalore",
      },
    }),
    prisma.location.create({
      data: {
        zoneId: zones[1].id,
        location: "Chennai",
      },
    }),
    prisma.location.create({
      data: {
        zoneId: zones[2].id,
        location: "Kolkata",
      },
    }),
    prisma.location.create({
      data: {
        zoneId: zones[3].id,
        location: "Mumbai",
      },
    }),
    prisma.location.create({
      data: {
        zoneId: zones[3].id,
        location: "Pune",
      },
    }),
  ]);

  // Create Categories
  console.log("Creating categories...");
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: "Software Development",
        description: "Software development services and solutions",
      },
    }),
    prisma.category.create({
      data: {
        name: "Digital Marketing",
        description: "Marketing services including SEO, SEM, and social media",
      },
    }),
    prisma.category.create({
      data: {
        name: "Financial Services",
        description: "Financial planning, investment, and accounting services",
      },
    }),
    prisma.category.create({
      data: {
        name: "Real Estate",
        description: "Property sales, rentals, and management",
      },
    }),
    prisma.category.create({
      data: {
        name: "Education",
        description: "Educational services and training",
      },
    }),
  ]);

  // Create Site Settings
  console.log("Creating site settings...");
  await Promise.all([
    prisma.siteSetting.create({
      data: {
        key: "site_name",
        value: "BBNG Network",
      },
    }),
    prisma.siteSetting.create({
      data: {
        key: "contact_email",
        value: "info@bbng.com",
      },
    }),
    prisma.siteSetting.create({
      data: {
        key: "contact_phone",
        value: "+91 9876543210",
      },
    }),
    prisma.siteSetting.create({
      data: {
        key: "site_description",
        value: "Business networking platform for professionals",
      },
    }),
  ]);

  // Create Trainings
  console.log("Creating trainings...");
  await Promise.all([
    prisma.training.create({
      data: {
        date: futureDate(),
        time: "10:00 AM",
        title: "Effective Networking Strategies",
        venue: "Online",
      },
    }),
    prisma.training.create({
      data: {
        date: futureDate(),
        time: "02:00 PM",
        title: "Building Business Relationships",
        venue: "Conference Hall A",
      },
    }),
    prisma.training.create({
      data: {
        date: futureDate(),
        time: "11:00 AM",
        title: "Digital Marketing for Professionals",
        venue: "Online",
      },
    }),
  ]);

  // Create Messages
  console.log("Creating messages...");
  await Promise.all([
    prisma.message.create({
      data: {
        heading: "Welcome to BBNG Network",
        powerteam: "All",
        message:
          "We are excited to have you as a part of our growing business network!",
      },
    }),
    prisma.message.create({
      data: {
        heading: "Upcoming Annual Conference",
        powerteam: "All",
        message:
          "Save the date for our annual conference on business networking and growth strategies.",
      },
    }),
    prisma.message.create({
      data: {
        heading: "Technology Group Meetup",
        powerteam: "Technology",
        message:
          "Join us for the monthly technology group meetup to discuss latest trends and innovations.",
      },
    }),
  ]);

  // Create Chapters
  console.log("Creating chapters...");
  const chapters = await Promise.all([
    prisma.chapter.create({
      data: {
        name: "Delhi Chapter",
        zoneId: zones[0].id,
        locationId: locations[0].id,
        date: new Date("2023-01-01"),
        meetingday: "Tuesday",
        status: true,
        venue: "Hotel Taj, Delhi",
        bankopeningbalance: 10000,
        bankclosingbalance: 15000,
        cashopeningbalance: 5000,
        cashclosingbalance: 6000,
      },
    }),
    prisma.chapter.create({
      data: {
        name: "Bangalore Chapter",
        zoneId: zones[1].id,
        locationId: locations[2].id,
        date: new Date("2023-01-15"),
        meetingday: "Wednesday",
        status: true,
        venue: "Tech Hub, Bangalore",
        bankopeningbalance: 12000,
        bankclosingbalance: 16000,
        cashopeningbalance: 5500,
        cashclosingbalance: 7000,
      },
    }),
    prisma.chapter.create({
      data: {
        name: "Kolkata Chapter",
        zoneId: zones[2].id,
        locationId: locations[4].id,
        date: new Date("2023-01-20"),
        meetingday: "Thursday",
        status: true,
        venue: "Community Hall, Kolkata",
        bankopeningbalance: 9000,
        bankclosingbalance: 11000,
        cashopeningbalance: 4000,
        cashclosingbalance: 5000,
      },
    }),
    prisma.chapter.create({
      data: {
        name: "Mumbai Chapter",
        zoneId: zones[3].id,
        locationId: locations[5].id,
        date: new Date("2023-02-01"),
        meetingday: "Friday",
        status: true,
        venue: "Business Center, Mumbai",
        bankopeningbalance: 15000,
        bankclosingbalance: 18000,
        cashopeningbalance: 6000,
        cashclosingbalance: 8000,
      },
    }),
  ]);

  // Create Admin User
  console.log("Creating admin user...");
  const adminPassword = await bcrypt.hash("admin123", SALT_ROUNDS);
  const adminUser = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@bbng.com",
      password: adminPassword,
      role: "admin",
      active: true,
      lastLogin: new Date(),
    },
  });

  // Create Packages
  console.log("Creating packages...");
  // Add debugging logs to track array creation
  console.log("Before creating packages...");
  const packages = await Promise.all([
    // Delhi Chapter packages
    prisma.package.create({
      data: {
        packageName: "Monthly Membership",
        periodMonths: 1,
        isVenueFee: false,
        chapterId: chapters[0].id,
        basicFees: 2000,
        gstRate: 18,
        gstAmount: 360,
        totalFees: 2360,
      },
    }),
    prisma.package.create({
      data: {
        packageName: "Yearly Membership",
        periodMonths: 12,
        isVenueFee: false,
        chapterId: chapters[0].id,
        basicFees: 20000,
        gstRate: 18,
        gstAmount: 3600,
        totalFees: 23600,
      },
    }),
    prisma.package.create({
      data: {
        packageName: "Monthly Venue",
        periodMonths: 1,
        isVenueFee: true,
        chapterId: chapters[0].id,
        basicFees: 500,
        gstRate: 18,
        gstAmount: 90,
        totalFees: 590,
      },
    }),
    // Bangalore Chapter packages
    prisma.package.create({
      data: {
        packageName: "Monthly Membership",
        periodMonths: 1,
        isVenueFee: false,
        chapterId: chapters[1].id,
        basicFees: 2500,
        gstRate: 18,
        gstAmount: 450,
        totalFees: 2950,
      },
    }),
    prisma.package.create({
      data: {
        packageName: "Yearly Membership",
        periodMonths: 12,
        isVenueFee: false,
        chapterId: chapters[1].id,
        basicFees: 25000,
        gstRate: 18,
        gstAmount: 4500,
        totalFees: 29500,
      },
    }),
    prisma.package.create({
      data: {
        packageName: "Monthly Venue",
        periodMonths: 1,
        isVenueFee: true,
        chapterId: chapters[1].id,
        basicFees: 600,
        gstRate: 18,
        gstAmount: 108,
        totalFees: 708,
      },
    }),
    // Kolkata Chapter packages
    prisma.package.create({
      data: {
        packageName: "Monthly Membership",
        periodMonths: 1,
        isVenueFee: false,
        chapterId: chapters[2].id,
        basicFees: 2200,
        gstRate: 18,
        gstAmount: 396,
        totalFees: 2596,
      },
    }),
    prisma.package.create({
      data: {
        packageName: "Yearly Membership",
        periodMonths: 12,
        isVenueFee: false,
        chapterId: chapters[2].id,
        basicFees: 22000,
        gstRate: 18,
        gstAmount: 3960,
        totalFees: 25960,
      },
    }),
    prisma.package.create({
      data: {
        packageName: "Monthly Venue",
        periodMonths: 1,
        isVenueFee: true,
        chapterId: chapters[2].id,
        basicFees: 550,
        gstRate: 18,
        gstAmount: 99,
        totalFees: 649,
      },
    }),
    // Mumbai Chapter packages
    prisma.package.create({
      data: {
        packageName: "Monthly Membership",
        periodMonths: 1,
        isVenueFee: false,
        chapterId: chapters[3].id,
        basicFees: 3000,
        gstRate: 18,
        gstAmount: 540,
        totalFees: 3540,
      },
    }),
    prisma.package.create({
      data: {
        packageName: "Yearly Membership",
        periodMonths: 12,
        isVenueFee: false,
        chapterId: chapters[3].id,
        basicFees: 30000,
        gstRate: 18,
        gstAmount: 5400,
        totalFees: 35400,
      },
    }),
    prisma.package.create({
      data: {
        packageName: "Monthly Venue",
        periodMonths: 1,
        isVenueFee: true,
        chapterId: chapters[3].id,
        basicFees: 800,
        gstRate: 18,
        gstAmount: 144,
        totalFees: 944,
      },
    }),
  ]);

  // Log array lengths to help debug index errors
  console.log(`Created ${packages.length} packages`);

  // Create Members and Users
  console.log("Creating members and users...");
  const memberPassword = await bcrypt.hash("password123", SALT_ROUNDS);

  // Helper function to create a member with associated user
  async function createMemberWithUser(data, chapter) {
    const member = await prisma.member.create({
      data: {
        ...data,
        chapterId: chapter.id,
      },
    });

    // Calculate active status based on membership expiry dates
    const now = new Date();
    const isHoActive = data.hoExpiryDate
      ? new Date(data.hoExpiryDate) > now
      : false;
    const isVenueActive = data.venueExpiryDate
      ? new Date(data.venueExpiryDate) > now
      : false;
    const isActive = isHoActive || isVenueActive;

    const user = await prisma.user.create({
      data: {
        name: data.memberName,
        email: data.email,
        password: memberPassword,
        role: "user",
        active: isActive,
        lastLogin: new Date(),
        memberId: member.id,
      },
    });

    // Update the member record with the user ID to establish bidirectional relationship
    await prisma.member.update({
      where: { id: member.id },
      data: { userId: user.id },
    });

    return { member, user };
  }

  // Delhi Chapter Members
  const delhiMembers = await Promise.all([
    createMemberWithUser(
      {
        memberName: "Rahul Sharma",
        category: "Digital Marketing",
        businessCategory: "SEO Services",
        gender: "Male",
        dateOfBirth: new Date("1985-05-15"),
        mobile1: "9876543210",
        mobile2: "8765432109",
        organizationName: "Digital Solutions",
        businessTagline: "Taking Your Business Online",
        organizationMobileNo: "9876543210",
        organizationLandlineNo: "01123456789",
        organizationEmail: "info@digitalsolutions.com",
        orgAddressLine1: "123, Business Complex",
        orgAddressLine2: "Connaught Place",
        orgLocation: "Delhi",
        orgPincode: "110001",
        organizationWebsite: "www.digitalsolutions.com",
        organizationDescription:
          "Digital marketing and SEO services for businesses.",
        addressLine1: "456, Residential Area",
        addressLine2: "Rohini",
        location: "Delhi",
        pincode: "110085",
        specificAsk: "Looking for clients needing SEO services",
        specificGive: "Can help optimize web presence",
        email: "rahul@digitalsolutions.com",
        password: memberPassword,
        hoExpiryDate: expiryDate(12),
        venueExpiryDate: expiryDate(1),
      },
      chapters[0]
    ),

    createMemberWithUser(
      {
        memberName: "Priya Singh",
        category: "Financial Services",
        businessCategory: "Tax Consultant",
        gender: "Female",
        dateOfBirth: new Date("1988-08-21"),
        mobile1: "9876543211",
        organizationName: "Tax Solutions",
        organizationMobileNo: "9876543211",
        organizationEmail: "info@taxsolutions.com",
        orgAddressLine1: "789, Finance Building",
        orgLocation: "Delhi",
        orgPincode: "110003",
        addressLine1: "234, Housing Society",
        location: "Delhi",
        pincode: "110001",
        email: "priya@taxsolutions.com",
        password: memberPassword,
        hoExpiryDate: expiryDate(12),
        venueExpiryDate: expiryDate(1),
      },
      chapters[0]
    ),
  ]);

  // Bangalore Chapter Members
  const bangaloreMembers = await Promise.all([
    createMemberWithUser(
      {
        memberName: "Ankit Patel",
        category: "Software Development",
        businessCategory: "Mobile App Development",
        gender: "Male",
        dateOfBirth: new Date("1990-03-12"),
        mobile1: "9876543212",
        organizationName: "AppSphere",
        organizationMobileNo: "9876543212",
        organizationEmail: "info@appsphere.com",
        orgAddressLine1: "456, Tech Park",
        orgLocation: "Bangalore",
        orgPincode: "560001",
        addressLine1: "789, Lake View Apartments",
        location: "Bangalore",
        pincode: "560003",
        email: "ankit@appsphere.com",
        password: memberPassword,
        hoExpiryDate: expiryDate(6),
        venueExpiryDate: expiryDate(1),
      },
      chapters[1]
    ),

    createMemberWithUser(
      {
        memberName: "Deepa Reddy",
        category: "Education",
        businessCategory: "Training Services",
        gender: "Female",
        dateOfBirth: new Date("1987-11-05"),
        mobile1: "9876543213",
        organizationName: "Learning Edge",
        organizationMobileNo: "9876543213",
        organizationEmail: "info@learningedge.com",
        orgAddressLine1: "101, Education Tower",
        orgLocation: "Bangalore",
        orgPincode: "560002",
        addressLine1: "202, Green View",
        location: "Bangalore",
        pincode: "560004",
        email: "deepa@learningedge.com",
        password: memberPassword,
        hoExpiryDate: expiryDate(6),
        venueExpiryDate: expiryDate(1),
      },
      chapters[1]
    ),
  ]);

  // Kolkata Chapter Members
  const kolkataMembers = await Promise.all([
    createMemberWithUser(
      {
        memberName: "Sourav Das",
        category: "Real Estate",
        businessCategory: "Property Consultant",
        gender: "Male",
        dateOfBirth: new Date("1982-07-18"),
        mobile1: "9876543214",
        organizationName: "Prime Properties",
        organizationMobileNo: "9876543214",
        organizationEmail: "info@primeproperties.com",
        orgAddressLine1: "303, Business Hub",
        orgLocation: "Kolkata",
        orgPincode: "700001",
        addressLine1: "505, Sea View Apartments",
        location: "Kolkata",
        pincode: "700005",
        email: "sourav@primeproperties.com",
        password: memberPassword,
        hoExpiryDate: expiryDate(12),
        venueExpiryDate: expiryDate(1),
      },
      chapters[2]
    ),

    createMemberWithUser(
      {
        memberName: "Riya Sen",
        category: "Digital Marketing",
        businessCategory: "Social Media Management",
        gender: "Female",
        dateOfBirth: new Date("1992-04-25"),
        mobile1: "9876543215",
        organizationName: "Social Wave",
        organizationMobileNo: "9876543215",
        organizationEmail: "info@socialwave.com",
        orgAddressLine1: "404, Media Building",
        orgLocation: "Kolkata",
        orgPincode: "700002",
        addressLine1: "606, Urban Heights",
        location: "Kolkata",
        pincode: "700006",
        email: "riya@socialwave.com",
        password: memberPassword,
        hoExpiryDate: expiryDate(3),
        venueExpiryDate: expiryDate(1),
      },
      chapters[2]
    ),
  ]);

  // Mumbai Chapter Members
  const mumbaiMembers = await Promise.all([
    createMemberWithUser(
      {
        memberName: "Vikram Mehta",
        category: "Real Estate",
        businessCategory: "Property Consultant",
        gender: "Male",
        dateOfBirth: new Date("1982-07-18"),
        mobile1: "9876543216", // Changed to ensure uniqueness
        organizationName: "Prime Properties",
        organizationMobileNo: "9876543214",
        organizationEmail: "info@primeproperties.com",
        orgAddressLine1: "303, Business Hub",
        orgLocation: "Mumbai",
        orgPincode: "400001",
        addressLine1: "505, Sea View Apartments",
        location: "Mumbai",
        pincode: "400005",
        email: "vikram@primeproperties.com",
        password: memberPassword,
        hoExpiryDate: expiryDate(12),
        venueExpiryDate: expiryDate(1),
      },
      chapters[3]
    ),

    createMemberWithUser(
      {
        memberName: "Neha Joshi",
        category: "Digital Marketing",
        businessCategory: "Social Media Management",
        gender: "Female",
        dateOfBirth: new Date("1992-04-25"),
        mobile1: "9876543217", // Changed to ensure uniqueness
        organizationName: "Social Wave",
        organizationMobileNo: "9876543215",
        organizationEmail: "info@socialwave.com",
        orgAddressLine1: "404, Media Building",
        orgLocation: "Mumbai",
        orgPincode: "400002",
        addressLine1: "606, Urban Heights",
        location: "Mumbai",
        pincode: "400006",
        email: "neha@socialwave.com",
        password: memberPassword,
        hoExpiryDate: expiryDate(3),
        venueExpiryDate: expiryDate(1),
      },
      chapters[3]
    ),
  ]);

  // Create Chapter Meetings
  console.log("Creating chapter meetings...");
  const meetings = await Promise.all([
    // Delhi Chapter Meetings
    prisma.chapterMeeting.create({
      data: {
        date: recentDate(),
        meetingTime: "09:00 AM",
        meetingTitle: "Networking Strategies",
        meetingVenue: "Hotel Taj, Delhi",
        chapterId: chapters[0].id,
      },
    }),
    prisma.chapterMeeting.create({
      data: {
        date: futureDate(),
        meetingTime: "09:00 AM",
        meetingTitle: "Business Growth Tactics",
        meetingVenue: "Hotel Taj, Delhi",
        chapterId: chapters[0].id,
      },
    }),

    // Bangalore Chapter Meetings
    prisma.chapterMeeting.create({
      data: {
        date: recentDate(),
        meetingTime: "10:00 AM",
        meetingTitle: "Tech Innovations",
        meetingVenue: "Tech Hub, Bangalore",
        chapterId: chapters[1].id,
      },
    }),
    prisma.chapterMeeting.create({
      data: {
        date: futureDate(),
        meetingTime: "10:00 AM",
        meetingTitle: "Startup Ecosystem",
        meetingVenue: "Tech Hub, Bangalore",
        chapterId: chapters[1].id,
      },
    }),

    // Kolkata Chapter Meetings
    prisma.chapterMeeting.create({
      data: {
        date: recentDate(),
        meetingTime: "08:30 AM",
        meetingTitle: "Business Networking",
        meetingVenue: "Community Hall, Kolkata",
        chapterId: chapters[2].id,
      },
    }),
    prisma.chapterMeeting.create({
      data: {
        date: futureDate(),
        meetingTime: "08:30 AM",
        meetingTitle: "Investment Opportunities",
        meetingVenue: "Community Hall, Kolkata",
        chapterId: chapters[2].id,
      },
    }),

    // Mumbai Chapter Meetings
    prisma.chapterMeeting.create({
      data: {
        date: recentDate(),
        meetingTime: "08:30 AM",
        meetingTitle: "Business Networking",
        meetingVenue: "Business Center, Mumbai",
        chapterId: chapters[3].id,
      },
    }),
    prisma.chapterMeeting.create({
      data: {
        date: futureDate(),
        meetingTime: "08:30 AM",
        meetingTitle: "Investment Opportunities",
        meetingVenue: "Business Center, Mumbai",
        chapterId: chapters[3].id,
      },
    }),
  ]);

  // Create Meeting Attendances
  console.log("Creating meeting attendances...");
  await Promise.all([
    // Delhi Chapter
    prisma.meetingAttendance.create({
      data: {
        meetingId: meetings[0].id,
        memberId: delhiMembers[0].member.id,
        isPresent: true,
      },
    }),
    prisma.meetingAttendance.create({
      data: {
        meetingId: meetings[0].id,
        memberId: delhiMembers[1].member.id,
        isPresent: true,
      },
    }),

    // Bangalore Chapter
    prisma.meetingAttendance.create({
      data: {
        meetingId: meetings[2].id,
        memberId: bangaloreMembers[0].member.id,
        isPresent: true,
      },
    }),
    prisma.meetingAttendance.create({
      data: {
        meetingId: meetings[2].id,
        memberId: bangaloreMembers[1].member.id,
        isPresent: false,
      },
    }),

    // Kolkata Chapter
    prisma.meetingAttendance.create({
      data: {
        meetingId: meetings[4].id,
        memberId: kolkataMembers[0].member.id,
        isPresent: true,
      },
    }),
    prisma.meetingAttendance.create({
      data: {
        meetingId: meetings[4].id,
        memberId: kolkataMembers[1].member.id,
        isPresent: true,
      },
    }),

    // Mumbai Chapter
    prisma.meetingAttendance.create({
      data: {
        meetingId: meetings[6].id,
        memberId: mumbaiMembers[0].member.id,
        isPresent: true,
      },
    }),
    prisma.meetingAttendance.create({
      data: {
        meetingId: meetings[6].id,
        memberId: mumbaiMembers[1].member.id,
        isPresent: true,
      },
    }),
  ]);

  // Create Visitors
  console.log("Creating visitors...");
  await Promise.all([
    // Delhi Chapter Visitors
    prisma.visitor.create({
      data: {
        name: "Arun Kumar",
        email: "arun@gmail.com",
        gender: "Male",
        dateOfBirth: new Date("1990-06-10"),
        mobile1: "9876543220",
        isCrossChapter: false,
        meetingId: meetings[0].id,
        chapterId: chapters[0].id,
        chapter: "Delhi Chapter",
        invitedById: delhiMembers[0].member.id,
        category: "IT Services",
        businessDetails: "IT infrastructure and support services",
        addressLine1: "789, Tech Park",
        city: "Delhi",
        pincode: "110001",
        status: "Attended",
      },
    }),
    prisma.visitor.create({
      data: {
        name: "Sneha Gupta",
        email: "sneha@gmail.com",
        gender: "Female",
        mobile1: "9876543221",
        isCrossChapter: false,
        meetingId: meetings[0].id,
        chapterId: chapters[0].id,
        chapter: "Delhi Chapter",
        invitedById: delhiMembers[1].member.id,
        category: "Healthcare",
        businessDetails: "Wellness consultant",
        addressLine1: "101, Health Hub",
        city: "Delhi",
        pincode: "110002",
        status: "No-Show",
      },
    }),

    // Bangalore Chapter Visitors
    prisma.visitor.create({
      data: {
        name: "Prakash Rao",
        email: "prakash@gmail.com",
        gender: "Male",
        mobile1: "9876543222",
        isCrossChapter: false,
        meetingId: meetings[2].id,
        chapterId: chapters[1].id,
        chapter: "Bangalore Chapter",
        invitedById: bangaloreMembers[0].member.id,
        category: "E-commerce",
        businessDetails: "Online retail business",
        addressLine1: "303, E-commerce Park",
        city: "Bangalore",
        pincode: "560001",
        status: "Attended",
      },
    }),

    // Kolkata Chapter Visitors
    prisma.visitor.create({
      data: {
        name: "Rohan Desai",
        email: "rohan@gmail.com",
        gender: "Male",
        mobile1: "9876543223",
        isCrossChapter: false,
        meetingId: meetings[4].id,
        chapterId: chapters[2].id,
        chapter: "Kolkata Chapter",
        invitedById: kolkataMembers[0].member.id,
        category: "Financial Services",
        businessDetails: "Investment advisor",
        addressLine1: "404, Finance Tower",
        city: "Kolkata",
        pincode: "700001",
        status: "Attended",
      },
    }),

    // Mumbai Chapter Visitors
    prisma.visitor.create({
      data: {
        name: "Suresh Kumar",
        email: "suresh@gmail.com",
        gender: "Male",
        mobile1: "9876543224",
        isCrossChapter: false,
        meetingId: meetings[6].id,
        chapterId: chapters[3].id,
        chapter: "Mumbai Chapter",
        invitedById: mumbaiMembers[0].member.id,
        category: "Real Estate",
        businessDetails: "Property consultant",
        addressLine1: "505, Property Hub",
        city: "Mumbai",
        pincode: "400001",
        status: "Attended",
      },
    }),
  ]);

  // Create Memberships
  console.log("Creating memberships...");
  await Promise.all([
    // Delhi Chapter Memberships - HO Membership for Rahul Sharma
    prisma.membership.create({
      data: {
        memberId: delhiMembers[0].member.id,
        invoiceNumber: "INV-DEL-001-HO",
        invoiceDate: new Date("2024-01-01"),
        packageId: packages[1].id, // Yearly HO membership
        packageStartDate: new Date("2024-01-01"),
        packageEndDate: expiryDate(12),
        basicFees: 20000,
        cgstRate: 9,
        cgstAmount: 1800,
        sgstRate: 9,
        sgstAmount: 1800,
        totalTax: 3600,
        totalAmount: 23600,
        totalFees: 23600,
        paymentDate: new Date("2024-01-01"),
        paymentMode: "Bank Transfer",
        utrNumber: "UTR123456",
      },
    }),
    // Delhi Chapter Memberships - Venue Membership for Rahul Sharma
    prisma.membership.create({
      data: {
        memberId: delhiMembers[0].member.id,
        invoiceNumber: "INV-DEL-001-VENUE",
        invoiceDate: new Date("2024-01-01"),
        packageId: packages[2].id, // Monthly venue fee
        packageStartDate: new Date("2024-01-01"),
        packageEndDate: expiryDate(1),
        basicFees: 500,
        cgstRate: 9,
        cgstAmount: 45,
        sgstRate: 9,
        sgstAmount: 45,
        totalTax: 90,
        totalAmount: 590,
        totalFees: 590,
        paymentDate: new Date("2024-01-01"),
        paymentMode: "Bank Transfer",
        utrNumber: "UTR123457",
      },
    }),
    // Delhi Chapter Memberships - HO Membership for Priya Singh
    prisma.membership.create({
      data: {
        memberId: delhiMembers[1].member.id,
        invoiceNumber: "INV-DEL-002-HO",
        invoiceDate: new Date("2024-01-15"),
        packageId: packages[1].id, // Yearly HO membership
        packageStartDate: new Date("2024-01-15"),
        packageEndDate: expiryDate(12),
        basicFees: 20000,
        cgstRate: 9,
        cgstAmount: 1800,
        sgstRate: 9,
        sgstAmount: 1800,
        totalTax: 3600,
        totalAmount: 23600,
        totalFees: 23600,
        paymentDate: new Date("2024-01-15"),
        paymentMode: "Cheque",
        chequeNumber: "CHQ789012",
        chequeDate: new Date("2024-01-14"),
        bankName: "HDFC Bank",
      },
    }),
    // Delhi Chapter Memberships - Venue Membership for Priya Singh
    prisma.membership.create({
      data: {
        memberId: delhiMembers[1].member.id,
        invoiceNumber: "INV-DEL-002-VENUE",
        invoiceDate: new Date("2024-01-15"),
        packageId: packages[2].id, // Monthly venue fee
        packageStartDate: new Date("2024-01-15"),
        packageEndDate: expiryDate(1),
        basicFees: 500,
        cgstRate: 9,
        cgstAmount: 45,
        sgstRate: 9,
        sgstAmount: 45,
        totalTax: 90,
        totalAmount: 590,
        totalFees: 590,
        paymentDate: new Date("2024-01-15"),
        paymentMode: "Cheque",
        chequeNumber: "CHQ789013",
        chequeDate: new Date("2024-01-14"),
        bankName: "HDFC Bank",
      },
    }),

    // Bangalore Chapter Memberships - HO Membership for Ankit Patel
    prisma.membership.create({
      data: {
        memberId: bangaloreMembers[0].member.id,
        invoiceNumber: "INV-BLR-001-HO",
        invoiceDate: new Date("2024-02-01"),
        packageId: packages[3].id, // Monthly HO membership
        packageStartDate: new Date("2024-02-01"),
        packageEndDate: expiryDate(6),
        basicFees: 2500,
        cgstRate: 9,
        cgstAmount: 225,
        sgstRate: 9,
        sgstAmount: 225,
        totalTax: 450,
        totalAmount: 2950,
        totalFees: 2950,
        paymentDate: new Date("2024-02-01"),
        paymentMode: "Bank Transfer",
        utrNumber: "UTR789012",
      },
    }),
    // Bangalore Chapter Memberships - Venue Membership for Ankit Patel
    prisma.membership.create({
      data: {
        memberId: bangaloreMembers[0].member.id,
        invoiceNumber: "INV-BLR-001-VENUE",
        invoiceDate: new Date("2024-02-01"),
        packageId: packages[5].id, // Monthly venue fee
        packageStartDate: new Date("2024-02-01"),
        packageEndDate: expiryDate(1),
        basicFees: 600,
        cgstRate: 9,
        cgstAmount: 54,
        sgstRate: 9,
        sgstAmount: 54,
        totalTax: 108,
        totalAmount: 708,
        totalFees: 708,
        paymentDate: new Date("2024-02-01"),
        paymentMode: "Bank Transfer",
        utrNumber: "UTR789013",
      },
    }),
    // Bangalore Chapter Memberships - HO Membership for Deepa Reddy
    prisma.membership.create({
      data: {
        memberId: bangaloreMembers[1].member.id,
        invoiceNumber: "INV-BLR-002-HO",
        invoiceDate: new Date("2024-02-15"),
        packageId: packages[3].id, // Monthly HO membership
        packageStartDate: new Date("2024-02-15"),
        packageEndDate: expiryDate(6),
        basicFees: 2500,
        cgstRate: 9,
        cgstAmount: 225,
        sgstRate: 9,
        sgstAmount: 225,
        totalTax: 450,
        totalAmount: 2950,
        totalFees: 2950,
        paymentDate: new Date("2024-02-15"),
        paymentMode: "UPI",
        utrNumber: "UPI123456",
      },
    }),
    // Bangalore Chapter Memberships - Venue Membership for Deepa Reddy
    prisma.membership.create({
      data: {
        memberId: bangaloreMembers[1].member.id,
        invoiceNumber: "INV-BLR-002-VENUE",
        invoiceDate: new Date("2024-02-15"),
        packageId: packages[5].id, // Monthly venue fee
        packageStartDate: new Date("2024-02-15"),
        packageEndDate: expiryDate(1),
        basicFees: 600,
        cgstRate: 9,
        cgstAmount: 54,
        sgstRate: 9,
        sgstAmount: 54,
        totalTax: 108,
        totalAmount: 708,
        totalFees: 708,
        paymentDate: new Date("2024-02-15"),
        paymentMode: "UPI",
        utrNumber: "UPI123457",
      },
    }),

    // Kolkata Chapter Memberships - HO Membership for Sourav Das
    prisma.membership.create({
      data: {
        memberId: kolkataMembers[0].member.id,
        invoiceNumber: "INV-KOL-001-HO",
        invoiceDate: new Date("2024-03-01"),
        packageId: packages[7].id, // Yearly HO membership for Kolkata
        packageStartDate: new Date("2024-03-01"),
        packageEndDate: expiryDate(12),
        basicFees: 22000,
        cgstRate: 9,
        cgstAmount: 1980,
        sgstRate: 9,
        sgstAmount: 1980,
        totalTax: 3960,
        totalAmount: 25960,
        totalFees: 25960,
        paymentDate: new Date("2024-03-01"),
        paymentMode: "NEFT",
        neftNumber: "NEFT123456",
      },
    }),
    // Kolkata Chapter Memberships - Venue Membership for Sourav Das
    prisma.membership.create({
      data: {
        memberId: kolkataMembers[0].member.id,
        invoiceNumber: "INV-KOL-001-VENUE",
        invoiceDate: new Date("2024-03-01"),
        packageId: packages[8].id, // Monthly venue fee
        packageStartDate: new Date("2024-03-01"),
        packageEndDate: expiryDate(1),
        basicFees: 550,
        cgstRate: 9,
        cgstAmount: 49.5,
        sgstRate: 9,
        sgstAmount: 49.5,
        totalTax: 99,
        totalAmount: 649,
        totalFees: 649,
        paymentDate: new Date("2024-03-01"),
        paymentMode: "NEFT",
        neftNumber: "NEFT123457",
      },
    }),
    // Kolkata Chapter Memberships - HO Membership for Riya Sen
    prisma.membership.create({
      data: {
        memberId: kolkataMembers[1].member.id,
        invoiceNumber: "INV-KOL-002-HO",
        invoiceDate: new Date("2024-03-15"),
        packageId: packages[6].id, // Monthly HO membership for Kolkata
        packageStartDate: new Date("2024-03-15"),
        packageEndDate: expiryDate(3),
        basicFees: 2200,
        cgstRate: 9,
        cgstAmount: 198,
        sgstRate: 9,
        sgstAmount: 198,
        totalTax: 396,
        totalAmount: 2596,
        totalFees: 2596,
        paymentDate: new Date("2024-03-15"),
        paymentMode: "Card",
        utrNumber: "CARD123456",
      },
    }),
    // Kolkata Chapter Memberships - Venue Membership for Riya Sen
    prisma.membership.create({
      data: {
        memberId: kolkataMembers[1].member.id,
        invoiceNumber: "INV-KOL-002-VENUE",
        invoiceDate: new Date("2024-03-15"),
        packageId: packages[8].id, // Monthly venue fee
        packageStartDate: new Date("2024-03-15"),
        packageEndDate: expiryDate(1),
        basicFees: 550,
        cgstRate: 9,
        cgstAmount: 49.5,
        sgstRate: 9,
        sgstAmount: 49.5,
        totalTax: 99,
        totalAmount: 649,
        totalFees: 649,
        paymentDate: new Date("2024-03-15"),
        paymentMode: "Card",
        utrNumber: "CARD123457",
      },
    }),

    // Mumbai Chapter Memberships - HO Membership for Vikram Mehta
    prisma.membership.create({
      data: {
        memberId: mumbaiMembers[0].member.id,
        invoiceNumber: "INV-MUM-001-HO",
        invoiceDate: new Date("2024-03-01"),
        packageId: packages[9].id, // Yearly HO membership for Mumbai
        packageStartDate: new Date("2024-03-01"),
        packageEndDate: expiryDate(12),
        basicFees: 30000,
        cgstRate: 9,
        cgstAmount: 2700,
        sgstRate: 9,
        sgstAmount: 2700,
        totalTax: 5400,
        totalAmount: 35400,
        totalFees: 35400,
        paymentDate: new Date("2024-03-01"),
        paymentMode: "NEFT",
        neftNumber: "NEFT789012",
      },
    }),
    // Mumbai Chapter Memberships - Venue Membership for Vikram Mehta
    prisma.membership.create({
      data: {
        memberId: mumbaiMembers[0].member.id,
        invoiceNumber: "INV-MUM-001-VENUE",
        invoiceDate: new Date("2024-03-01"),
        packageId: packages[10].id, // Monthly venue fee
        packageStartDate: new Date("2024-03-01"),
        packageEndDate: expiryDate(1),
        basicFees: 800,
        cgstRate: 9,
        cgstAmount: 72,
        sgstRate: 9,
        sgstAmount: 72,
        totalTax: 144,
        totalAmount: 944,
        totalFees: 944,
        paymentDate: new Date("2024-03-01"),
        paymentMode: "NEFT",
        neftNumber: "NEFT789013",
      },
    }),
    // Mumbai Chapter Memberships - HO Membership for Neha Joshi
    prisma.membership.create({
      data: {
        memberId: mumbaiMembers[1].member.id,
        invoiceNumber: "INV-MUM-002-HO",
        invoiceDate: new Date("2024-03-15"),
        packageId: packages[7].id, // Monthly HO membership for Mumbai
        packageStartDate: new Date("2024-03-15"),
        packageEndDate: expiryDate(3),
        basicFees: 8000,
        cgstRate: 9,
        cgstAmount: 720,
        sgstRate: 9,
        sgstAmount: 720,
        totalTax: 1440,
        totalAmount: 9440,
        totalFees: 9440,
        paymentDate: new Date("2024-03-15"),
        paymentMode: "Card",
        utrNumber: "CARD789012",
      },
    }),
    // Mumbai Chapter Memberships - Venue Membership for Neha Joshi
    prisma.membership.create({
      data: {
        memberId: mumbaiMembers[1].member.id,
        invoiceNumber: "INV-MUM-002-VENUE",
        invoiceDate: new Date("2024-03-15"),
        packageId: packages[10].id, // Monthly venue fee
        packageStartDate: new Date("2024-03-15"),
        packageEndDate: expiryDate(1),
        basicFees: 800,
        cgstRate: 9,
        cgstAmount: 72,
        sgstRate: 9,
        sgstAmount: 72,
        totalTax: 144,
        totalAmount: 944,
        totalFees: 944,
        paymentDate: new Date("2024-03-15"),
        paymentMode: "Card",
        utrNumber: "CARD789013",
      },
    }),
  ]);

  // Create Transactions
  console.log("Creating transactions...");
  await Promise.all([
    // Delhi Chapter Transactions
    prisma.transaction.create({
      data: {
        chapterId: chapters[0].id,
        date: new Date("2024-01-15"),
        accountType: "bank",
        transactionType: "credit",
        amount: 23600,
        transactionHead: "Membership Fee",
        narration: "Membership fee from Rahul Sharma",
        reference: "INV-DEL-001",
        hasInvoice: true,
        gstRate: 18,
        gstAmount: 3600,
        invoiceNumber: "INV-DEL-001",
        partyName: "Rahul Sharma",
      },
    }),
    prisma.transaction.create({
      data: {
        chapterId: chapters[0].id,
        date: new Date("2024-02-01"),
        accountType: "cash",
        transactionType: "debit",
        amount: 5000,
        transactionHead: "Venue Rent",
        narration: "Monthly venue rent payment",
        reference: "RENT-FEB-2024",
        hasInvoice: true,
        gstRate: 18,
        gstAmount: 900,
        invoiceNumber: "RENT-001",
        partyName: "Hotel Taj, Delhi",
      },
    }),

    // Bangalore Chapter Transactions
    prisma.transaction.create({
      data: {
        chapterId: chapters[1].id,
        date: new Date("2024-02-15"),
        accountType: "bank",
        transactionType: "credit",
        amount: 2950,
        transactionHead: "Membership Fee",
        narration: "Membership fee from Ankit Patel",
        reference: "INV-BLR-001",
        hasInvoice: true,
        gstRate: 18,
        gstAmount: 450,
        invoiceNumber: "INV-BLR-001",
        partyName: "Ankit Patel",
      },
    }),

    // Kolkata Chapter Transactions
    prisma.transaction.create({
      data: {
        chapterId: chapters[2].id,
        date: new Date("2024-03-01"),
        accountType: "bank",
        transactionType: "credit",
        amount: 25960,
        transactionHead: "Membership Fee",
        narration: "Membership fee from Sourav Das",
        reference: "INV-KOL-001",
        hasInvoice: true,
        gstRate: 18,
        gstAmount: 3960,
        invoiceNumber: "INV-KOL-001",
        partyName: "Sourav Das",
      },
    }),
  ]);

  // Create References
  console.log("Creating references...");
  await Promise.all([
    // Delhi Chapter References
    prisma.reference.create({
      data: {
        date: recentDate(),
        noOfReferences: 1,
        chapterId: chapters[0].id,
        giverId: delhiMembers[0].member.id,
        receiverId: delhiMembers[1].member.id,
        urgency: "High",
        self: false,
        nameOfReferral: "Amit Verma",
        mobile1: "9876543230",
        email: "amit@gmail.com",
        remarks: "Looking for tax consulting services",
        addressLine1: "505, Business Tower",
        location: "Delhi",
        pincode: "110001",
        status: "contacted",
        statusHistory: {
          create: [
            {
              date: recentDate(),
              status: "pending",
              comment: "Initial referral",
            },
            {
              date: new Date(),
              status: "contacted",
              comment: "Called and set up a meeting",
            },
          ],
        },
      },
    }),

    // Bangalore Chapter References
    prisma.reference.create({
      data: {
        date: recentDate(),
        noOfReferences: 1,
        chapterId: chapters[1].id,
        giverId: bangaloreMembers[0].member.id,
        receiverId: bangaloreMembers[1].member.id,
        urgency: "Medium",
        self: false,
        nameOfReferral: "Suresh Kumar",
        mobile1: "9876543231",
        email: "suresh@gmail.com",
        remarks: "Interested in corporate training",
        addressLine1: "606, Corporate Park",
        location: "Bangalore",
        pincode: "560001",
        status: "pending",
        statusHistory: {
          create: [
            {
              date: recentDate(),
              status: "pending",
              comment: "Initial referral",
            },
          ],
        },
      },
    }),

    // Kolkata Chapter References
    prisma.reference.create({
      data: {
        date: recentDate(),
        noOfReferences: 1,
        chapterId: chapters[2].id,
        giverId: kolkataMembers[0].member.id,
        receiverId: kolkataMembers[1].member.id,
        urgency: "Low",
        self: false,
        nameOfReferral: "Rohan Desai",
        mobile1: "9876543232",
        email: "rohan@gmail.com",
        remarks: "Looking for financial services",
        addressLine1: "404, Finance Tower",
        location: "Kolkata",
        pincode: "700001",
        status: "pending",
        statusHistory: {
          create: [
            {
              date: recentDate(),
              status: "pending",
              comment: "Initial referral",
            },
          ],
        },
      },
    }),
  ]);

  // Create One-to-One Meetings
  console.log("Creating one-to-one meetings...");
  await Promise.all([
    // Delhi Chapter One-to-One
    prisma.oneToOne.create({
      data: {
        date: futureDate(),
        requesterId: delhiMembers[0].member.id,
        requestedId: delhiMembers[1].member.id,
        chapterId: chapters[0].id,
        remarks: "Discussion on business collaboration",
        status: "accepted",
      },
    }),

    // Bangalore Chapter One-to-One
    prisma.oneToOne.create({
      data: {
        date: futureDate(),
        requesterId: bangaloreMembers[0].member.id,
        requestedId: bangaloreMembers[1].member.id,
        chapterId: chapters[1].id,
        remarks: "Software training opportunity discussion",
        status: "pending",
      },
    }),

    // Kolkata Chapter One-to-One
    prisma.oneToOne.create({
      data: {
        date: futureDate(),
        requesterId: kolkataMembers[0].member.id,
        requestedId: kolkataMembers[1].member.id,
        chapterId: chapters[2].id,
        remarks: "Real estate investment discussion",
        status: "pending",
      },
    }),
  ]);

  console.log("Seeding completed successfully!");
}

// Execute the main function and handle any errors
main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Close the Prisma client
    await prisma.$disconnect();
  });
