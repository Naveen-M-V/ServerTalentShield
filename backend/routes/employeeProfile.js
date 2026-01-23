const express = require('express');
const router = express.Router();
const EmployeeHub = require('../models/EmployeesHub');
const AnnualLeaveBalance = require('../models/AnnualLeaveBalance');
const LeaveRecord = require('../models/LeaveRecord');
const Folder = require('../models/Folder');
const DocumentManagement = require('../models/DocumentManagement');

// Get employee by ID with complete profile data
router.get('/:id', async (req, res) => {
  try {
    const employee = await EmployeeHub.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // BACKEND: Log raw database values
    console.log("═══════════════════════════════════════");
    console.log("DATABASE RECORD for employee:", employee.employeeId);
    console.log("Address fields in DB:", {
      address1: employee.address1,
      address2: employee.address2,
      address3: employee.address3,
      townCity: employee.townCity,
      county: employee.county,
      postcode: employee.postcode
    });
    console.log("Emergency contact in DB:", {
      name: employee.emergencyContactName,
      relation: employee.emergencyContactRelation,
      phone: employee.emergencyContactPhone,
      email: employee.emergencyContactEmail
    });
    console.log("═══════════════════════════════════════");

    // Fetch documents and folders for this employee
    const documents = await DocumentManagement.find({ ownerId: req.params.id })
      .populate('folderId', 'name description')
      .lean();
    
    // Get unique folder IDs from the documents
    const folderIds = [...new Set(documents.map(doc => doc.folderId?._id?.toString()).filter(Boolean))];
    
    // Fetch full folder data
    const folders = await Folder.find({ _id: { $in: folderIds } }).lean();
    
    // Group documents by folder
    const foldersWithDocuments = folders.map(folder => {
      const folderDocs = documents.filter(doc => 
        doc.folderId && doc.folderId._id.toString() === folder._id.toString()
      ).map(doc => ({
        id: doc._id,
        name: doc.name || doc.fileName,
        size: doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : 'Unknown',
        uploaded: doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-GB') : 'Unknown',
        version: doc.version ? `v${doc.version}` : null,
        expiry: doc.expiresOn ? new Date(doc.expiresOn).toLocaleDateString('en-GB') : null,
        mimeType: doc.mimeType,
        fileUrl: doc.fileUrl,
        category: doc.category
      }));
      
      return {
        id: folder._id,
        name: folder.name,
        description: folder.description,
        documents: folderDocs,
        createdAt: folder.createdAt
      };
    });

    // Fetch real leave balance data for current year
    const now = new Date();
    const leaveBalance = await AnnualLeaveBalance.findOne({
      user: req.params.id,
      leaveYearStart: { $lte: now },
      leaveYearEnd: { $gte: now }
    });

    // Fetch recent leave records
    const recentLeaveRecords = await LeaveRecord.find({
      user: req.params.id
    })
      .sort({ startDate: -1 })
      .limit(5);

    // Calculate leave statistics
    const leaveBalanceData = leaveBalance ? {
      total: leaveBalance.entitlementDays,
      taken: leaveBalance.usedDays || 0,
      remaining: leaveBalance.entitlementDays - (leaveBalance.usedDays || 0)
    } : {
      total: 28,  // Default UK statutory minimum
      taken: 0,
      remaining: 28
    };

    // Count sickness and lateness occurrences (you can add these models later)
    const absencesData = {
      sicknessCount: 0,  // TODO: Implement sickness tracking
      latenessCount: 0   // TODO: Implement lateness tracking
    };

    // Format recent absences
    const recentAbsences = recentLeaveRecords.map(record => ({
      type: record.leaveType,
      date: record.startDate,
      endDate: record.endDate,
      status: record.status,
      days: record.daysUsed
    }));

    // Return complete employee data with leave balance
    const profileData = {
      // Basic Info
      _id: employee._id,
      name: `${employee.firstName} ${employee.lastName}`,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      employeeId: employee.employeeId,
      
      // Contact Info
      phoneNumber: employee.phone || employee.workPhone,
      mobileNumber: employee.phone,
      phone: employee.phone || employee.workPhone,
      
      // Job Info
      jobTitle: employee.jobTitle,
      position: employee.jobTitle,
      department: employee.department,
      team: employee.team,
      officeLocation: employee.office,
      office: employee.office,
      workLocation: employee.workLocation,
      managerId: employee.managerId,
      
      // Dates
      startDate: employee.startDate,
      dateOfBirth: employee.dateOfBirth,
      probationEndDate: employee.probationEndDate,
      
      // Personal Info
      gender: employee.gender,
      title: employee.title,
      ethnicity: employee.ethnicity,
      
      // Address - Map schema fields (address1/2/3) to frontend names (addressLine1/2/3)
      addressLine1: employee.address1,
      addressLine2: employee.address2,
      addressLine3: employee.address3,
      city: employee.townCity,
      townCity: employee.townCity,
      postalCode: employee.postcode,
      postcode: employee.postcode,
      country: employee.county,
      county: employee.county,
      address: employee.address1,
      address1: employee.address1,
      address2: employee.address2,
      address3: employee.address3,
      
      // Documents & Folders - populated from DocumentManagement
      documents: documents || [],
      folders: foldersWithDocuments || [],
      documentFolders: foldersWithDocuments || [],
      
      // Emergency Contact
      emergencyContactName: employee.emergencyContactName,
      emergencyContactRelation: employee.emergencyContactRelation,
      emergencyContactPhone: employee.emergencyContactPhone,
      emergencyContactEmail: employee.emergencyContactEmail,
      
      // Employment/Pay Details
      salary: employee.salary,
      rate: employee.rate,
      paymentFrequency: employee.paymentFrequency,
      payrollCycle: employee.paymentFrequency,
      effectiveFrom: employee.effectiveFrom,
      payrollNumber: employee.payrollNumber,
      
      // Bank Details
      accountName: employee.accountName,
      bankName: employee.bankName,
      bankBranch: employee.bankBranch,
      accountNumber: employee.accountNumber,
      sortCode: employee.sortCode,
      
      // Tax & NI
      taxCode: employee.taxCode,
      niNumber: employee.niNumber,
      nationalInsuranceNumber: employee.niNumber,
      
      // Passport
      passportNumber: employee.passportNumber,
      passportCountry: employee.passportCountry,
      passportExpiryDate: employee.passportExpiryDate,
      
      // Driving Licence
      licenceNumber: employee.licenceNumber,
      licenceCountry: employee.licenceCountry,
      licenceClass: employee.licenceClass,
      licenceExpiryDate: employee.licenceExpiryDate,
      
      // Visa
      visaNumber: employee.visaNumber,
      visaExpiryDate: employee.visaExpiryDate,
      
      // Leave & Absence
      leaveBalance: leaveBalanceData,
      absences: absencesData,
      recentAbsences: recentAbsences,
      
      // Other
      status: employee.status,
      workingStatus: employee.workLocation || 'On-site',
      employmentType: employee.employmentType || 'Full-time',
      initials: employee.initials || `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.toUpperCase(),
      profilePhoto: employee.profilePhoto || employee.avatar,
      role: employee.role,
      notes: employee.notes
    };

    // BACKEND LOGGING: Log what we're sending
    console.log("═══════════════════════════════════════");
    console.log("BACKEND: Sending profile for employee:", employee.employeeId);
    console.log("Address fields being sent:", {
      address1: profileData.address1,
      address2: profileData.address2,
      address3: profileData.address3,
      city: profileData.city,
      county: profileData.county,
      postcode: profileData.postcode
    });
    console.log("Emergency contact being sent:", {
      name: profileData.emergencyContactName,
      relation: profileData.emergencyContactRelation,
      phone: profileData.emergencyContactPhone
    });
    console.log("Folders being sent:", profileData.folders?.length || 0, "folders");
    console.log("═══════════════════════════════════════");

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Send registration email
router.post('/:id/send-registration', async (req, res) => {
  try {
    const employee = await EmployeeHub.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // TODO: Implement email sending logic
    console.log(`Sending registration email to ${employee.email}`);
    
    res.json({ message: 'Registration email sent successfully' });
  } catch (error) {
    console.error('Error sending registration email:', error);
    res.status(500).json({ message: 'Failed to send registration email' });
  }
});

module.exports = router;
