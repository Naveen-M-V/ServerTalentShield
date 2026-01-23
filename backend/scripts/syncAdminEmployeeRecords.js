const mongoose = require('mongoose');
const User = require('../models/User');
const EmployeeHub = require('../models/EmployeesHub');
require('dotenv').config();

/**
 * Sync Admin/Super-Admin Records Script
 * 
 * This script ensures all admin and super-admin users have corresponding 
 * EmployeeHub records, which are required for the leave approval system.
 * 
 * The leave request system stores approverId as an EmployeeHub._id,
 * so admins must exist in both User and EmployeeHub collections.
 */

async function syncAdminRecords() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      console.log('Please ensure .env file exists with MONGODB_URI');
      process.exit(1);
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all active, approved admin/super-admin users
    const admins = await User.find({
      role: { $in: ['admin', 'super-admin'] },
      isActive: true,
      isAdminApproved: true
    });

    console.log(`📋 Found ${admins.length} active admin/super-admin users\n`);

    if (admins.length === 0) {
      console.log('⚠️  No admin users found. Creating at least one admin is recommended.');
      await mongoose.disconnect();
      return;
    }

    let created = 0;
    let updated = 0;
    let existing = 0;

    for (const admin of admins) {
      // Check if they have an EmployeeHub record
      const empRecord = await EmployeeHub.findOne({ 
        email: admin.email.toLowerCase() 
      });

      if (!empRecord) {
        console.log(`➕ Creating EmployeeHub record for: ${admin.email}`);
        
        // Create EmployeeHub entry for admin
        await EmployeeHub.create({
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          isActive: true,
          status: 'Active',
          department: 'Administration',
          jobTitle: admin.role === 'super-admin' ? 'Super Administrator' : 'Administrator',
          startDate: admin.createdAt || new Date(),
          employeeId: `ADM${Date.now().toString().slice(-6)}`, // Generate unique ID
          phone: admin.phone || '',
          // Set some defaults for required fields
          office: 'Head Office',
          workLocation: 'Office',
          employmentType: 'Full-time',
          probationEndDate: null
        });
        
        created++;
        console.log(`   ✓ Created successfully\n`);
      } else {
        // Check if the record needs updating (e.g., role mismatch)
        if (empRecord.role !== admin.role) {
          console.log(`🔄 Updating role for: ${admin.email}`);
          empRecord.role = admin.role;
          empRecord.jobTitle = admin.role === 'super-admin' ? 'Super Administrator' : 'Administrator';
          await empRecord.save();
          updated++;
          console.log(`   ✓ Updated successfully\n`);
        } else {
          console.log(`✓ EmployeeHub record exists for: ${admin.email}`);
          existing++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Total Admins Processed:    ${admins.length}`);
    console.log(`➕ New Records Created:       ${created}`);
    console.log(`🔄 Records Updated:           ${updated}`);
    console.log(`✓  Already Existing:          ${existing}`);
    console.log('='.repeat(60) + '\n');

    if (created > 0 || updated > 0) {
      console.log('🎉 Sync completed successfully!');
      console.log('💡 All admins now have EmployeeHub records for leave approval.\n');
    } else {
      console.log('✅ All admin records are already in sync.\n');
    }

    // Verify the sync by querying approvers
    console.log('🔍 Verification: Querying available approvers...');
    const approverCount = await EmployeeHub.countDocuments({
      role: { $in: ['admin', 'super-admin'] },
      isActive: true
    });
    console.log(`✓ ${approverCount} approvers available in EmployeeHub\n`);

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');

  } catch (error) {
    console.error('\n❌ Sync Error:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
console.log('\n' + '='.repeat(60));
console.log('🚀 ADMIN SYNC SCRIPT - Starting...');
console.log('='.repeat(60) + '\n');

syncAdminRecords();
